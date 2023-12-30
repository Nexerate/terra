<template>
    <div>
        <canvas ref="canvas" />
    </div>
</template>

<style lang="scss"></style>

<script setup lang='ts'>
import { Vector3, Line, LineSegments, BufferGeometry, LineBasicMaterial, Group, Scene, PerspectiveCamera, WebGLRenderer, Mesh, MeshBasicMaterial, SphereGeometry, Float32BufferAttribute } from 'three';

type Geometry = {
    type: string;
}

type Polygon = Geometry & {
    type: 'Polygon';
    coordinates: number[][][];
};

// Define the MultiPolygon type extending Geometry
type MultiPolygon = Geometry & {
    type: 'MultiPolygon';
    /** #### Outermost Array (MultiPolygon):
        - This array represents the entire MultiPolygon geometry.
        - It contains multiple elements, each corresponding to a single polygon.
        #### Second-Level Array (Polygon):
        - Each element in the outermost array represents a single polygon.
        - A polygon may have one or more rings (also known as shells or exterior and interior rings).
        #### Third-Level Array (Ring):
        - Each element in the second-level array represents a single ring.
        - The first ring is typically the exterior ring (shell), and subsequent rings are interior rings (holes).
        #### Innermost Array (Coordinate Pair):
        - Each element in the third-level array represents a coordinate pair (longitude and latitude).
        - The coordinate pairs define the vertices of the polygon.
    */
    coordinates: number[][][][];
};


type Feature = {
    geometry: Geometry;
}

type FeatureCollection = {
    features: Feature[];
}

const lineMat = new LineBasicMaterial({ color: 0xffffff, linewidth: 100, });

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

function sphere() {
    var geometry = new SphereGeometry(0.4999, 64, 64); // radius, widthSegments, heightSegments
    var material = new MeshBasicMaterial({ color: 0x18181e }); // You can customize color and other properties
    return new Mesh(geometry, material);
}

function circle(radius: number,) {
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
    const material = new LineBasicMaterial({ color: 0x696969, opacity: 0.1, transparent: true });
    const circle = new Line(geometry, material);

    return circle;
}

const deg2rad = Math.PI / 180;

function latLonGrid(radius: number): Line[] {
    const grid: Line[] = [];


    // Latitude lines (horizontal circles)
    for (var lat = -90; lat < 90; lat += 10) {
        // var latLine = circle(radius);
        // latLine.rotation.x = lat * (Math.PI / 180);
        // grid.push(latLine);
        const latLine = circle(radius);
        latLine.position.y = radius * Math.sin(lat * deg2rad);
        latLine.scale.setScalar(Math.cos(lat * deg2rad)); // Decrease in size
        latLine.rotation.x = Math.PI / 2;
        grid.push(latLine);
    }

    // Longitude lines (vertical circles)
    for (var lon = 0; lon < 360; lon += 10) {
        var lonLine = circle(radius);
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

        lines.push(new Line(geometry, lineMat));
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

            lines.push(new Line(geometry, lineMat));
        });
    });

    return lines;
}

const canvas = shallowRef<HTMLCanvasElement>();

onMounted(() => {
    const globe = new Group();

    // Create a perspective camera
    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Create a renderer
    const renderer = new WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    // document.body.appendChild(renderer.domElement);

    async function main() {
        try {
            const geojsonData = await loadGeoJson();
            const geometries = geometriesFromFeatureCollection(geojsonData);
            // const wireframes = wireframeFromMultiPolygons(multiPolygons);

            const wireframes: Line[] = [];

            geometries.forEach(geometry => {
                if (geometry.type == 'Polygon') wireframes.push(...linesFromPolygon(geometry as Polygon));
                if (geometry.type == 'MultiPolygon') wireframes.push(...linesFromMultiPolygon(geometry as MultiPolygon));
            });

            // Add wireframes to the globe group
            globe.add(sphere())
            globe.add(...wireframes);
            globe.add(...latLonGrid(0.501));

            // Add the globe group to your scene
            const scene = new Scene();
            scene.add(globe);

            animate();

            function animate() {
                const scale = Math.min(window.innerWidth, window.innerHeight);
                globe.scale.setScalar(scale);

                // Rotate the globe (adjust the rotation speed as needed)
                globe.rotation.y += 0.001;

                // Render the scene
                camera.position.set(0, scale * 0.6, scale * 0.6);
                camera.lookAt(0, 0, 0);
                renderer.render(scene, camera);

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