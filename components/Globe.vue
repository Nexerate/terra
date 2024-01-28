<template>
    <div ref="input">
        <canvas ref="canvas" />
        <div id="earthquakes">
            <div v-for="(eq, index) in eqReactive" :key="eq.id" class="earthquake" :style="{
                transform: `translate3d(${eq.transform!.x}px, ${eq.transform!.y}px, 0) scale(${eq.transform!.scale}) rotateZ(45deg)`,
                backgroundColor: eq.color,
                animationDelay: eq.delay ?? '0',
                pointerEvents: eq.pointerEvents ?? 'none'
            }"
            >
                <div v-if="eq.pulse" class="pulse" :style="{
                    borderColor: eq.color
                }">
                </div>
            </div>
            <TooltipProvider>
                <Tooltip :delay-duration="1000">
                    <TooltipTrigger as-child>
                        <Button :variant="null" :style="{
                            pointerEvents: 'all',
                            position: 'absolute',
                            left: `${mouseX - 5}px`, 
                            top: `${mouseY - 5}px`,
                            display: popoverData == null ? 'none' : 'block',
                            borderRadius: '0',
                            padding: '0',
                            rotate: '45deg',
                            width: '10px',
                            height: '10px',
                        }">
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent v-if="popoverData" class="popover-content">
                        <p><strong>Location:</strong> {{ popoverData.place }}</p>
                        <p><strong>Magnitude:</strong> {{ popoverData.magnitude }}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
        <p v-if="popoverData == null" id="country-label" ref="countryLabel" :style="{ left: (mouseX + 10) + 'px', top: (mouseY - 30) + 'px' }">
            {{ countryName }}
        </p>
    </div>
</template>

TODO: WASD Controls?
TODO: Move earthquake layer into its own vue component. As we add more features, it is important to keep
them in separate layers. The ability to turn on/off layers should also be possible. 
TODO: Panel with info when hovering earthquake (Place, Time, Magnitude)
TODO: Panel with info when hovering country (Population, GDP, Continent, Region, Type?, Link to Wikipedia?)

TODO: Custom orbit controls. WASD changes latitude and longitude. Ability to rotate to specific coordinate.

TODO: Clusters. Points close together should show up as a cluster. Cluster can be clicked to view points in a list. 

TODO: We may want to set anchor on pointer enter and have the trigger fllow the anchor until anchor moves
Trigger should also be disabled if we aren't hovering any earthquakes

Other than that, we may want to move our earthquakes 50% left and up as they are misplaced at the moment

In general, just make sure that the trigger can't be clicked unless we are hovering over an earthquake
Also make scale and position match perfectly

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

        // pointer-events: all;
        cursor: pointer;

        width: 10px;
        height: 10px;

        will-change: transform, backgroundColor;

        opacity: 0;
        animation: appear 1s forwards;
    }

    .earthquake::before {
        content: '';
        position: absolute;
        top: -8px;
        left: -8px;
        width: 26px;
        height: 26px;
        background: transparent;
        pointer-events: inherit;
        z-index: -1;
    }

    .pulse {
        position: absolute;

        left: 50%;
        top: 50%;

        transform: translate(-50%, -50%);

        border: 2px solid;

        box-sizing: border-box;

        animation: pulsate 1.5s ease-out;
        animation-iteration-count: infinite;
    }

    @keyframes appear {
        to {
            opacity: 1;
        }
    }

    @keyframes pulsate {
        0% {
            width: 10px;
            height: 10px;
            opacity: 0.0;
        }

        50% {
            opacity: 1.0;
        }

        100% {
            width: 25px;
            height: 25px;
            opacity: 0.0;
        }
    }
}

.popover-content {
    background-color: #050505f0;
    border: 1px solid #55555555;
    border-radius: 5px;
    padding: 5x 15px;
}

#country-label {
    position: absolute;
    color: white;
    font-size: 20px;
    pointer-events: none;
    user-select: none;

    text-shadow: 1px 1px 2px black;
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip'
// import { Button } from '@/components/ui/button'
// import { Popover, PopoverContent } from './ui/popover';

// import { PopoverArrow, PopoverClose, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'radix-vue';

const input = shallowRef<HTMLDivElement>();
const countryLabel = shallowRef<HTMLParagraphElement>();
const countryName = ref('');

