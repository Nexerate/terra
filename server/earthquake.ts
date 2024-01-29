// We want to fetch brief details about earthquakes such as location and strength.
// If you click on an earthquake, we should fetch more details about it.

import { Camera, Vector2, Vector3 } from "three";
import { Geometry } from "./globe/geometry";
import type { Globe } from "./globe/globe";

// type EQFeature = {
//     type: 'Feature'
//     properties: {
//         /** Magnitude */
//         mag: number
//         /** Place */
//         place: string
//         time: number
//         updated: number
//         tz: number | null
//         /** URL to get new info about specific earthquake */
//         url: string
//         /** URL to details about earthquake. */
//         detail: string
//         felt: number | null
//         cdi: number | null
//         mmi: number | null
//         alert: string | null
//         status: string
//         tsunami: number
//         sig: number
//         net: string
//         code: string
//         ids: string
//         sources: string
//         types: string
//         nst: number
//         dmin: number
//         rms: number
//         gap: number
//         magType: string
//         type: string
//     }
//     geometry: {
//         type: 'Point'
//         /** Latitude, Longitude, Depth. */
//         coordinates: number[]
//     },
//     id: string
// }


type EQFeatureCollection = {
    type: 'FeatureCollection'
    metadata: {
        generated: number
        url: string
        title: string
        status: string
        api: string
        count: number
    };
    features: EQFeature[]
}

/** Destilled version of EQFeature with only the properties we are using. Will be expanded upon. */
type EQFeature = {
    properties: {
        /** URL to details about earthquake. */
        detail: string
        /** Place */
        place: string
        time: number
        /** Magnitude */
        mag: number
    }
    /** Latitude, Longitude, Depth. */
    geometry: {
        coordinates: number[]
    }
    id: string
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

    public getWorldPos(globe: Globe | undefined) {
        if (!globe) return undefined;

        const point = Geometry.vertex(this.origin, globe.getScale());
        return point.applyAxisAngle(new Vector3(0, 1, 0), globe.getRotation());
    }

    /** Convert earthquake origin to screen position. */
    public getScreenPos(cam: Camera | undefined, worldPos: Vector3) {
        if (!cam) return undefined;
        
        const projected = worldPos.clone().project(cam);

        return new Vector2(
            (projected.x + 1) * window.innerWidth / 2,
            (-projected.y + 1) * window.innerHeight / 2,
        );
    }

    /** 10 is max magnitude, so anything above 5 will be enlarged. Anything else will be shrunk. */
    public getScale() {
        return this.magnitude / 5;
    }

    public getOpacity(cam: Camera | undefined, worldPos: Vector3) {
        if (!cam) return undefined;
        
        const a = cam.getWorldDirection(new Vector3()).negate().normalize();
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

function buildURL(startDate: string, minMagnitude: number) {
    const format = 'format=geojson';
    const start = `starttime=${startDate}`;
    const minMag = `minmagnitude=${minMagnitude}`;

    //endTime = "endtime=2024-01-22";
    //alertLvl = $"alertlevel={alertLevel}";

    return `https://earthquake.usgs.gov/fdsnws/event/1/query?${format}&${start}&${minMag}`;
}

async function getEarthquakes(startDate: string, minMagnitude: number) : Promise<EQFeature[] | null> {
    const url = buildURL(startDate, minMagnitude);

    const res = await fetch(url);

    if (!res.ok) return null;

    const data = await res.json() as unknown as EQFeatureCollection;

    return data.features;
}

export {
    // EQFeatureCollection,
    // EQFeature,
    getEarthquakes,
    type EQFeature,
    Earthquake,
}