// We want to fetch brief details about earthquakes such as location and strength.
// If you click on an earthquake, we should fetch more details about it.

type EQFeature = {
    type: 'Feature'
    properties: {
        /** Magnitude */
        mag: number
        /** Place */
        place: string
        time: number
        updated: number
        tz: number | null
        /** URL to get new info about specific earthquake */
        url: string
        /** URL to details about earthquake. */
        detail: string
        felt: number | null
        cdi: number | null
        mmi: number | null
        alert: string | null
        status: string
        tsunami: number
        sig: number
        net: string
        code: string
        ids: string
        sources: string
        types: string
        nst: number
        dmin: number
        rms: number
        gap: number
        magType: string
        type: string
    }
    geometry: {
        type: 'Point'
        /** Latitude, Longitude, Depth. */
        coordinates: number[]
    },
    id: string
}


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
type EQSummary = {
    /** URL to details about earthquake. */
    detail: string
    /** Place */
    place: string
    /** Magnitude */
    mag: number
    /** Latitude, Longitude, Depth. */
    coordinates: number[]
    id: string
}

function buildURL(startDate: string, minMagnitude: number) {
    const format = 'format=geojson';
    const start = `starttime=${startDate}`;
    const minMag = `minmagnitude=${minMagnitude}`;

    //endTime = "endtime=2024-01-22";
    //alertLvl = $"alertlevel={alertLevel}";

    return `https://earthquake.usgs.gov/fdsnws/event/1/query?${format}&${start}&${minMag}`;
}

async function getEarthquakes(startDate: string, minMagnitude: number) : Promise<EQSummary[] | null> {
    const url = buildURL(startDate, minMagnitude);

    const res = await fetch(url);

    if (!res.ok) return null;

    const data = await res.json() as unknown as EQFeatureCollection;

    return data.features.map(feature => {
        return {
            id: feature.id,
            detail: feature.properties.detail,
            place: feature.properties.place,
            mag: feature.properties.mag,
            coordinates: feature.geometry.coordinates,
        };
    });
}

// type Timeframe = 'all_hour' | 'all_day' | 'all_week' | 'all_month';

// async function getEarthquakes(timeframe: Timeframe): Promise<EQSummary[] | null> {
//     const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${timeframe}.geojson`;
//     const res = await fetch(url);

//     if (!res.ok) return null;

//     const data = await res.json() as unknown as EQFeatureCollection;

//     return data.features.map(feature => {
//         return {
//             id: feature.id,
//             detail: feature.properties.detail,
//             place: feature.properties.place,
//             mag: feature.properties.mag,
//             coordinates: feature.geometry.coordinates,
//         };
//     });
// }

export {
    // EQFeatureCollection,
    // EQFeature,
    getEarthquakes,
    EQSummary as EQDataSummary,
}