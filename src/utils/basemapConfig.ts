// Free basemap configurations with attributions and CORS compatibility

export interface BasemapOption {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  subdomains?: string;
  /** Whether this provider allows CORS for canvas capture */
  corsEnabled: boolean;
}

// CORS-safe providers are marked - these work reliably for PDF capture
export const BASEMAP_OPTIONS: BasemapOption[] = [
  {
    id: 'cartoLight',
    name: 'Carto Positron (Light) ★',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
    corsEnabled: true, // CARTO tiles are CORS-enabled
  },
  {
    id: 'cartoDark',
    name: 'Carto Dark Matter ★',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
    corsEnabled: true,
  },
  {
    id: 'cartoVoyager',
    name: 'Carto Voyager ★',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
    corsEnabled: true,
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    corsEnabled: false, // OSM tiles don't reliably support CORS
  },
  {
    id: 'osmHot',
    name: 'OSM Humanitarian',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">Humanitarian OSM Team</a>',
    maxZoom: 19,
    corsEnabled: false,
  },
  {
    id: 'esriWorldImagery',
    name: 'Esri Satellite ★',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
    corsEnabled: true, // Esri tiles support CORS
  },
  {
    id: 'esriWorldTopo',
    name: 'Esri Topographic ★',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, and the GIS User Community',
    maxZoom: 18,
    corsEnabled: true,
  },
  {
    id: 'esriWorldStreet',
    name: 'Esri Street Map ★',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
    maxZoom: 18,
    corsEnabled: true,
  },
  {
    id: 'openTopoMap',
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
    corsEnabled: false,
  },
  {
    id: 'stamenTerrain',
    name: 'Stadia Terrain',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://stamen.com">Stamen Design</a> © <a href="https://openmaptiles.org">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
    corsEnabled: false, // Stadia requires API key for CORS
  },
  {
    id: 'stamenWatercolor',
    name: 'Stadia Watercolor',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
    attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://stamen.com">Stamen Design</a> © <a href="https://openmaptiles.org">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 16,
    corsEnabled: false,
  },
];

export const DEFAULT_BASEMAP = 'cartoLight'; // Default to CORS-enabled provider

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

// Check if a basemap supports CORS for canvas capture
export function isBasemapCorsEnabled(id: string): boolean {
  const basemap = getBasemapById(id);
  return basemap.corsEnabled;
}

// Get list of CORS-enabled basemaps for PDF export recommendations
export function getCorsEnabledBasemaps(): BasemapOption[] {
  return BASEMAP_OPTIONS.filter(b => b.corsEnabled);
}