const isPopoverOpen = ref(false);
const popoverData = ref<Earthquake | null>(null);
// const popoverPosition = ref({ top: 0, left: 0 });
// const popoverAnchor = ref<AsTag | undefined>(undefined);

// Function to open the popover and set content based on the clicked point
function openPopoverWithContent(data: Earthquake, trigger: Component) {
    isPopoverOpen.value = true;
    popoverData.value = data;
    // popoverAnchor.value = trigger;
    // popoverPosition.value = { left: pos.x, top: pos.y };
    // console.log(data);
}

// Example click handler for a point
function onPointClick(pointIndex: number, trigger: Component) {
    openPopoverWithContent(eqRaw.value[pointIndex], trigger);
}

const eqRaw = ref<Earthquake[]>([]);

type EqReactive = {
    id: string
    transform?: {
        x: string,
        y: string,
        scale: string,
    }
    color: string
    opacity: number,
    pulse?: boolean
    delay?: string
    pointerEvents?: 'none' | 'all'
};

const eqReactive = ref<EqReactive[]>([]);

function getClosestEarthquake() {
    if (!eqReactive.value) return; 

    const mouse = new Vector2(mouseX.value, mouseY.value);

    let closest = {
        distance: 20,
        i: -1,
    }

    for (let i = 0; i < eqReactive.value.length; i++) {
        const eq = eqReactive.value[i];
        
        if (eq.opacity < 0.5) continue;

        const eqX = Number(eq.transform!.x + 5); // Cancel out the -50% move we did earlier.
        const eqY = Number(eq.transform!.y + 5); // Cancel out the -50% move we did earlier.
        const distance = mouse.distanceTo(new Vector2(eqX, eqY));

        if (distance < closest.distance) {
            closest.distance = distance;
            closest.i = i;
        }
    }
    
    if (closest.i >= 0) {
        popoverData.value = eqRaw.value[closest.i];
    } else {
        popoverData.value = null;
    }
}

function updateReactive(data: Earthquake[]): EqReactive[] {
    return data.map(eq => {
        const worldPos = eq.getWorldPos();

        if (!worldPos) return { id: '', color: 'white', opacity: 0 };

        const screenPos = eq.getScreenPos(worldPos);
        const opacity = eq.getOpacity(worldPos);

        if (!screenPos || !opacity) return { id: '', color: 'white', opacity: 0 };

        const x = (screenPos.x - 5).toFixed(2); // -50% of width
        const y = (screenPos.y - 5).toFixed(2); // -50% of height

        const scale = eq.getScale().toFixed(2);
        const color = eq.getColor(opacity * 2);

        const pulse = areDatesWithinXHours(Date.now(), eq.time, 24);

        const delay = `${eq.delay}s`;
        const pointerEvents = opacity < 0.5 ? 'none' : 'all';

        return {
            id: eq.id,
            transform: {
                x,
                y,
                scale,
            },
            opacity,
            // transform: `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotateZ(45deg)`,
            color,
            pulse,
            delay,
            pointerEvents,
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
function areDatesWithinXHours(time1: number, time2: number, x: number): boolean {
    // Calculate the difference in time between the two dates
    const differenceInMilliseconds = Math.abs(time1 - time2);

    return differenceInMilliseconds <= x * 3600000; // x * ms in an hour
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

    const polarConstraint = 30;

    controls.enableDamping = true;
    controls.maxPolarAngle = (180 - polarConstraint) * deg2rad;
    controls.minPolarAngle = polarConstraint * deg2rad;
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

    delay: number;

    constructor(data: EQFeature) {
        this.id = data.id;
        this.magnitude = data.properties.mag;
        this.place = data.properties.place;
        this.origin = data.geometry.coordinates;
        this.time = data.properties.time;

        this.delay = 2 + (Math.random() * 2);
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
            getClosestEarthquake();

            animationFrameId = requestAnimationFrame(animate);
        }

        const time = new Date(Date.now() - 86_400_000 * 7).toISOString()
        const eqData = await getEarthquakes(time, 5); // Appears to be YYYY-MM-DD

        if (eqData) {
            eqRaw.value = eqData.map(eq => {
                return new Earthquake(eq);
            });
            console.log(eqRaw.value.length);
        }

    }

    main();
});
</script>