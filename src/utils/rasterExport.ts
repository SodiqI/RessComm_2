/**
 * Raster Export Utility for ZULIM
 * Generates downloadable raster files in multiple formats for GIS compatibility
 */

import type { GridCell, AnalysisConfig, AnalysisResults } from '@/types/spatial';

interface RasterBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface RasterGrid {
  width: number;
  height: number;
  data: number[][];
  noDataValue: number;
  bounds: RasterBounds;
  cellSize: number;
}

/**
 * Convert grid cells to a regular 2D raster grid
 */
function gridToRaster(grid: GridCell[], valueField: keyof GridCell = 'value'): RasterGrid {
  if (!grid || grid.length === 0) {
    throw new Error('No grid data available');
  }

  // Get unique coordinates sorted
  const lats = [...new Set(grid.map(c => c.lat))].sort((a, b) => b - a); // Descending (north to south)
  const lngs = [...new Set(grid.map(c => c.lng))].sort((a, b) => a - b); // Ascending (west to east)
  
  const height = lats.length;
  const width = lngs.length;
  
  const bounds: RasterBounds = {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
  
  // Calculate cell size (use average of lat/lng spacing)
  const cellSizeLng = width > 1 ? (bounds.maxLng - bounds.minLng) / (width - 1) : 0.001;
  const cellSizeLat = height > 1 ? (bounds.maxLat - bounds.minLat) / (height - 1) : 0.001;
  const cellSize = (cellSizeLng + cellSizeLat) / 2;
  
  const noDataValue = -9999;
  
  // Create lookup map for fast access
  const gridMap = new Map<string, GridCell>();
  grid.forEach(cell => {
    gridMap.set(`${cell.lat.toFixed(6)},${cell.lng.toFixed(6)}`, cell);
  });
  
  // Create 2D array (row-major, north to south)
  const data: number[][] = [];
  for (let row = 0; row < height; row++) {
    const rowData: number[] = [];
    for (let col = 0; col < width; col++) {
      const lat = lats[row];
      const lng = lngs[col];
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      const cell = gridMap.get(key);
      
      if (cell) {
        const value = cell[valueField];
        if (typeof value === 'number' && !isNaN(value)) {
          rowData.push(value);
        } else if (typeof value === 'boolean') {
          rowData.push(value ? 1 : 0);
        } else {
          rowData.push(noDataValue);
        }
      } else {
        rowData.push(noDataValue);
      }
    }
    data.push(rowData);
  }
  
  return {
    width,
    height,
    data,
    noDataValue,
    bounds,
    cellSize,
  };
}

/**
 * Generate ESRI ASCII Grid (.asc) format
 * This format is widely supported by ArcGIS, QGIS, and other GIS software
 */
function generateASCGrid(raster: RasterGrid): string {
  const { width, height, data, noDataValue, bounds, cellSize } = raster;
  
  // ASCII Grid header
  const header = [
    `ncols         ${width}`,
    `nrows         ${height}`,
    `xllcorner     ${bounds.minLng.toFixed(10)}`,
    `yllcorner     ${bounds.minLat.toFixed(10)}`,
    `cellsize      ${cellSize.toFixed(10)}`,
    `NODATA_value  ${noDataValue}`,
  ].join('\n');
  
  // Data rows (from north to south)
  const dataRows = data.map(row => 
    row.map(val => val === noDataValue ? noDataValue.toString() : val.toFixed(6)).join(' ')
  ).join('\n');
  
  return header + '\n' + dataRows;
}

/**
 * Generate projection file (.prj) for WGS84
 */
function generatePRJ(): string {
  return 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]]';
}

/**
 * Generate metadata XML file
 */
