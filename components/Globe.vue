<template>
    <div ref="input">
        <canvas ref="canvas" />
        <div id="earthquakes">
            <div v-for="eq in eqReactive" :key="eq.id" class="earthquake" :style="{
                transform: eq.transform,
                backgroundColor: eq.color,
            }">
            </div>
        </div>
        <p id="country-label" ref="countryLabel" :style="{ left: (mouseX + 10) + 'px', top: (mouseY - 30) + 'px' }">
            {{ countryName }}
        </p>
    </div>
</template>

TODO: Modularize and refactor
TODO: WASD Controls?

Motion blur could enhance this effect even more
As the globe starts to slow down, earthquakes will start popping up at random places with randomized intervals

<style lang="scss">
canvas {
    user-select: none;
    position: absolute;
}

#input {
    overflow: hidden;
    cursor: pointer;
    user-select: none;
}

#earthquakes {
    position: fixed;
    pointer-events: none;
    width: 100%;
    height: 100%;

    transform-style: preserve-3d;

    .earthquake {
        position: absolute;

        width: 8px;
        height: 8px;

        // border-radius: 4px;

        will-change: transform, backgroundColor;
    }
}


#country-label {
    position: absolute;
    color: white;
    font-size: 20px;
    pointer-events: none;
    user-select: none;
}
</style>

Earthquakes are circles until they become visible on the globe (use dot product)
Once an earthquake becomes visible it animates to an orange square sign with an earthquake icon
If you rotate the globe, it may animate back to a circle
If you hover the square sign, the border starts "breathing". 
It goes out, then in again and will do that until you click or stop hover

Ongoing earthquakes may pulsate or have rings coming out of them.

<script setup lang='ts'>
import { Box2, BufferGeometry, Group, Line, LineBasicMaterial, Material, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Raycaster, Scene, SphereGeometry, Vector2, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { lerp, radToDeg } from 'three/src/math/MathUtils';
import { getEarthquakes, type EQDataSummary } from '../server/earthquake';
import { Animator, RotateAnimation, ScaleAnimation, SimpleAnimation } from '../server/animator';
import { Easing } from '../server/easing';

// Materials
const borderMat = new LineBasicMaterial({ color: 0x555555 });
const borderHoverMat = new LineBasicMaterial({ color: 0xffffff });
const borderSelectedMat = new LineBasicMaterial({ color: 0xff8400 });
const gridMat = new LineBasicMaterial({ color: 0x1b1b1b });
const sphereMat = new MeshBasicMaterial({ color: 0x080808, opacity: 0.9, transparent: true });

const input = shallowRef<HTMLDivElement>();
const countryLabel = shallowRef<HTMLParagraphElement>();
const countryName = ref('');

const eqRaw = ref<Earthquake[]>([]);
const eqReactive = ref<{
    id: string,
    transform: string,
    color: string,
}[]>([]);

function updateReactive(data: Earthquake[]) {
    return data.map(eq => {
        const worldPos = eq.getWorldPos();

        if (!worldPos) return { id: '', transform: '', color: 'white' };

        const screenPos = eq.getScreenPos(worldPos);
        const opacity = eq.getOpacity(worldPos);

        if (!screenPos || !opacity) return { id: '', transform: '', color: 'white' };

        const x = screenPos.x.toFixed(2);
        const y = screenPos.y.toFixed(2);

        const scale = eq.getScale();
        const color = eq.getColor(opacity * 2);

        return {
            id: eq.id,
            transform: `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotateZ(45deg)`,
            color: color,
        };
    });
}

// When raw data changes, update the reactive data
watch(eqRaw, () => {
    eqReactive.value = updateReactive(eqRaw.value);
});

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

let hovered: Country | null = null;
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
    const response = await fetch('/world.geojson');
    const geojson = await response.json();
    return geojson;
}

/** Convert coordinates to 3D position.*/
function vertex([longitude, latitude]: number[], radius: number) {
    const lambda = (longitude - 90) * deg2rad;
    const phi = latitude * deg2rad;
    return new Vector3(
        radius * Math.cos(phi) * Math.cos(lambda),
        radius * Math.sin(phi),
        -radius * Math.cos(phi) * Math.sin(lambda)
    );
}

