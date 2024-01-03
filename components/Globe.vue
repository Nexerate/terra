<template>
    <div ref="input">
        <canvas ref="canvas" />
    </div>
</template>

<style lang="scss">
div {
    overflow: hidden;
    cursor: grab;
}
</style>

<script setup lang='ts'>
import { Vector3, Line, BufferGeometry, LineBasicMaterial, Group, Scene, PerspectiveCamera, WebGLRenderer, Mesh, MeshBasicMaterial, SphereGeometry, Float32BufferAttribute, Material, Box2, Vector2, Raycaster } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { degToRad, radToDeg } from 'three/src/math/MathUtils';

abstract class Geometry {
    public abstract type: string;
    protected boundingBox: Box2 | null = null;

    constructor(protected data: Feature) {
        this.computeBoundingBox();
    }

    protected abstract computeBoundingBox(): void;

    public abstract pointInside(coord: Vector2): boolean;

    protected windingNumber(point: Vector2, points: number[][]): boolean {
        let wn = 0; // Winding number

        for (let i = 0; i < points.length; i++) {
            const vertex1 = new Vector2(points[i][0], points[i][1]);
            const i2 = (i + 1) % points.length;
            const vertex2 = new Vector2(points[i2][0], points[i2][1]);

            if (vertex1.y <= point.y) {
                if (vertex2.y > point.y && this.isLeft(vertex1, vertex2, point) > 0) {
                    wn++;
                }
            } else {
                if (vertex2.y <= point.y && this.isLeft(vertex1, vertex2, point) < 0) {
                    wn--;
                }
            }
        }

        return wn === 0;
    }

    // Helper function to determine if a point is to the left of a line
    private isLeft(p0: Vector2, p1: Vector2, p2: Vector2): number {
        return (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
    }
}

class Polygon extends Geometry {
    public type = 'Polygon';
    public coordinates: number[][][];

    constructor(data: Feature) {
        super(data);

        if (data.geometry.type !== this.type) {
            throw new Error('Invalid geometry type. Expected "Polygon".');
        }

        this.coordinates = (data.geometry as Polygon).coordinates;
    }

    protected computeBoundingBox(): void {
        const min = new Vector2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
        const max = new Vector2(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

        this.coordinates.forEach(ring => {
            ring.forEach(coord => {
                min.x = Math.min(coord[0], min.x);
                min.y = Math.min(coord[1], min.y);
                max.x = Math.max(coord[0], max.x);
                max.y = Math.max(coord[1], max.y);
            });
        });

        this.boundingBox = new Box2(min, max);
    }

    public pointInside(coord: Vector2): boolean {
        if (!this.boundingBox?.containsPoint(coord)) return false;

        for (let i = 0; i < this.coordinates.length; i++) {
            if (this.windingNumber(coord, this.coordinates[i])) return true;
        }

        return false;
    }
}

let selected: Country | null = null;

class MultiPolygon extends Geometry {
    public type = 'MultiPolygon';
    public coordinates: number[][][][];

    constructor(data: Feature) {
        super(data);

        if (data.geometry.type !== this.type) {
            throw new Error('Invalid geometry type. Expected "MultiPolygon".');
        }

        this.coordinates = (data.geometry as MultiPolygon).coordinates;
    }

