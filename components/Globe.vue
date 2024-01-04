<template>
    <div ref="input">
        <canvas ref="canvas" />
        <p 
            :style="{ left: mouseX + 'px', top: mouseY + 'px'}"
            id="country-label" 
            ref="countryLabel">
            {{ countryName }}
        </p>
    </div>
</template>

<style lang="scss">
div {
    overflow: hidden;
    // cursor: grab;
}

#country-label {
    position: absolute;
    color: white;
    font-size: 20px;
    pointer-events: none;
    user-select: none;
}
</style>

<script setup lang='ts'>
import { Vector3, Line, BufferGeometry, LineBasicMaterial, Group, Scene, PerspectiveCamera, WebGLRenderer, Mesh, MeshBasicMaterial, SphereGeometry, Float32BufferAttribute, Material, Box2, Vector2, Raycaster, type ColorRepresentation } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { radToDeg } from 'three/src/math/MathUtils';

const input = shallowRef<HTMLDivElement>();
const countryLabel = shallowRef<HTMLParagraphElement>();
const countryName = ref('');

const borderMat = new LineBasicMaterial({ color: 0x666666 });
const gridMat = new LineBasicMaterial({ color: 0x1a1a1a });
const sphereMat = new MeshBasicMaterial({ color: 0x101011, opacity: 0.9, transparent: true });

const mouseX = ref(0);
const mouseY = ref(0);

abstract class Geometry {
    public abstract type: string;
    protected boundingBox: Box2 | null = null;

    constructor(protected data: Feature, public coordinates: number[][][] | number[][][][]) {
        this.computeBoundingBox();
    }

    protected abstract computeBoundingBox(): void;

    public abstract pointInPolygon(coord: Vector2): boolean;

    public pointInBoundingBox(point: Vector2) {
        return this.boundingBox?.containsPoint(point);
    }

    windingNumber(point: Vector2, polygon: number[][]): boolean {
        const points = polygon.map(coord => new Vector2(coord[0], coord[1]));

        const n = points.length;
        let windingNumber = 0;

        for (let i = 0; i < n; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % n];

            if (p1.y <= point.y) {
                if (p2.y > point.y && this.isLeft(p1, p2, point) > 0) {
                    windingNumber++;
                }
            } else if (p2.y <= point.y && this.isLeft(p1, p2, point) < 0) {
                windingNumber--;
            }
        }

        return windingNumber !== 0;
    }

    private isLeft(p1: Vector2, p2: Vector2, p: Vector2): number {
        return (p2.x - p1.x) * (p.y - p1.y) - (p.x - p1.x) * (p2.y - p1.y);
    }
}

class Polygon extends Geometry {
    public type = 'Polygon';
    declare coordinates: number[][][];

    constructor(data: Feature) {
        super(data, data.geometry.coordinates as number[][][]);
    }

    protected computeBoundingBox(): void {
        const min = new Vector2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
        const max = new Vector2(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

        this.coordinates.forEach(ring => {
            ring.forEach(coord => {
                min.x = Math.min(coord[0], min.x); // Min longitude
                min.y = Math.min(coord[1], min.y); // Min latitude
                max.x = Math.max(coord[0], max.x); // Max longitude
                max.y = Math.max(coord[1], max.y); // Max latitude
            });
        });

        this.boundingBox = new Box2(min, max);
    }

    public pointInPolygon(coord: Vector2): boolean {
        // if (!this.boundingBox?.containsPoint(coord)) return false;

        // Rings
        for (let i = 0; i < this.coordinates.length; i++) {
            if (this.windingNumber(coord, this.coordinates[i])) return true;
        }

        return false;
    }
}

let selected: Country | null = null;

class MultiPolygon extends Geometry {
    public type = 'MultiPolygon';
    declare coordinates: number[][][][];

    constructor(data: Feature) {
        super(data, data.geometry.coordinates as number[][][][]);
    }

