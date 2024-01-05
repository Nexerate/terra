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

/// All earthquakes in the past hour
async function allEQsPastHour(): Promise<EQFeatureCollection | null> {
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson')

    if (!res.ok) return null;

    return res.json() as unknown as EQFeatureCollection;
}

async function allEQsPastDay(): Promise<EQFeatureCollection | null> {
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson')

    if (!res.ok) return null;

    return res.json() as unknown as EQFeatureCollection;
}

export {
    EQFeatureCollection,
    EQFeature,
    allEQsPastHour,
    allEQsPastDay,
}