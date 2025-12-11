/**
 * GeoTIFF Export Utility for ZULIM
 * Generates downloadable GeoTIFF raster files from grid data
 */

import type { GridCell, AnalysisConfig, AnalysisResults } from '@/types/spatial';

// TIFF Tag Constants
const TIFF_TAGS = {
  ImageWidth: 256,
  ImageLength: 257,
  BitsPerSample: 258,
  Compression: 259,
  PhotometricInterpretation: 262,
  StripOffsets: 273,
  SamplesPerPixel: 277,
  RowsPerStrip: 278,
  StripByteCounts: 279,
  XResolution: 282,
  YResolution: 283,
  ResolutionUnit: 296,
  SampleFormat: 339,
  // GeoTIFF Tags
  ModelPixelScaleTag: 33550,
  ModelTiepointTag: 33922,
  GeoKeyDirectoryTag: 34735,
  GeoDoubleParamsTag: 34736,
  GeoAsciiParamsTag: 34737,
};

// GeoKey IDs
const GEO_KEYS = {
  GTModelTypeGeoKey: 1024,
  GTRasterTypeGeoKey: 1025,
  GeographicTypeGeoKey: 2048,
  GeogCitationGeoKey: 2049,
  GeogAngularUnitsGeoKey: 2054,
};

interface RasterBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface RasterGrid {
  width: number;
  height: number;
  data: Float32Array;
  noDataValue: number;
  bounds: RasterBounds;
  pixelWidth: number;
  pixelHeight: number;
}

/**
 * Convert grid cells to a regular raster grid
 */
function gridToRaster(grid: GridCell[], valueField: keyof GridCell = 'value'): RasterGrid {
  if (!grid || grid.length === 0) {
    throw new Error('No grid data available');
  }

  // Get unique coordinates
  const lats = [...new Set(grid.map(c => c.lat))].sort((a, b) => b - a); // Descending for raster
  const lngs = [...new Set(grid.map(c => c.lng))].sort((a, b) => a - b);
  
  const height = lats.length;
  const width = lngs.length;
  
  const bounds: RasterBounds = {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
  
  const pixelWidth = width > 1 ? (bounds.maxLng - bounds.minLng) / (width - 1) : 0.001;
  const pixelHeight = height > 1 ? (bounds.maxLat - bounds.minLat) / (height - 1) : 0.001;
  
  const noDataValue = -9999;
  const data = new Float32Array(width * height).fill(noDataValue);
  
  // Create lookup map
  const gridMap = new Map<string, GridCell>();
  grid.forEach(cell => {
    gridMap.set(`${cell.lat.toFixed(6)},${cell.lng.toFixed(6)}`, cell);
  });
  
  // Fill raster data
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const lat = lats[row];
      const lng = lngs[col];
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      const cell = gridMap.get(key);
      
      if (cell) {
        const value = cell[valueField];
        if (typeof value === 'number' && !isNaN(value)) {
          data[row * width + col] = value;
        } else if (typeof value === 'boolean') {
          data[row * width + col] = value ? 1 : 0;
        }
      }
    }
  }
  
  return {
    width,
    height,
    data,
    noDataValue,
    bounds,
    pixelWidth,
    pixelHeight,
  };
}

/**
 * Write a 32-bit little-endian integer
 */
function writeUint32LE(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, value, true);
  return new Uint8Array(buffer);
}

/**
 * Write a 16-bit little-endian integer
 */
function writeUint16LE(value: number): Uint8Array {
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint16(0, value, true);
  return new Uint8Array(buffer);
}

/**
 * Write a 64-bit double little-endian
 */
function writeFloat64LE(value: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, true);
  return new Uint8Array(buffer);
}

/**
 * Create a GeoTIFF file from raster data
 */