function sphere(radius: number, material: Material) {
    var geometry = new SphereGeometry(radius, 48, 24);
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
    const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = -1;
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

    controls.enableDamping = true;
    controls.maxPolarAngle = (180 - 15) * deg2rad;
    controls.minPolarAngle = 15 * deg2rad;
    controls.rotateSpeed = 0.5;
    controls.enablePan = false;

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
    public node: Object3D;
    private borders: Line[];

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

        this.node = new Object3D();

        for (const border of this.borders) {
            this.node.add(border);
        }
    }

    public scale(scale: number) {
        this.node.scale.setScalar(scale);
    }

    private focusAnim: ScaleAnimation | undefined;
    private unfocusAnim: ScaleAnimation | undefined;

    focus() {
        this.unfocusAnim?.stop();
        this.unfocusAnim = undefined;

        this.focusAnim = new ScaleAnimation(this.node, 0.5, this.node.scale.x, 1.01, Easing.easeInCubic);
        this.focusAnim.play();

        this.updateMaterial(borderHoverMat);
    }

    unfocus() {
        this.focusAnim?.stop();
        this.focusAnim = undefined;

        this.unfocusAnim = new ScaleAnimation(this.node, 0.5, this.node.scale.x, 1.0, Easing.linear);
        this.unfocusAnim.play();

        this.updateMaterial(borderMat);
    }

    public pointInBoundingBox(point: Vector2) {
        return this.geometry.pointInBoundingBox(point);
    }

    public pointWithinBorders(point: Vector2) {
        return this.geometry.pointInPolygon(point);
    }

    private updateMaterial(material: LineBasicMaterial) {
        this.borders.forEach(border => {
            border.material = material;
        });
    }
}

class Globe {
    public node: Group;
    // private borders: Line[];
    private countries: Country[];

    constructor(private data: FeatureCollection) {
        this.node = new Group();

        // this.borders = [];
        this.countries = [];

        data.features.forEach(feature => {
            const country = new Country(feature);
            this.countries.push(country);
            // this.borders.push(...country.borders);
        });

        this.node.add(sphere(0.9999, sphereMat));
        for (const country of this.countries) {
            this.node.add(country.node);
        }
        // this.node.add(...this.borders);
        this.node.add(...latLonGrid(1.0001));


        this.rotate(rotationFromUTC());
    }

    public scale(scale: number) {
        this.node.scale.setScalar(scale);
    }

    public rotate(angle: number) {
        this.node.rotation.y = angle;
    }

    public getScale = () => this.node.scale.x;
    public getRotation = () => this.node.rotation.y;

    public selectCountry(coord: Vector2): Country | null {
        const selection: Country[] = [];

        for (let i = 0; i < this.countries.length; i++) {
            if (this.countries[i].pointInBoundingBox(coord)) selection.push(this.countries[i]);
        }

        // We are not inside the bounding box of any country
        if (selection.length === 0) return null;

        for (let i = selection.length - 1; i >= 0; i--) {
            if (selection[i].pointWithinBorders(coord)) return selection[i];
        }

        return null;
    }
}

class Earthquake {
    public id: string;
    public place: string;
    public magnitude: number;
    public origin: number[];

    constructor(data: EQDataSummary) {
        this.id = data.id;
        this.magnitude = data.mag;
        this.place = data.place;
        this.origin = data.coordinates;
    }

    public getWorldPos() {
        if (!globe) return undefined;

        const point = vertex(this.origin, globe.getScale());
        return point.applyAxisAngle(new Vector3(0, 1, 0), globe.getRotation());
    }

    /** Convert earthquake origin to screen position. */
    public getScreenPos(worldPos: Vector3) {
        if (!camera) return undefined;

        const projected = worldPos.clone().project(camera);

        return new Vector2(
            (projected.x + 1) * window.innerWidth / 2,
            (-projected.y + 1) * window.innerHeight / 2,
        );
    }

    /** 10 is max magnitude, so anything above 5 will be enlarged. Anything else will be shrunk. */
    public getScale() {
        return this.magnitude / 5;
    }

    public getOpacity(worldPos: Vector3) {
        if (!camera) return undefined

        const a = camera.getWorldDirection(new Vector3()).negate().normalize();
        const b = worldPos.normalize().clone();

        return Math.min(Math.max(a.dot(b), 0.05), 1);
    }

    public getColor(opacity: number) {
        if (this.magnitude < 3) return `rgba(0, 255, 0, ${opacity})`;   // Green - Low
        if (this.magnitude < 5) return `rgba(255, 255, 0, ${opacity})`; // Yellow - Moderate
        if (this.magnitude < 7) return `rgba(255, 128, 0, ${opacity})`; // Orange - Strong
        return `rgba(255, 0, 0, ${opacity})`;                            // Red - Severe
    }
}