    protected computeBoundingBox(): void {
        const min = new Vector2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
        const max = new Vector2(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

        this.coordinates.forEach(polygon => {
            polygon.forEach(ring => {
                ring.forEach(coord => {
                    min.x = Math.min(coord[0], min.x);
                    min.y = Math.min(coord[1], min.y);
                    max.x = Math.max(coord[0], max.x);
                    max.y = Math.max(coord[1], max.y);
                });
            });
        })
    }

    public pointInside(coord: Vector2): boolean {
        if (!this.boundingBox?.containsPoint(coord)) return false;

        for (let i = 0; i < this.coordinates.length; i++) {
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

const input = shallowRef<HTMLDivElement>();

const borderMat = new LineBasicMaterial({ color: 0xdddddd });
const gridMat = new LineBasicMaterial({ color: 0x1a1a1a });
const sphereMat = new MeshBasicMaterial({ color: 0x101011, opacity: 0.95, transparent: true });

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
        const points = ring.map(coord => vertex(coord, 0.5));

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
            const points = ring.map(coord => vertex(coord, 0.5));

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

// function coordFromVector3(position: Vector3, sphereRadius: number) {
//     const lat = Math.acos(position.y / sphereRadius); //theta
//     const lon = Math.atan(position.x / position.z); //phi
//     return [lat, lon];
// }

function coordFromVector3(pos: Vector3) {
    pos = pos.normalize();

    const lat = radToDeg(Math.asin(pos.y));
    const lon = radToDeg(Math.atan2(pos.x, pos.z));

    // Longitude is 90 degrees off thanks to our conversion in vertex()

    return [lat, lon];
    // let longitude = Math.atan2(pos.y, pos.x);
    // let latitude = Math.asin(pos.z);

    // // Convert radians to degrees if necessary
    // longitude = radToDeg(longitude);
    // latitude = radToDeg(latitude);

    // return [latitude, longitude];
}

class Country {
    public properties: any;
    public coordinates: number[][][][];
    public borders: Line[];
    public boundingBox: Box2 | null = null;

    // TODO: 2d bounding box

    constructor(data: Feature) {
        const geo = data.geometry;
        if (geo.type == 'Polygon') {
            this.borders = linesFromPolygon(geo as Polygon);
            this.coordinates = [];
            this.coordinates.push((geo as Polygon).coordinates);
        }
        else {
            this.borders = linesFromMultiPolygon(geo as MultiPolygon);
            this.coordinates = (geo as MultiPolygon).coordinates;
        }
    }

    private computeBoundingBox() {
        const min = new Vector2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
        const max = new Vector2(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

        this.coordinates.forEach(polygon => {
            polygon.forEach(ring => {
                ring.forEach(coord => {
                    min.x = Math.min(coord[0], min.x);
                    min.y = Math.min(coord[1], min.y);
                    max.x = Math.max(coord[0], max.x);
                    max.y = Math.max(coord[1], max.y);
                });
            });
        });

        this.boundingBox = new Box2(min, max);
    }

    public coordInside(coord: Vector2) {
        if (!this.boundingBox?.containsPoint(coord)) return false;


        // If inside bounding box, perform winding number
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

        this.node.add(sphere(0.4999, sphereMat));
        this.node.add(...this.borders);
        this.node.add(...latLonGrid(0.501));

        this.computeBoundingBoxes();
    }

    private computeBoundingBoxes() {
        this.borders.forEach(border => {
            border.geometry.computeBoundingBox();
        });
    }

    private countryIntersect(point: Vector3) {
        const intersections: Line[] = [];

        for (let i = 0; i < this.borders.length; i++) {
            const insideBox = this.borders[i].geometry.boundingBox?.containsPoint(point);

            if (!insideBox) continue;

            intersections.push(this.borders[i]);
        }

        if (intersections.length == 0) return null;


    }

    public scale(scale: number) {
        this.node.scale.setScalar(scale);
    }

    public rotate(angle: number) {
        this.node.rotation.y = angle;
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

        controls.minDistance = scale / 1.5;
        controls.maxDistance = scale * 2;
        controls.zoomSpeed = scale / 50;

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.near = 1;
        camera.far = scale * 2;

        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', onWindowResize, false);

    function onMouseMove(event: MouseEvent) {
        // Calculate normalized device coordinates (-1 to +1) for the mouse
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    window.addEventListener('mousemove', onMouseMove, false);

    async function main() {
        const geojsonData = await loadGeoJson();

        globe = new Globe(geojsonData);

        const scene = new Scene();
        scene.add(globe.node);

        onWindowResize();
        animate();

        function animate() {
            globe?.rotate(rotationFromUTC());

            controls.update();

            raycaster.setFromCamera(mouse, camera);

            if (globe != null) {
                // Perform the raycast
                const intersects = raycaster.intersectObjects([globe.node.children[0]]);
    
                // Check for intersections
                if (intersects.length > 0) {
                    const intersection = intersects[0].point;
                    const localIntersection = globe.node.worldToLocal(intersection);
                    const coord = coordFromVector3(localIntersection);
                    console.clear();
                    console.log("(" + coord[0].toFixed(1) + "," + coord[1].toFixed(1) + ")");
                    // console.log("Intersected object:", selectedObject);
                }
            }


            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        }
    }

    main();
});
</script>