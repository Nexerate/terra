import { Geometry } from './geometry';

type Feature = {
    properties: any;
    geometry: Geometry;
}

type FeatureCollection = {
    features: Feature[];
}

export {
    Feature, FeatureCollection,
}