let globe: Globe | undefined;
let camera: PerspectiveCamera | undefined;

let animationFrameId: number = 0;

onBeforeUnmount(() => {
    cancelAnimationFrame(animationFrameId);
});

onMounted(() => {
    camera = createCamera(window);
    const renderer = createRenderer(canvas.value, window);
    const controls = createOrbitControls(camera, renderer);

    const raycaster = new Raycaster();
    const mouse = new Vector2(-1, -1); // Initialized to top-left of the screen to avoid false intersections

    function onWindowResize() {
        const scale = Math.min(window.innerWidth, window.innerHeight);
        globe?.scale(scale);

        controls.minDistance = scale * 1.8;
        controls.maxDistance = scale * 1.8;
        // controls.minDistance = scale * 1.25;
        // controls.maxDistance = scale * 2;
        // controls.zoomSpeed = scale / 50;

        if (camera) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.near = 1;
            camera.far = scale * 4;

            camera.updateProjectionMatrix();
        }
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

    // function onClick(event: MouseEvent) {
    //     if (selected === hovered) return;

    //     selected?.updateMaterial(borderMat);
    //     selected = hovered;
    //     selected?.updateMaterial(borderSelectedMat);
    // }

    window.addEventListener('mousemove', onMouseMove, false);
    // window.addEventListener('contextmenu', onClick);

    let lastFrameTime = 0;

    async function main() {
        const geojsonData = await loadGeoJson();

        globe = new Globe(geojsonData);

        const scene = new Scene();
        scene.add(globe.node);

        onWindowResize();
        animate(0);

        if (camera) {
            camera.position.z = Math.min(window.innerWidth, window.innerHeight) * -2;
        }

        const scale = globe.getScale();
        const rot = globe.getRotation();

        new ScaleAnimation(globe.node, 2, scale / 10, scale, Easing.easeOutCubic).play();
        new RotateAnimation(globe.node, 3, rot, rot + Math.PI * 2, Easing.easeOutCubic).play();

        // An optimization would be to move selection to mouse move, window resize and zoom
        function animate(time: number) {
            // globe?.rotate(globe.node.rotation.y + (Math.PI / 100000));
            
            // Convert time to seconds
            time *= 0.001;

            // Calculate delta time in seconds
            const deltaTime = time - lastFrameTime;
            lastFrameTime = time;

            controls.update();
            Animator.update(deltaTime);

            // const distanceT = remap(controls.getDistance(), controls.minDistance, controls.maxDistance, 0, 1);
            // controls.rotateSpeed = lerp(0.2, 0.5, distanceT);

            if (camera && globe) {
                // Perform the raycast
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObject(globe.node.children[0]);

                // This is getting convoluted. Move to dedicated classes

                // Check for intersections
                if (intersects.length > 0) {
                    const intersection = intersects[0].point;
                    const localIntersection = globe.node.children[0].worldToLocal(intersection);
                    const coord = coordFromVector3(localIntersection);

                    const newHovered = globe.selectCountry(coord);
                    if (newHovered !== hovered) {
                        if (hovered !== selected) {
                            // hovered?.updateMaterial(borderMat);
                            // hovered?.scale(1);
                            hovered?.unfocus();
                        }
                        hovered = newHovered;

                        if (hovered !== null) {
                            countryName.value = hovered.properties.NAME_EN;
                            // hovered.scale(1.01);

                            if (hovered !== selected) {
                                // hovered.updateMaterial(borderHoverMat);
                                hovered.focus();
                            }
                        } else {
                            countryName.value = '';
                        }
                    }
                } else if (hovered != null) {
                    if (hovered !== selected) {
                        hovered.unfocus();
                        // hovered.updateMaterial(borderMat);
                    }
                    hovered = null;
                    countryName.value = '';
                }
            }

            if (camera) {
                renderer.render(scene, camera);
            }

            eqReactive.value = updateReactive(eqRaw.value);

            animationFrameId = requestAnimationFrame(animate);
        }

        const eqData = await getEarthquakes('2024-01-01', 6);
        const newData = eqData?.map(eq => {
            return new Earthquake(eq);
        });

        if (newData) {
            eqRaw.value = newData;
        }

        console.log(newData?.length);
    }

    main();
});
</script>