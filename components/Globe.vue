<template>
    <div ref="input">
        <canvas ref="canvas" />
        <div id="earthquakes">
            <div v-for="eq in eqReactive" :key="eq.id" class="earthquake" :style="{
                transform: eq.transform,
                backgroundColor: eq.color,
            }">
                <div v-if="eq.pulse" class="pulse" :style="{
                    borderColor: eq.color
                }">
                </div>
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

        pointer-events: all;
        cursor: pointer;

        width: 8px;
        height: 8px;

        will-change: transform, backgroundColor;
    }

    .earthquake::before {
        content: '';
        position: absolute;
        top: -4px;
        left: -4px;
        width: 16px;
        height: 16px;
        background: transparent;
        pointer-events: all;
        z-index: -1;
    }

    .pulse {
        position: absolute;

        left: 50%;
        top: 50%;

        transform: translate(-50%, -50%);

        border: 1px solid;

        box-sizing: border-box;

        animation: pulsate 2s ease-out;
        animation-iteration-count: infinite;
    }

    @keyframes pulsate {
        0% {
            width: 8px;
            height: 8px;
            opacity: 0.0;
        }

        50% {
            opacity: 1.0;
        }

        100% {
            width: 16px;
            height: 16px;
            opacity: 0.0;
        }
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
If you hover the square sign, the border starts "breathing" or "pulsing". 
It goes out, then in again and will do that until you click or stop hover

Ongoing earthquakes may pulsate or have rings coming out of them.

<script setup lang='ts'>
import { PerspectiveCamera, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { radToDeg } from 'three/src/math/MathUtils';
import { Animator, RotateAnimation, ScaleAnimation } from '../server/animator';
import { getEarthquakes, type EQFeature } from '../server/earthquake';
import { Easing } from '../server/easing';
import type { FeatureCollection } from '../server/globe/geojson';
import { Globe, type Country } from '../server/globe/globe';
import { Geometry } from '../server/globe/geometry';

const input = shallowRef<HTMLDivElement>();
const countryLabel = shallowRef<HTMLParagraphElement>();
const countryName = ref('');

const eqRaw = ref<Earthquake[]>([]);
const eqReactive = ref<{
    id: string,
    transform: string,
    color: string,
    pulse?: boolean,
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

        const pulse = areDatesWithin24Hours(Date.now(), eq.time);

        return {
            id: eq.id,
            transform: `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotateZ(45deg)`,
            color,
            pulse,
        };
    });
}

// When raw data changes, update the reactive data
watch(eqRaw, () => {
    eqReactive.value = updateReactive(eqRaw.value);
});

const mouseX = ref(0);
const mouseY = ref(0);

let hovered: Country | null = null;
let selected: Country | null = null;

async function loadGeoJson(): Promise<FeatureCollection> {
    const response = await fetch('/world.geojson');
    const geojson = await response.json();
    return geojson;
}

const deg2rad = Math.PI / 180;

const canvas = shallowRef<HTMLCanvasElement>();

function rotationFromUTC() {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000; // 60.000 ns in a minute

    // Calculate the rotation in radians
    const millisecondsInADay = 24 * 60 * 60 * 1000;
    const rotation = ((utcTime % millisecondsInADay) / millisecondsInADay) * (2 * Math.PI);

    // return rotation + (Math.PI / 2);
    return rotation;
}

/** time1 and time2 should be derived from Dates. */
function areDatesWithin24Hours(time1: number, time2: number): boolean {
    // Get the time value (in milliseconds) of both dates
    // const time1 = date1.getTime();
    // const time2 = date2.getTime();

    // Calculate the difference in time between the two dates
    const differenceInMilliseconds = Math.abs(time1 - time2);

    // Check if the difference is 24 hours or less
    // 24 hours = 24 * 60 minutes/hour * 60 seconds/minute * 1000 milliseconds/second
    return differenceInMilliseconds <= 86_400_000; // ms in a day
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

class Earthquake {
    id: string;
    place: string;
    magnitude: number;
    origin: number[];
    time: number;

    constructor(data: EQFeature) {
        this.id = data.id;
        this.magnitude = data.properties.mag;
        this.place = data.properties.place;
        this.origin = data.geometry.coordinates;
        this.time = data.properties.time;
    }

    public getWorldPos() {
        if (!globe) return undefined;

        const point = Geometry.vertex(this.origin, globe.getScale());
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
        if (this.magnitude < 3) return `rgba(46, 204, 103, ${opacity})`; // Green - Low
        if (this.magnitude < 5) return `rgba(241, 196, 15, ${opacity})`; // Yellow - Moderate
        if (this.magnitude < 7) return `rgba(230, 126, 34, ${opacity})`; // Orange - Strong
        return `rgba(321, 76, 60, ${opacity})`;                          // Red - Severe
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

        controls.minDistance = scale * 2.1;
        controls.maxDistance = scale * 2.1;
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
        globe.rotate(rotationFromUTC());

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

        const eqData = await getEarthquakes('2024-01-01', 5); // Appears to be YYYY-MM-DD
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