    protected computeBoundingBox(): void {
        const min = new Vector2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
        const max = new Vector2(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

        this.coordinates.forEach(polygon => {
            polygon.forEach(ring => {
                ring.forEach(coord => {
                    // Min would be bottom left and max top right
                    min.x = Math.min(coord[0], min.x); // Min longitude
                    min.y = Math.min(coord[1], min.y); // Min latitude
                    max.x = Math.max(coord[0], max.x); // Max longitude
                    max.y = Math.max(coord[1], max.y); // Max latitude
                });
            });
        });

        this.boundingBox = new Box2(min, max);
    }

    public pointInPolygon(coord: Vector2): boolean {
        // if (!this.boundingBox?.containsPoint(coord)) return false;

        // Polygons
        for (let i = 0; i < this.coordinates.length; i++) {
            // Rings
            for (let j = 0; j < this.coordinates[i].length; j++) {
                if (this.windingNumber(coord, this.coordinates[i][j])) return true;
            }
        }

        return false;
    }
}

type Feature = {
    properties: any;
    geometry: Geometry;
}

type FeatureCollection = {
    features: Feature[];
}

async function loadGeoJson(): Promise<FeatureCollection> {
    const response = await fetch('/world2.geojson');
    const geojson = await response.json();
    return geojson;
}

/** Convert coordinates to 3D position.*/
function vertex([longitude, latitude]: number[], radius: number) {
    const lambda = (longitude - 90) * Math.PI / 180;
    const phi = latitude * Math.PI / 180;
    return new Vector3(
        radius * Math.cos(phi) * Math.cos(lambda),
        radius * Math.sin(phi),
        -radius * Math.cos(phi) * Math.sin(lambda)
    );
}

function sphere(radius: number, material: Material) {
    var geometry = new SphereGeometry(radius, 64, 64);
    return new Mesh(geometry, material);
}

function circle(radius: number, material: Material) {
    const geometry = new BufferGeometry();
    const vertices: Vector3[] = [];

    const segments = 128;

    for (var i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = radius * Math.cos(theta);
        const y = radius * Math.sin(theta);
        vertices.push(new Vector3(x, y, 0));
    }

    geometry.setFromPoints(vertices);
    const circle = new Line(geometry, material);

    return circle;
}

const deg2rad = Math.PI / 180;

function latLonGrid(radius: number): Line[] {
    const grid: Line[] = [];

    // Latitude lines (horizontal circles)
    for (var lat = -90; lat < 90; lat += 10) {
        const latLine = circle(radius, gridMat);
        latLine.position.y = radius * Math.sin(lat * deg2rad);
        latLine.scale.setScalar(Math.cos(lat * deg2rad)); // Decrease in size
        latLine.rotation.x = Math.PI / 2;
        grid.push(latLine);
    }

    // Longitude lines (vertical circles)
    for (var lon = 0; lon < 360; lon += 10) {
        var lonLine = circle(radius, gridMat);
        lonLine.rotation.y = lon * deg2rad;
        grid.push(lonLine);
    }

    return grid;
}

function linesFromPolygon(polygon: Polygon): Line[] {
    const lines: Line[] = [];

    polygon.coordinates.forEach(ring => {
        const points = ring.map(coord => vertex(coord, 1));

        // Close the loop by adding the first point at the end
        points.push(points[0]);

        const geometry = new BufferGeometry().setFromPoints(points);

        lines.push(new Line(geometry, borderMat));
    });

    return lines;
}

function linesFromMultiPolygon(multiPolygon: MultiPolygon): Line[] {
    const lines: Line[] = [];

    multiPolygon.coordinates.forEach(polygon => {
        polygon.forEach(ring => {
            const points = ring.map(coord => vertex(coord, 1));

            // Close the loop by adding the first point at the end
            points.push(points[0]);

            const geometry = new BufferGeometry().setFromPoints(points);

            lines.push(new Line(geometry, borderMat));
        });
    });

    return lines;
}

const canvas = shallowRef<HTMLCanvasElement>();

function rotationFromUTC() {
    // Get current UTC time
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000; // 60.000 ns in a minute

    // Calculate the rotation in radians
    const millisecondsInADay = 24 * 60 * 60 * 1000;
    const rotation = ((utcTime % millisecondsInADay) / millisecondsInADay) * (2 * Math.PI);

    // return rotation + (Math.PI / 2);
    return rotation;
}

function createCamera(window: Window) {
    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = -1000;
    return camera;
}

function createRenderer(canvas: HTMLCanvasElement | undefined, window: Window) {
    const renderer = new WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    return renderer;
}

function createOrbitControls(camera: PerspectiveCamera, renderer: WebGLRenderer) {
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.zoomSpeed = 10;
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.maxPolarAngle = Math.PI - (Math.PI / 6);
    controls.minPolarAngle = 0 + (Math.PI / 6);
    controls.rotateSpeed = 0.6;
    return controls;
}

function coordFromVector3(pos: Vector3) {
    pos = pos.normalize();

    const lat = radToDeg(Math.asin(pos.y));
    const lon = radToDeg(Math.atan2(pos.x, pos.z));

    return new Vector2(lon, lat);
}

class Country {
    public properties: any;
    public geometry: Polygon | MultiPolygon;
    public borders: Line[];

