import { Box2, BufferGeometry, Line, LineBasicMaterial, Vector2, Vector3 } from 'three';
import { degToRad } from 'three/src/math/MathUtils';
import { Feature } from './geojson';

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

    abstract linesFromCoords(mat: LineBasicMaterial): Line[];

    /** Convert coordinates to 3D position.*/
    public static vertex([longitude, latitude]: number[], radius: number) {
        const lambda = degToRad(longitude - 90);
        const phi = degToRad(latitude);
        return new Vector3(
            radius * Math.cos(phi) * Math.cos(lambda),
            radius * Math.sin(phi),
            -radius * Math.cos(phi) * Math.sin(lambda)
        );
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

    linesFromCoords(mat: LineBasicMaterial): Line[] {
        const lines: Line[] = [];
        this.coordinates.forEach(ring => {
            const points = ring.map(coord => Geometry.vertex(coord, 1));
            // Close the loop by adding the first point at the end
            points.push(points[0]);
            const geometry = new BufferGeometry().setFromPoints(points);
            lines.push(new Line(geometry, mat));
        });
        return lines;
    }
}

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

    linesFromCoords(mat: LineBasicMaterial): Line[] {
        const lines: Line[] = [];
        this.coordinates.forEach(polygon => {
            polygon.forEach(ring => {
                const points = ring.map(coord => Geometry.vertex(coord, 1));
                // Close the loop by adding the first point at the end
                points.push(points[0]);
                const geometry = new BufferGeometry().setFromPoints(points);
                lines.push(new Line(geometry, mat));
            });
        });
        return lines;
    }
}

export {
    Geometry,
    Polygon,
    MultiPolygon,
}