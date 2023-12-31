<template>
    <div ref="input">
        <canvas ref="canvas" />
    </div>
</template>

<style lang="scss">
div {
    overflow: hidden;
}
</style>

<script setup lang='ts'>
import { Vector3, Line, BufferGeometry, LineBasicMaterial, Group, Scene, PerspectiveCamera, WebGLRenderer, Mesh, MeshBasicMaterial, SphereGeometry, Float32BufferAttribute, Material } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

type Geometry = {
    type: string;
}

type Polygon = Geometry & {
    type: 'Polygon';
    coordinates: number[][][];
};

type MultiPolygon = Geometry & {
    type: 'MultiPolygon';
    coordinates: number[][][][];
};

type Feature = {
    geometry: Geometry;
}

type FeatureCollection = {
    features: Feature[];
}

const input = shallowRef<HTMLDivElement>();

const borderMat = new LineBasicMaterial({ color: 0xdddddd });
const gridMat = new LineBasicMaterial({ color: 0x696969, opacity: 0.1, transparent: true });
const sphereMat = new MeshBasicMaterial({ color: 0x101011, opacity: 0.95, transparent: true });

async function loadGeoJson(): Promise<FeatureCollection> {
    const response = await fetch('/world2.geojson');
    const geojson = await response.json();
    return geojson;
}

/** Convert coordinates to 3D position.*/
function vertex([longitude, latitude]: number[], radius: number) {
    const lambda = longitude * Math.PI / 180;
    const phi = latitude * Math.PI / 180;
    return new Vector3(
        radius * Math.cos(phi) * Math.cos(lambda),
        radius * Math.sin(phi),
        -radius * Math.cos(phi) * Math.sin(lambda)
    );
}

function geometriesFromFeatureCollection(geojson: FeatureCollection) {
    return geojson.features.map(feature => feature.geometry);
}

function sphere(radius: number, material: Material) {
    var geometry = new SphereGeometry(radius, 64, 64);
    return new Mesh(geometry, material);
}

function circle(radius: number, material: Material) {
    const geometry = new BufferGeometry();
    const vertices = [];

    // Number of segments in the circle
    const segments = 128;

    for (var i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = radius * Math.cos(theta);
        const y = radius * Math.sin(theta);
        vertices.push(x, y, 0);
    }

    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
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


onMounted(() => {
    const globe = new Group();

    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 1000;

    // Create a renderer
    const renderer = new WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Create OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.zoomSpeed = 10;
    controls.enableDamping = true;
    controls.dampingFactor = 0.2;
    controls.maxPolarAngle = Math.PI - (Math.PI / 5);
    controls.minPolarAngle = 0 + (Math.PI / 5);

    // Function to handle window resizing
    function onWindowResize() {
        const scale = Math.min(window.innerWidth, window.innerHeight);
        globe.scale.setScalar(scale);

        controls.minDistance = scale / 1.5;
        controls.maxDistance = scale * 2;
        controls.zoomSpeed = scale / 50;

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.near = 1;
        camera.far = scale * 2,

        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();

    async function main() {
        try {
            const geojsonData = await loadGeoJson();
            const geometries = geometriesFromFeatureCollection(geojsonData);

            const wireframes: Line[] = [];

            geometries.forEach(geometry => {
                if (geometry.type == 'Polygon') wireframes.push(...linesFromPolygon(geometry as Polygon));
                if (geometry.type == 'MultiPolygon') wireframes.push(...linesFromMultiPolygon(geometry as MultiPolygon));
            });

            // Add wireframes to the globe group
            globe.add(sphere(0.4999, sphereMat));
            globe.add(...wireframes);
            globe.add(...latLonGrid(0.501));

            // Add the globe group to your scene
            const scene = new Scene();
            scene.add(globe);

            animate();

            function animate() {
                // Rotate the globe (adjust the rotation speed as needed)
                globe.rotation.y += 0.001;

                // camera.position.normalize().multiplyScalar(scale * controls.getDistance());
                // camera.position.set(0, 0, scale);

                camera.updateProjectionMatrix();
                renderer.render(scene, camera);

                controls.update();

                // Request the next frame
                requestAnimationFrame(animate);
            }
        } catch (error) {
            console.error('Error loading GeoJSON:', error);
        }
    }

    main();
});
</script>