function createGeoTIFF(raster: RasterGrid): Uint8Array {
  const { width, height, data, noDataValue, bounds, pixelWidth, pixelHeight } = raster;
  
  // Calculate offsets
  const headerSize = 8; // TIFF header
  const ifdEntryCount = 18; // Number of IFD entries
  const ifdEntrySize = 12;
  const ifdSize = 2 + (ifdEntryCount * ifdEntrySize) + 4; // count + entries + next IFD offset
  
  // Data offsets (after IFD)
  const ifdOffset = headerSize;
  const extraDataOffset = ifdOffset + ifdSize;
  
  // Calculate sizes for extra data
  const bitsPerSampleSize = 2; // Single value for 1 sample
  const xResolutionSize = 8; // RATIONAL = 2 x LONG
  const yResolutionSize = 8;
  const modelPixelScaleSize = 24; // 3 doubles
  const modelTiepointSize = 48; // 6 doubles
  const geoKeyDirectorySize = 32; // 4 + 4 keys * 4 shorts
  const geoAsciiParamsSize = 16; // "WGS 84|"
  
  let currentOffset = extraDataOffset;
  
  const bitsPerSampleOffset = currentOffset;
  currentOffset += bitsPerSampleSize;
  
  const xResOffset = currentOffset;
  currentOffset += xResolutionSize;
  
  const yResOffset = currentOffset;
  currentOffset += yResolutionSize;
  
  const modelPixelScaleOffset = currentOffset;
  currentOffset += modelPixelScaleSize;
  
  const modelTiepointOffset = currentOffset;
  currentOffset += modelTiepointSize;
  
  const geoKeyDirectoryOffset = currentOffset;
  currentOffset += geoKeyDirectorySize;
  
  const geoAsciiParamsOffset = currentOffset;
  currentOffset += geoAsciiParamsSize;
  
  // Align to 4 bytes for image data
  currentOffset = Math.ceil(currentOffset / 4) * 4;
  const imageDataOffset = currentOffset;
  const imageDataSize = width * height * 4; // Float32
  
  // Total file size
  const totalSize = imageDataOffset + imageDataSize;
  
  // Create buffer
  const buffer = new Uint8Array(totalSize);
  let pos = 0;
  
  // Write TIFF header
  buffer[pos++] = 0x49; // 'I'
  buffer[pos++] = 0x49; // 'I' (little-endian)
  buffer.set(writeUint16LE(42), pos); pos += 2; // TIFF magic number
  buffer.set(writeUint32LE(ifdOffset), pos); pos += 4; // IFD offset
  
  // Write IFD entry count
  buffer.set(writeUint16LE(ifdEntryCount), pos); pos += 2;
  
  // Helper function to write IFD entry
  const writeIFDEntry = (tag: number, type: number, count: number, value: number | Uint8Array) => {
    buffer.set(writeUint16LE(tag), pos); pos += 2;
    buffer.set(writeUint16LE(type), pos); pos += 2;
    buffer.set(writeUint32LE(count), pos); pos += 4;
    if (value instanceof Uint8Array) {
      buffer.set(value.slice(0, 4), pos);
      pos += 4;
    } else {
      buffer.set(writeUint32LE(value), pos); pos += 4;
    }
  };
  
  // IFD Entries (must be in ascending tag order)
  writeIFDEntry(TIFF_TAGS.ImageWidth, 3, 1, width); // SHORT
  writeIFDEntry(TIFF_TAGS.ImageLength, 3, 1, height); // SHORT
  writeIFDEntry(TIFF_TAGS.BitsPerSample, 3, 1, 32); // 32 bits per sample
  writeIFDEntry(TIFF_TAGS.Compression, 3, 1, 1); // No compression
  writeIFDEntry(TIFF_TAGS.PhotometricInterpretation, 3, 1, 1); // BlackIsZero
  writeIFDEntry(TIFF_TAGS.StripOffsets, 4, 1, imageDataOffset); // LONG
  writeIFDEntry(TIFF_TAGS.SamplesPerPixel, 3, 1, 1); // 1 sample per pixel
  writeIFDEntry(TIFF_TAGS.RowsPerStrip, 3, 1, height); // All rows in one strip
  writeIFDEntry(TIFF_TAGS.StripByteCounts, 4, 1, imageDataSize); // LONG
  writeIFDEntry(TIFF_TAGS.XResolution, 5, 1, xResOffset); // RATIONAL offset
  writeIFDEntry(TIFF_TAGS.YResolution, 5, 1, yResOffset); // RATIONAL offset
  writeIFDEntry(TIFF_TAGS.ResolutionUnit, 3, 1, 1); // No absolute unit
  writeIFDEntry(TIFF_TAGS.SampleFormat, 3, 1, 3); // IEEE floating point
  
  // GeoTIFF tags
  writeIFDEntry(TIFF_TAGS.ModelPixelScaleTag, 12, 3, modelPixelScaleOffset); // DOUBLE offset
  writeIFDEntry(TIFF_TAGS.ModelTiepointTag, 12, 6, modelTiepointOffset); // DOUBLE offset
  writeIFDEntry(TIFF_TAGS.GeoKeyDirectoryTag, 3, 16, geoKeyDirectoryOffset); // SHORT array offset
  writeIFDEntry(TIFF_TAGS.GeoDoubleParamsTag, 12, 0, 0); // No double params
  writeIFDEntry(TIFF_TAGS.GeoAsciiParamsTag, 2, 8, geoAsciiParamsOffset); // ASCII offset
  
  // Next IFD offset (0 = no more IFDs)
  buffer.set(writeUint32LE(0), pos); pos += 4;
  
  // Write extra data
  
  // BitsPerSample value (already written inline for single sample)
  buffer.set(writeUint16LE(32), bitsPerSampleOffset);
  
  // X Resolution (72 DPI as RATIONAL: 72/1)
  buffer.set(writeUint32LE(72), xResOffset);
  buffer.set(writeUint32LE(1), xResOffset + 4);
  
  // Y Resolution
  buffer.set(writeUint32LE(72), yResOffset);
  buffer.set(writeUint32LE(1), yResOffset + 4);
  
  // ModelPixelScaleTag: [ScaleX, ScaleY, ScaleZ]
  const pixelScaleData = new Float64Array([pixelWidth, pixelHeight, 0]);
  buffer.set(new Uint8Array(pixelScaleData.buffer), modelPixelScaleOffset);
  
  // ModelTiepointTag: [I, J, K, X, Y, Z] - Maps pixel (0,0) to geographic coords
  // Upper-left corner of upper-left pixel
  const tiepointData = new Float64Array([
    0, 0, 0,
    bounds.minLng - pixelWidth / 2,  // X (longitude) of upper-left corner
    bounds.maxLat + pixelHeight / 2, // Y (latitude) of upper-left corner
    0
  ]);
  buffer.set(new Uint8Array(tiepointData.buffer), modelTiepointOffset);
  
  // GeoKeyDirectoryTag
  // Format: KeyDirectoryVersion, KeyRevision, MinorRevision, NumberOfKeys, then key entries
  const geoKeyDir = new Uint16Array([
    1, 1, 0, 4, // Version 1.1.0, 4 keys
    GEO_KEYS.GTModelTypeGeoKey, 0, 1, 2,      // ModelTypeGeographic
    GEO_KEYS.GTRasterTypeGeoKey, 0, 1, 1,     // RasterPixelIsArea
    GEO_KEYS.GeographicTypeGeoKey, 0, 1, 4326, // EPSG:4326 (WGS 84)
    GEO_KEYS.GeogAngularUnitsGeoKey, 0, 1, 9102, // Angular Degree
  ]);
  buffer.set(new Uint8Array(geoKeyDir.buffer), geoKeyDirectoryOffset);
  
  // GeoAsciiParamsTag: "WGS 84|"
  const asciiParams = new TextEncoder().encode('WGS 84|\0');
  buffer.set(asciiParams, geoAsciiParamsOffset);
  
  // Write image data (Float32)
  const imageDataView = new DataView(buffer.buffer, imageDataOffset, imageDataSize);
  for (let i = 0; i < data.length; i++) {
    imageDataView.setFloat32(i * 4, data[i], true);
  }
  
  return buffer;
}