    constructor(data: Feature) {
        this.properties = data.properties;

        if (data.geometry.type == 'Polygon') {
            this.geometry = new Polygon(data);
            this.borders = linesFromPolygon(this.geometry);
        } else if (data.geometry.type === 'MultiPolygon') {
            this.geometry = new MultiPolygon(data);
            this.borders = linesFromMultiPolygon(this.geometry);
        } else {
            throw Error(data.geometry.type);
        }
    }

    public pointInBoundingBox(point: Vector2) {
        return this.geometry.pointInBoundingBox(point);
    }

    public pointWithinBorders(point: Vector2) {
        return this.geometry.pointInPolygon(point);
    }

    public updateColor(color: ColorRepresentation | undefined) {
        const mat = new LineBasicMaterial({ color, linewidth: 1 });

        this.borders.forEach(border => {
            border.material = mat;
        });
    }
}

class Globe {
    public node: Group;
    private borders: Line[];
    private countries: Country[];

    constructor(private data: FeatureCollection) {
        this.node = new Group();

        this.borders = [];
        this.countries = [];

        data.features.forEach(feature => {
            const country = new Country(feature);
            this.countries.push(country);
            this.borders.push(...country.borders);
        });

        this.node.add(sphere(0.9999, sphereMat));
        this.node.add(...this.borders);
        this.node.add(...latLonGrid(1.0001));
    }

    public scale(scale: number) {
        this.node.scale.setScalar(scale);
    }

    public rotate(angle: number) {
        this.node.rotation.y = angle;
    }

    public selectCountry(coord: Vector2): Country | null {
        const selection: Country[] = [];

        for (let i = 0; i < this.countries.length; i++) {
            if (this.countries[i].pointInBoundingBox(coord)) selection.push(this.countries[i]);
        }

        // We are not inside the bounding box of any country
        if (selection.length === 0) return null;

        for (let i = 0; i < selection.length; i++) {
            if (selection[i].pointWithinBorders(coord)) return selection[i];
        }

        // Handle edge-cases such as Lesotho and the Vatican which are inside other countries
        return null;
    }
}

let globe: Globe | undefined;

onMounted(() => {
    const camera = createCamera(window);
    const renderer = createRenderer(canvas.value, window);
    const controls = createOrbitControls(camera, renderer);

    const raycaster = new Raycaster();
    const mouse = new Vector2(-1, -1); // Initialized to top-left of the screen to avoid false intersections

    function onWindowResize() {
        const scale = Math.min(window.innerWidth, window.innerHeight);
        globe?.scale(scale);

        controls.minDistance = scale * 1.25;
        controls.maxDistance = scale * 2;
        controls.zoomSpeed = scale / 50;

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.near = 1;
        camera.far = scale * 4;

        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', onWindowResize, false);

    function onMouseMove(event: MouseEvent) {
        // Calculate normalized device coordinates (-1 to +1) for the mouse
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        mouseX.value = event.clientX;
        mouseY.value = event.clientY;
    }

    window.addEventListener('mousemove', onMouseMove, false);

    async function main() {
        const geojsonData = await loadGeoJson();

        globe = new Globe(geojsonData);

        const scene = new Scene();
        scene.add(globe.node);

        onWindowResize();
        animate();

        // An optimization would be to move selection to mouse move, window resize and zoom
        function animate() {
            globe?.rotate(rotationFromUTC());

            controls.update();

            raycaster.setFromCamera(mouse, camera);

            if (globe != null) {
                // Perform the raycast
                const intersects = raycaster.intersectObject(globe.node.children[0]);

                // Check for intersections
                if (intersects.length > 0) {
                    const intersection = intersects[0].point;
                    const localIntersection = globe.node.children[0].worldToLocal(intersection);
                    const coord = coordFromVector3(localIntersection);

                    const newSelected = globe.selectCountry(coord);
                    if (newSelected != selected) {
                        selected?.updateColor(borderMat.color);
                        selected = newSelected;
                        if (selected !== null) {
                            // selected.updateColor(0xdd1111);
                            selected.updateColor(0xffffff);
                            countryName.value = selected.properties.NAME_EN;
                            // console.log(selected.properties.NAME_EN);
                        } else {
                            countryName.value = '';
                        }
                    }
                }
            }


            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        }
    }

    main();
});
</script>