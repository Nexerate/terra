// import { Vector3, LineSegments, BufferGeometry, LineBasicMaterial, Group, Scene, PerspectiveCamera, WebGLRenderer } from "three";


// type Feature = {
//     geometry: MultiPolygon;
// }

// type FeatureCollection = {
//     features: Feature[];
// }

// /** Each country is represented as a MultiPolygon.*/
// class MultiPolygon {
//     /** #### Outermost Array (MultiPolygon):
//         - This array represents the entire MultiPolygon geometry.
//         - It contains multiple elements, each corresponding to a single polygon.
//         #### Second-Level Array (Polygon):
//         - Each element in the outermost array represents a single polygon.
//         - A polygon may have one or more rings (also known as shells or exterior and interior rings).
//         #### Third-Level Array (Ring):
//         - Each element in the second-level array represents a single ring.
//         - The first ring is typically the exterior ring (shell), and subsequent rings are interior rings (holes).
//         #### Innermost Array (Coordinate Pair):
//         - Each element in the third-level array represents a coordinate pair (longitude and latitude).
//         - The coordinate pairs define the vertices of the polygon.
//     */
//     public coordinates: number[][][][] = [];
// }

// const lineMat = new LineBasicMaterial({ color: 0xffffff });
// const radius = 1000;

// async function loadGeoJson(): Promise<FeatureCollection> {
//     const response = await fetch("./world2.geojson");
//     const geojson = await response.json();
//     return geojson;
// }

// /** Convert coordinates to 3D position.*/
// function vertex([longitude, latitude]: number[], radius: number) {
//     const lambda = longitude * Math.PI / 180;
//     const phi = latitude * Math.PI / 180;
//     return new Vector3(
//         radius * Math.cos(phi) * Math.cos(lambda),
//         radius * Math.sin(phi),
//         -radius * Math.cos(phi) * Math.sin(lambda)
//     );
// }

// function multiPolygonsFromFeatureCollection(geojson: FeatureCollection) {
//     return geojson.features.map(feature => feature.geometry);
// }

// function wireframeFromMultiPolygons(multiPolygons: MultiPolygon[]): LineSegments[] {
//     const lines: LineSegments[] = [];

//     multiPolygons.forEach(multiPolygon => {
//         multiPolygon.coordinates.forEach(polygon => {
//             polygon.forEach(ring => {
//                 const points = ring.map(coord => vertex(coord, radius));

//                 // Close the loop by adding the first point at the end
//                 points.push(points[0]);

//                 const geometry = new BufferGeometry().setFromPoints(points);

//                 lines.push(new LineSegments(geometry, lineMat));
//             });
//         });
//     });

//     return lines;
// }

// const globe = new Group();

// // Create a perspective camera
// const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
// camera.position.set(0, 0, 1500);
// camera.lookAt(0, 0, 0);

// // Create a renderer
// const renderer = new WebGLRenderer();
// renderer.setSize(window.innerWidth, window.innerHeight);
// document.body.appendChild(renderer.domElement);

// async function main() {
//     try {
//         const geojsonData = await loadGeoJson();
//         const multiPolygons = multiPolygonsFromFeatureCollection(geojsonData);
//         const wireframes = wireframeFromMultiPolygons(multiPolygons);

//         // Add wireframes to the globe group
//         globe.add(...wireframes);

//         // Add the globe group to your scene
//         const scene = new Scene();
//         scene.add(globe);

//         renderer.render(scene, camera);
//     } catch (error) {
//         console.error('Error loading GeoJSON:', error);
//     }
// }

// main();