/**
 * Export grid data as GeoTIFF file
 */
export function exportAsGeoTIFF(
  grid: GridCell[],
  layerName: string,
  config: AnalysisConfig,
  valueField: keyof GridCell = 'value'
): void {
  try {
    const raster = gridToRaster(grid, valueField);
    const tiffData = createGeoTIFF(raster);
    
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${config.algorithm.toUpperCase()}_${layerName}_${dateStr}.tif`;
    
    // Create a new ArrayBuffer copy for Blob compatibility
    const arrayBuffer = new ArrayBuffer(tiffData.length);
    new Uint8Array(arrayBuffer).set(tiffData);
    const blob = new Blob([arrayBuffer], { type: 'image/tiff' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('GeoTIFF export error:', error);
    throw new Error(`Failed to export GeoTIFF: ${(error as Error).message}`);
  }
}

/**
 * Get the appropriate value field for different layer types
 */
export function getValueFieldForLayer(layerType: string): keyof GridCell {
  switch (layerType) {
    case 'classified':
      return 'class';
    case 'accuracy':
      return 'accuracy';
    case 'residuals':
      return 'residual';
    case 'uncertainty':
      return 'uncertainty';
    case 'rpe':
      return 'reliable';
    default:
      return 'value';
  }
}

/**
 * Export specific layer type as GeoTIFF
 */
export function exportLayerAsGeoTIFF(
  results: AnalysisResults,
  layerType: string,
  config: AnalysisConfig
): void {
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
  
  exportAsGeoTIFF(grid, layerName, config, valueField);
}
