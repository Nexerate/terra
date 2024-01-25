import { BufferGeometry, Group, Line, LineBasicMaterial, Material, Mesh, MeshBasicMaterial, SphereGeometry, Vector2, Vector3 } from 'three';
import { degToRad } from 'three/src/math/MathUtils';
import { ScaleAnimation } from '../animator';
import { Easing } from '../easing';
import { MultiPolygon, Polygon } from './geometry';
import { Feature, FeatureCollection } from './geojson';

class Globe {
    public node: Group;
    private countries: Country[];

    private static gridMat = new LineBasicMaterial({ color: 0x1b1b1b, transparent: false });
    private static sphereMat = new MeshBasicMaterial({ color: 0x080808, opacity: 0.9, transparent: true });

    constructor(data: FeatureCollection) {
        this.node = new Group();
        this.countries = [];

        for (const feature of data.features) {
            const country = new Country(feature);
            this.countries.push(country);
        }

        this.node.add(this.sphere(0.9999, Globe.sphereMat));
        
        for (const country of this.countries) {
            this.node.add(country.node);
        }

        this.node.add(...this.latLonGrid(1.0001));
    }

    private latLonGrid(radius: number): Line[] {
        const grid: Line[] = [];

        // Latitude lines (horizontal circles)
        for (var lat = -90; lat < 90; lat += 10) {
            const latLine = this.circle(radius, Globe.gridMat);
            latLine.position.y = radius * Math.sin(degToRad(lat));
            latLine.scale.setScalar(Math.cos(degToRad(lat))); // Decrease in size
            latLine.rotation.x = Math.PI / 2;
            grid.push(latLine);
        }

        // Longitude lines (vertical circles)
        for (var lon = 0; lon < 360; lon += 10) {
            var lonLine = this.circle(radius, Globe.gridMat);
            lonLine.rotation.y = degToRad(lon);
            grid.push(lonLine);
        }

        return grid;
    }

    private sphere(radius: number, material: Material) {
        return new Mesh(new SphereGeometry(radius, 48, 24), material);
    }

    private circle(radius: number, material: Material) {
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

class Country {
    public properties: any;
    geometry: Polygon | MultiPolygon;
    public node: Group;
    borders: Line[];

    private static borderMat = new LineBasicMaterial({ color: 0x555555 });
    private static borderHoverMat = new LineBasicMaterial({ color: 0xffffff });

    constructor(data: Feature) {
        this.properties = data.properties;
        this.geometry = data.geometry.type === 'Polygon' ? new Polygon(data) : new MultiPolygon(data);
        this.borders = this.geometry.linesFromCoords(Country.borderMat);
        this.node = new Group();

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

        this.focusAnim = new ScaleAnimation(this.node, 0.5, this.node.scale.x, 1.02, Easing.easeInCubic);
        this.focusAnim.play();

        this.updateMaterial(Country.borderHoverMat);
    }

    unfocus() {
        this.focusAnim?.stop();

        this.unfocusAnim = new ScaleAnimation(this.node, 0.25, this.node.scale.x, 1.0, Easing.linear);
        this.unfocusAnim.play();

        this.updateMaterial(Country.borderMat);
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

export {
    Globe,
    Country,
}