function generateMetadataXML(
  layerName: string,
  config: AnalysisConfig,
  results: AnalysisResults,
  raster: RasterGrid
): string {
  const isSingleVariable = results.analysisType === 'single-variable';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<metadata>
  <idinfo>
    <citation>
      <citeinfo>
        <title>${layerName}</title>
        <origin>ZULIM Spatial Analysis</origin>
        <pubdate>${new Date().toISOString().split('T')[0]}</pubdate>
      </citeinfo>
    </citation>
    <descript>
      <abstract>${isSingleVariable ? 'Interpolated' : 'Predicted'} surface generated using ${config.algorithm.toUpperCase()} algorithm</abstract>
      <purpose>Spatial analysis output</purpose>
    </descript>
    <spdom>
      <bounding>
        <westbc>${raster.bounds.minLng}</westbc>
        <eastbc>${raster.bounds.maxLng}</eastbc>
        <northbc>${raster.bounds.maxLat}</northbc>
        <southbc>${raster.bounds.minLat}</southbc>
      </bounding>
    </spdom>
  </idinfo>
  <spdoinfo>
    <direct>Raster</direct>
    <rastinfo>
      <rasttype>Grid Cell</rasttype>
      <rowcount>${raster.height}</rowcount>
      <colcount>${raster.width}</colcount>
    </rastinfo>
  </spdoinfo>
  <spref>
    <horizsys>
      <geograph>
        <latres>${raster.cellSize}</latres>
        <longres>${raster.cellSize}</longres>
        <geogunit>Decimal degrees</geogunit>
      </geograph>
      <geodetic>
        <horizdn>World Geodetic System 1984</horizdn>
        <ellips>WGS 84</ellips>
        <semiaxis>6378137</semiaxis>
        <denflat>298.257223563</denflat>
      </geodetic>
    </horizsys>
  </spref>
  <eainfo>
    <detailed>
      <enttyp>
        <enttypl>${layerName}</enttypl>
        <enttypd>Raster grid values</enttypd>
      </enttyp>
      <attr>
        <attrlabl>Value</attrlabl>
        <attrdef>${getLayerDescription(layerName)}</attrdef>
      </attr>
    </detailed>
  </eainfo>
  <dataqual>
    <lineage>
      <procstep>
        <procdesc>Generated using ZULIM spatial analysis tool</procdesc>
        <procdate>${new Date().toISOString()}</procdate>
      </procstep>
    </lineage>
  </dataqual>
  <metainfo>
    <metd>${new Date().toISOString().split('T')[0]}</metd>
    <metstdn>FGDC Content Standard for Digital Geospatial Metadata</metstdn>
    <metstdv>FGDC-STD-001-1998</metstdv>
  </metainfo>
  <analysisInfo>
    <algorithm>${config.algorithm}</algorithm>
    <analysisType>${results.analysisType}</analysisType>
    <targetVariable>${results.targetVar}</targetVariable>
    <predictors>${results.predictors?.join(', ') || 'None'}</predictors>
    <gridResolution>${config.gridResolution}</gridResolution>
    <rpeMethod>${config.rpeMethod}</rpeMethod>
    <metrics>
      <rmse>${results.metrics.rmse}</rmse>
      <mae>${results.metrics.mae}</mae>
      <r2>${results.metrics.r2}</r2>
      <bias>${results.metrics.bias}</bias>
    </metrics>
  </analysisInfo>
</metadata>`;
}

function getLayerDescription(layerName: string): string {
  const descriptions: Record<string, string> = {
    'InterpolatedSurface': 'Continuous interpolated values from spatial analysis',
    'PredictedSurface': 'Model-predicted values from regression analysis',
    'ClassifiedMap': 'Classified values based on user-defined number of classes',
    'AccuracySurface': 'Cross-validation error values indicating prediction reliability',
    'ResidualMap': 'Difference between observed and predicted values',
    'UncertaintyMap': 'Prediction uncertainty/confidence values',
    'RPELayer': 'Reliable Prediction Extent (1=reliable, 0=unreliable)',
  };
  return descriptions[layerName] || 'Raster grid values';
}

/**
 * Download multiple files as a package
 */
async function downloadRasterPackage(
  ascContent: string,
  prjContent: string,
  xmlContent: string,
  filename: string
): Promise<void> {
  // Import JSZip dynamically
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  
  const baseName = filename.replace('.asc', '');
  
  // Add files to zip
  zip.file(`${baseName}.asc`, ascContent);
  zip.file(`${baseName}.prj`, prjContent);
  zip.file(`${baseName}.xml`, xmlContent);
  
  // Add README
  const readme = `ZULIM Raster Export
==================

This package contains:
- ${baseName}.asc - ESRI ASCII Grid raster file
- ${baseName}.prj - Projection file (WGS84/EPSG:4326)
- ${baseName}.xml - FGDC-compliant metadata

Usage in ArcGIS:
1. Add the .asc file directly to your map
2. The .prj file will be automatically recognized
3. Use "ASCII to Raster" tool for conversion to other formats

Usage in QGIS:
1. Drag and drop the .asc file into QGIS
2. The projection will be automatically applied

Coordinate System: WGS 84 (EPSG:4326)
NoData Value: -9999

Generated: ${new Date().toISOString()}
`;
  zip.file('README.txt', readme);
  
  // Generate and download zip
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export grid data as ASCII Grid raster package
 */
export async function exportAsASCGrid(
  grid: GridCell[],
  layerName: string,
  config: AnalysisConfig,
  results: AnalysisResults,
  valueField: keyof GridCell = 'value'
): Promise<void> {
  try {
    const raster = gridToRaster(grid, valueField);
    
    const ascContent = generateASCGrid(raster);
    const prjContent = generatePRJ();
    const xmlContent = generateMetadataXML(layerName, config, results, raster);
    
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${config.algorithm.toUpperCase()}_${layerName}_${dateStr}.asc`;
    
    await downloadRasterPackage(ascContent, prjContent, xmlContent, filename);
  } catch (error) {
    console.error('ASCII Grid export error:', error);
    throw new Error(`Failed to export raster: ${(error as Error).message}`);
  }
}

/**
 * Export specific layer type as ASCII Grid raster
 */
export async function exportLayerAsRaster(
  results: AnalysisResults,
  layerType: string,
  config: AnalysisConfig
): Promise<void> {
  let grid: GridCell[] | undefined;
  let layerName: string;
  let valueField: keyof GridCell;
  
  const isSingleVariable = results.analysisType === 'single-variable';
  
  switch (layerType) {
    case 'interpolated':
    case 'predicted':
      grid = results.continuous.grid;
      layerName = isSingleVariable ? 'InterpolatedSurface' : 'PredictedSurface';
      valueField = 'value';
      break;
    case 'classified':
      grid = results.classified;
      layerName = 'ClassifiedMap';
      valueField = 'class';
      break;
    case 'accuracy':
      grid = results.accuracy;
      layerName = 'AccuracySurface';
      valueField = 'accuracy';
      break;
    case 'residuals':
      grid = results.residuals;
      layerName = 'ResidualMap';
      valueField = 'residual';
      break;
    case 'uncertainty':
      grid = results.uncertainty;
      layerName = 'UncertaintyMap';
      valueField = 'uncertainty';
      break;
    case 'rpe':
      grid = results.rpe;
      layerName = 'RPELayer';
      valueField = 'reliable';
      break;
    default:
      throw new Error(`Unknown layer type: ${layerType}`);
  }
  
  if (!grid || grid.length === 0) {
    throw new Error(`No data available for ${layerName}`);
  }
  
  await exportAsASCGrid(grid, layerName, config, results, valueField);
}
