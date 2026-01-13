// Free basemap configurations with attributions

export interface BasemapOption {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  subdomains?: string;
}

export const BASEMAP_OPTIONS: BasemapOption[] = [
  {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: 'osmHot',
    name: 'OSM Humanitarian',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">Humanitarian OSM Team</a>',
    maxZoom: 19,
  },
  {
    id: 'cartoLight',
    name: 'Carto Positron (Light)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
  },
  {
    id: 'cartoDark',
    name: 'Carto Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
  },
  {
    id: 'cartoVoyager',
    name: 'Carto Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
  },
  {
    id: 'esriWorldImagery',
    name: 'Esri Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
  },
  {
    id: 'esriWorldTopo',
    name: 'Esri Topographic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, and the GIS User Community',
    maxZoom: 18,
  },
  {
    id: 'esriWorldStreet',
    name: 'Esri Street Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
    maxZoom: 18,
  },
  {
    id: 'openTopoMap',
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
  {
    id: 'stamenTerrain',
    name: 'Stadia Terrain',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://stamen.com">Stamen Design</a> © <a href="https://openmaptiles.org">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  },
  {
    id: 'stamenWatercolor',
    name: 'Stadia Watercolor',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
    attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://stamen.com">Stamen Design</a> © <a href="https://openmaptiles.org">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 16,
  },
];

export const DEFAULT_BASEMAP = 'osm';

export function getBasemapById(id: string): BasemapOption {
  return BASEMAP_OPTIONS.find(b => b.id === id) || BASEMAP_OPTIONS[0];
}

// Get short attribution for PDF (without HTML)
export function getPlainTextAttribution(id: string): string {
  const basemap = getBasemapById(id);
  // Strip HTML tags and clean up
  return basemap.attribution
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
