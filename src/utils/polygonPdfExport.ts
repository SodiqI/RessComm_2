// PDF Export utilities for Manual and Excel Plotter - Single-page polygon reports
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getPlainTextAttribution } from './basemapConfig';

// Types
export interface PolygonPoint {
  lat: number;
  lng: number;
}

export interface PolygonData {
  id: number;
  name: string;
  landUse: string;
  coordinates: PolygonPoint[];
  area: number;
  hectares: number;
  sqKm: number;
  attributes?: Record<string, unknown>;
}

export type AreaUnit = 'hectares' | 'acres' | 'sqMeters';
export type PdfOrientation = 'portrait' | 'landscape' | 'auto';

export interface MapCaptureResult {
  imageData: string | null;
  success: boolean;
  message: string;
  tilesLoaded: number;
  tilesFailed: number;
}

export interface PdfExportConfig {
  areaUnit: AreaUnit;
  polygons: PolygonData[];
  dataSource: 'Manual Plotter' | 'Excel Upload';
  mapElement?: HTMLElement | null;
  orientation?: PdfOrientation;
  basemapId?: string;
  includeBasemap?: boolean;
}

// Land use categories
export const LAND_USE_CATEGORIES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'agricultural', label: 'Agriculture' },
  { value: 'recreational', label: 'Recreational' },
  { value: 'conservation', label: 'Conservation' },
  { value: 'mixed', label: 'Mixed Use' },
  { value: 'other', label: 'Other' },
];

// Color palette - professional cartographic colors
const COLORS = {
  primary: [45, 85, 65] as [number, number, number],
  primaryLight: [76, 127, 93] as [number, number, number],
  textDark: [35, 35, 35] as [number, number, number],
  textMuted: [90, 90, 90] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  tableBorder: [180, 180, 180] as [number, number, number],
  tableHeader: [235, 240, 245] as [number, number, number],
  tableAlt: [248, 250, 252] as [number, number, number],
  polygonFill: [100, 150, 120] as [number, number, number],
  polygonStroke: [40, 70, 55] as [number, number, number],
  disclaimer: [245, 245, 245] as [number, number, number],
};

// A4 dimensions in mm
const PAGE_PORTRAIT = {
  width: 210,
  height: 297,
  margin: 15,
};

const PAGE_LANDSCAPE = {
  width: 297,
  height: 210,
  margin: 15,
};

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate edge lengths for a polygon
function calculateEdgeLengths(coords: PolygonPoint[]): number[] {
  const edges: number[] = [];
  for (let i = 0; i < coords.length; i++) {
    const next = (i + 1) % coords.length;
    edges.push(calculateDistance(coords[i].lat, coords[i].lng, coords[next].lat, coords[next].lng));
  }
  return edges;
}

// Calculate perimeter
function calculatePerimeter(edges: number[]): number {
  return edges.reduce((sum, e) => sum + e, 0);
}

// Calculate bounding box dimensions
function calculateDimensions(coords: PolygonPoint[]): { length: number; breadth: number } {
  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  const centerLat = (minLat + maxLat) / 2;
  const length = calculateDistance(minLat, (minLng + maxLng) / 2, maxLat, (minLng + maxLng) / 2);
  const breadth = calculateDistance(centerLat, minLng, centerLat, maxLng);
  
  return { 
    length: Math.max(length, breadth), 
    breadth: Math.min(length, breadth) 
  };
}

// Calculate extent with buffer
function calculateExtent(coords: PolygonPoint[], bufferPercent: number = 0.08): {
  minLat: number; maxLat: number; minLng: number; maxLng: number; 
  centerLat: number; centerLng: number;
} {
  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  const latBuffer = (maxLat - minLat) * bufferPercent;
  const lngBuffer = (maxLng - minLng) * bufferPercent;
  
  return {
    minLat: minLat - latBuffer,
    maxLat: maxLat + latBuffer,
    minLng: minLng - lngBuffer,
    maxLng: maxLng + lngBuffer,
    centerLat: (minLat + maxLat) / 2,
    centerLng: (minLng + maxLng) / 2,
  };
}

// Determine optimal orientation based on polygon aspect ratio
function determineOptimalOrientation(coords: PolygonPoint[]): 'portrait' | 'landscape' {
  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  const centerLat = (minLat + maxLat) / 2;
  const latSpan = calculateDistance(minLat, (minLng + maxLng) / 2, maxLat, (minLng + maxLng) / 2);
  const lngSpan = calculateDistance(centerLat, minLng, centerLat, maxLng);
  
  // If width > height by significant margin, use landscape
  return lngSpan > latSpan * 1.2 ? 'landscape' : 'portrait';
}

// Calculate scale bar with smart sizing
function calculateScaleBar(extent: ReturnType<typeof calculateExtent>, mapWidthMm: number): {
  value: number; unit: string; barWidthMm: number;
} {
  const lngDiff = extent.maxLng - extent.minLng;
  const metersPerDegree = 111320 * Math.cos((extent.centerLat * Math.PI) / 180);
  const totalMeters = lngDiff * metersPerDegree;
  const metersPerMm = totalMeters / mapWidthMm;
  
  // Target 12-15% of map width for scale bar
  const targetWidthMm = mapWidthMm * 0.12;
  const targetMeters = targetWidthMm * metersPerMm;
  
  // Nice values for scale bar
  const niceValues = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const value = niceValues.reduce((prev, curr) => 
    Math.abs(curr - targetMeters) < Math.abs(prev - targetMeters) ? curr : prev
  );
  
  const barWidthMm = value / metersPerMm;
  const unit = value >= 1000 ? 'km' : 'm';
  const displayValue = value >= 1000 ? value / 1000 : value;
  
  return { value: displayValue, unit, barWidthMm: Math.min(barWidthMm, mapWidthMm * 0.15) };
}

// Convert area based on unit
function convertArea(areaM2: number, unit: AreaUnit): number {
  switch (unit) {
    case 'hectares': return areaM2 / 10000;
    case 'acres': return areaM2 / 4046.86;
    case 'sqMeters': return areaM2;
  }
}

function getUnitLabel(unit: AreaUnit): string {
  switch (unit) {
    case 'hectares': return 'ha';
    case 'acres': return 'ac';
    case 'sqMeters': return 'm²';
  }
}

// Format coordinate for display
function formatCoord(val: number, isLat: boolean): string {
  const absVal = Math.abs(val).toFixed(5);
  if (isLat) {
    return val >= 0 ? `${absVal}°N` : `${absVal}°S`;
  }
  return val >= 0 ? `${absVal}°E` : `${absVal}°W`;
}

// Format distance compactly
function formatDistanceCompact(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters.toFixed(1)} m`;
}

// Check for self-intersection
function checkSelfIntersection(coords: PolygonPoint[]): boolean {
  if (coords.length < 4) return false;
  
  const lineIntersects = (p1: PolygonPoint, p2: PolygonPoint, p3: PolygonPoint, p4: PolygonPoint): boolean => {
    const ccw = (a: PolygonPoint, b: PolygonPoint, c: PolygonPoint): boolean => {
      return (c.lat - a.lat) * (b.lng - a.lng) > (b.lat - a.lat) * (c.lng - a.lng);
    };
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  };
  
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 2; j < coords.length; j++) {
      if (i === 0 && j === coords.length - 1) continue;
      if (lineIntersects(
        coords[i], coords[(i + 1) % coords.length],
        coords[j], coords[(j + 1) % coords.length]
      )) {
        return true;
      }
    }
  }
  return false;
}

// Draw minimalist north arrow
function drawNorthArrow(pdf: jsPDF, x: number, y: number, size: number = 8) {
  // Simple arrow design
  pdf.setFillColor(255, 255, 255);
  pdf.setGState(pdf.GState({ opacity: 0.85 }));
  pdf.circle(x, y, size / 2 + 1.5, 'F');
  pdf.setGState(pdf.GState({ opacity: 1 }));
  
  pdf.setDrawColor(60, 60, 60);
  pdf.setLineWidth(0.3);
  pdf.circle(x, y, size / 2 + 1.5, 'S');
  
  // Arrow
  const arrowHeight = size * 0.7;
  const arrowWidth = size * 0.3;
  
  // Filled half (north)
  pdf.setFillColor(30, 30, 30);
  pdf.triangle(x, y - arrowHeight / 2, x - arrowWidth / 2, y + arrowHeight / 3, x, y);
  pdf.fill();
  
  // Outline half
  pdf.setFillColor(255, 255, 255);
  pdf.triangle(x, y - arrowHeight / 2, x + arrowWidth / 2, y + arrowHeight / 3, x, y);
  pdf.fill();
  pdf.setDrawColor(30, 30, 30);
  pdf.triangle(x, y - arrowHeight / 2, x + arrowWidth / 2, y + arrowHeight / 3, x, y);
  pdf.stroke();
  
  // N label
  pdf.setFontSize(5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 30, 30);
  pdf.text('N', x - 1.2, y - arrowHeight / 2 - 1.5);
}

// Draw compact scale bar
function drawScaleBar(pdf: jsPDF, x: number, y: number, scaleInfo: ReturnType<typeof calculateScaleBar>) {
  const { value, unit, barWidthMm } = scaleInfo;
  const barHeight = 2;
  
  // Background
  pdf.setFillColor(255, 255, 255);
  pdf.setGState(pdf.GState({ opacity: 0.85 }));
  pdf.roundedRect(x - 2, y - 2, barWidthMm + 20, 10, 1, 1, 'F');
  pdf.setGState(pdf.GState({ opacity: 1 }));
  
  // Scale bar segments
  pdf.setFillColor(30, 30, 30);
  pdf.rect(x, y, barWidthMm / 2, barHeight, 'F');
  
  pdf.setFillColor(255, 255, 255);
  pdf.rect(x + barWidthMm / 2, y, barWidthMm / 2, barHeight, 'F');
  
  pdf.setDrawColor(30, 30, 30);
  pdf.setLineWidth(0.2);
  pdf.rect(x, y, barWidthMm, barHeight, 'S');
  
  // Labels
  pdf.setFontSize(5.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(30, 30, 30);
  pdf.text('0', x, y + 6);
  pdf.text(`${value} ${unit}`, x + barWidthMm - 3, y + 6);
}

// Draw polygon with thin, subtle styling
function drawPolygon(
  pdf: jsPDF, 
  coords: PolygonPoint[], 
  mapX: number, 
  mapY: number, 
  mapWidth: number, 
  mapHeight: number,
  extent: ReturnType<typeof calculateExtent>
) {
  const scaleX = mapWidth / (extent.maxLng - extent.minLng);
  const scaleY = mapHeight / (extent.maxLat - extent.minLat);
  const scale = Math.min(scaleX, scaleY);
  
  const offsetX = mapX + (mapWidth - (extent.maxLng - extent.minLng) * scale) / 2;
  const offsetY = mapY + (mapHeight - (extent.maxLat - extent.minLat) * scale) / 2;
  
  const points = coords.map(c => ({
    x: offsetX + (c.lng - extent.minLng) * scale,
    y: offsetY + (extent.maxLat - c.lat) * scale
  }));
  
  if (points.length < 3) return;
  
  // Fill with transparency
  pdf.setFillColor(COLORS.polygonFill[0], COLORS.polygonFill[1], COLORS.polygonFill[2]);
  pdf.setGState(pdf.GState({ opacity: 0.25 }));
  
  const first = points[0];
  pdf.moveTo(first.x, first.y);
  points.slice(1).forEach(p => pdf.lineTo(p.x, p.y));
  pdf.lineTo(first.x, first.y);
  pdf.fill();
  
  pdf.setGState(pdf.GState({ opacity: 1 }));
  
  // Thin stroke
  pdf.setDrawColor(COLORS.polygonStroke[0], COLORS.polygonStroke[1], COLORS.polygonStroke[2]);
  pdf.setLineWidth(0.4); // Thin line ~1pt
  
  pdf.moveTo(first.x, first.y);
  points.slice(1).forEach(p => pdf.lineTo(p.x, p.y));
  pdf.lineTo(first.x, first.y);
  pdf.stroke();
}

// Draw corner coordinates
function drawCornerCoordinates(
  pdf: jsPDF,
  mapX: number,
  mapY: number,
  mapWidth: number,
  mapHeight: number,
  extent: ReturnType<typeof calculateExtent>
) {
  pdf.setFontSize(4.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(30, 30, 30);
  
  // Top-left
  pdf.text(`${formatCoord(extent.maxLat, true)}`, mapX + 1, mapY + 3);
  pdf.text(`${formatCoord(extent.minLng, false)}`, mapX + 1, mapY + 6);
  
  // Top-right
  pdf.text(`${formatCoord(extent.maxLat, true)}`, mapX + mapWidth - 14, mapY + 3);
  pdf.text(`${formatCoord(extent.maxLng, false)}`, mapX + mapWidth - 14, mapY + 6);
  
  // Bottom-left
  pdf.text(`${formatCoord(extent.minLat, true)}`, mapX + 1, mapY + mapHeight - 4);
  pdf.text(`${formatCoord(extent.minLng, false)}`, mapX + 1, mapY + mapHeight - 1);
  
  // Bottom-right
  pdf.text(`${formatCoord(extent.minLat, true)}`, mapX + mapWidth - 14, mapY + mapHeight - 4);
  pdf.text(`${formatCoord(extent.maxLng, false)}`, mapX + mapWidth - 14, mapY + mapHeight - 1);
}

// Wait for map tiles to fully load with detailed status
async function waitForTilesToLoad(mapElement: HTMLElement, timeout: number = 5000): Promise<{
  loaded: number;
  failed: number;
  total: number;
}> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let loaded = 0;
    let failed = 0;
    
    const checkTiles = () => {
      const tiles = mapElement.querySelectorAll('.leaflet-tile') as NodeListOf<HTMLImageElement>;
      const total = tiles.length;
      loaded = 0;
      failed = 0;
      
      tiles.forEach((tile) => {
        if (tile.complete) {
          if (tile.naturalHeight > 0 && tile.naturalWidth > 0) {
            loaded++;
          } else {
            failed++;
          }
        }
      });
      
      const allProcessed = loaded + failed === total;
      const timedOut = Date.now() - startTime > timeout;
      
      if (allProcessed || timedOut) {
        resolve({ loaded, failed, total });
      } else {
        requestAnimationFrame(checkTiles);
      }
    };
    
    checkTiles();
  });
}

// Preload tiles with CORS for reliable capture
async function preloadTilesWithCORS(tiles: NodeListOf<HTMLImageElement>): Promise<{
  loaded: number;
  failed: number;
}> {
  let loaded = 0;
  let failed = 0;
  
  const preloadPromises = Array.from(tiles).map((tile) => {
    return new Promise<boolean>((resolve) => {
      // If already complete and valid, skip preloading
      if (tile.complete && tile.naturalHeight > 0) {
        loaded++;
        resolve(true);
        return;
      }
      
      const newImg = new Image();
      newImg.crossOrigin = 'anonymous';
      
      const timeoutId = setTimeout(() => {
        failed++;
        resolve(false);
      }, 3000);
      
      newImg.onload = () => {
        clearTimeout(timeoutId);
        loaded++;
        resolve(true);
      };
      
      newImg.onerror = () => {
        clearTimeout(timeoutId);
        failed++;
        resolve(false);
      };
      
      // Add cache-busting for CORS if needed
      const separator = tile.src.includes('?') ? '&' : '?';
      newImg.src = tile.src + separator + '_cors=' + Date.now();
    });
  });
  
  await Promise.all(preloadPromises);
  return { loaded, failed };
}

// Enhanced map capture with detailed feedback and print-quality output
export async function captureMapWithTiles(
  mapElement: HTMLElement,
  onProgress?: (message: string) => void
): Promise<MapCaptureResult> {
  try {
    onProgress?.('Waiting for map tiles to load...');
    
    // Wait for tiles with extended timeout for reliability
    const tileStatus = await waitForTilesToLoad(mapElement, 5000);
    
    if (tileStatus.total === 0) {
      return {
        imageData: null,
        success: false,
        message: 'No map tiles found. The map may not be fully loaded.',
        tilesLoaded: 0,
        tilesFailed: 0
      };
    }
    
    onProgress?.(`Loading ${tileStatus.total} tiles for capture...`);
    
    // Additional wait for complete rendering
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get tiles and preload with CORS
    const tiles = mapElement.querySelectorAll('.leaflet-tile') as NodeListOf<HTMLImageElement>;
    const corsStatus = await preloadTilesWithCORS(tiles);
    
    // Check if too many tiles failed (potential offline issue)
    const failureRate = corsStatus.failed / (corsStatus.loaded + corsStatus.failed);
    if (failureRate > 0.5 && corsStatus.failed > 2) {
      onProgress?.('Warning: Some tiles may be missing or cached...');
    }
    
    onProgress?.('Capturing high-resolution map image...');
    
    // Additional stabilization wait
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Configure html2canvas for print-quality capture
    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: false,
      scale: 3, // Higher resolution for print quality (300 DPI equivalent)
      logging: false,
      backgroundColor: '#f8fafc',
      imageTimeout: 30000,
      removeContainer: true,
      foreignObjectRendering: false,
      windowWidth: mapElement.scrollWidth,
      windowHeight: mapElement.scrollHeight,
      onclone: (clonedDoc, clonedElement) => {
        // Ensure all tile images have crossorigin attribute
        const clonedTiles = clonedElement.querySelectorAll('.leaflet-tile');
        clonedTiles.forEach((tile) => {
          const img = tile as HTMLImageElement;
          img.crossOrigin = 'anonymous';
          // Ensure proper styling for capture
          img.style.imageRendering = 'crisp-edges';
        });
        
        // Hide Leaflet controls in PDF
        const controls = clonedDoc.querySelectorAll('.leaflet-control-container');
        controls.forEach(control => {
          (control as HTMLElement).style.display = 'none';
        });
        
        // Hide basemap selector and other overlays with pdf-hide class
        const pdfHideElements = clonedDoc.querySelectorAll('.pdf-hide');
        pdfHideElements.forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });
        
        // Hide absolute positioned overlays in map container
        const overlays = clonedElement.querySelectorAll('[class*="absolute"]');
        overlays.forEach((overlay) => {
          const el = overlay as HTMLElement;
          if (!el.classList.contains('leaflet-pane') && !el.classList.contains('leaflet-tile-container')) {
            el.style.display = 'none';
          }
        });
        
        // Ensure the tile container maintains correct transform
        const tileContainers = clonedElement.querySelectorAll('.leaflet-tile-container');
        tileContainers.forEach((container) => {
          const el = container as HTMLElement;
          el.style.willChange = 'auto';
        });
      }
    });
    
    // Validate canvas has actual map content (not just background)
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Sample multiple points across the canvas to check for content
      const samplePoints = [
        { x: Math.floor(canvas.width * 0.25), y: Math.floor(canvas.height * 0.25) },
        { x: Math.floor(canvas.width * 0.5), y: Math.floor(canvas.height * 0.5) },
        { x: Math.floor(canvas.width * 0.75), y: Math.floor(canvas.height * 0.75) },
      ];
      
      let hasVariedContent = false;
      const sampledColors = new Set<string>();
      
      for (const point of samplePoints) {
        const imageData = ctx.getImageData(point.x, point.y, 10, 10);
        for (let i = 0; i < imageData.data.length; i += 4) {
          const colorKey = `${imageData.data[i]}-${imageData.data[i+1]}-${imageData.data[i+2]}`;
          sampledColors.add(colorKey);
        }
      }
      
      hasVariedContent = sampledColors.size > 10;
      
      if (!hasVariedContent) {
        return {
          imageData: null,
          success: false,
          message: 'Map capture appears blank. Tiles may not have loaded correctly.',
          tilesLoaded: corsStatus.loaded,
          tilesFailed: corsStatus.failed
        };
      }
    }
    
    const imageData = canvas.toDataURL('image/png', 0.95);
    
    return {
      imageData,
      success: true,
      message: `Basemap successfully embedded in PDF. (${corsStatus.loaded} tiles loaded${corsStatus.failed > 0 ? `, ${corsStatus.failed} missing` : ''})`,
      tilesLoaded: corsStatus.loaded,
      tilesFailed: corsStatus.failed
    };
  } catch (error) {
    console.warn('Map capture failed:', error);
    return {
      imageData: null,
      success: false,
      message: `Map capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      tilesLoaded: 0,
      tilesFailed: 0
    };
  }
}

// Result type for export operations
export interface PdfExportResult {
  success: boolean;
  basemapCaptured: boolean;
  message: string;
}

// Main single-page export function
export async function exportPolygonPdf(
  polygon: PolygonData,
  config: PdfExportConfig,
  mapElement?: HTMLElement | null
): Promise<PdfExportResult> {
  if (polygon.coordinates.length < 3) {
    throw new Error('Polygon must have at least 3 points');
  }
  
  // Determine orientation
  let orientation: 'portrait' | 'landscape' = 'portrait';
  if (config.orientation === 'auto') {
    orientation = determineOptimalOrientation(polygon.coordinates);
  } else if (config.orientation === 'landscape') {
    orientation = 'landscape';
  }
  
  const PAGE = orientation === 'landscape' ? PAGE_LANDSCAPE : PAGE_PORTRAIT;
  
  const pdf = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4',
  });
  
  const margin = PAGE.margin;
  const contentWidth = PAGE.width - margin * 2;
  let y = margin;
  
  // === HEADER SECTION ===
  pdf.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  pdf.rect(0, 0, PAGE.width, 12, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Polygon Map Report', margin, 8);
  
  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric' 
  });
  pdf.text(dateStr, PAGE.width - margin - 18, 8);
  
  y = 16;
  
  // === TITLE ROW ===
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  pdf.text(polygon.name, margin, y);
  
  y += 4;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
  const landUseLabel = LAND_USE_CATEGORIES.find(c => c.value === polygon.landUse)?.label || polygon.landUse;
  pdf.text(`Land Use: ${landUseLabel}  •  Source: ${config.dataSource}  •  CRS: WGS 84`, margin, y);
  
  y += 5;
  
  // === MAP SECTION (Full width, ~55% of page height) ===
  const mapWidth = contentWidth;
  const mapHeight = orientation === 'landscape' ? 85 : 130; // Adjust for orientation
  const mapX = margin;
  const mapY = y;
  
  // Map frame
  pdf.setFillColor(248, 250, 252);
  pdf.rect(mapX, mapY, mapWidth, mapHeight, 'F');
  pdf.setDrawColor(COLORS.tableBorder[0], COLORS.tableBorder[1], COLORS.tableBorder[2]);
  pdf.setLineWidth(0.3);
  pdf.rect(mapX, mapY, mapWidth, mapHeight, 'S');
  
  const extent = calculateExtent(polygon.coordinates);
  
  // Try to capture map image with improved tile handling
  let mapImage: string | null = null;
  let captureResult: MapCaptureResult | null = null;
  
  const shouldIncludeBasemap = config.includeBasemap !== false; // Default to true
  
  if (mapElement && shouldIncludeBasemap) {
    captureResult = await captureMapWithTiles(mapElement);
    mapImage = captureResult.imageData;
  }
  
  if (mapImage) {
    try {
      pdf.addImage(mapImage, 'PNG', mapX + 0.5, mapY + 0.5, mapWidth - 1, mapHeight - 1);
    } catch {
      drawPolygon(pdf, polygon.coordinates, mapX + 8, mapY + 8, mapWidth - 16, mapHeight - 16, extent);
    }
  } else {
    // Draw on clean neutral background (when basemap off or capture failed)
    pdf.setFillColor(245, 247, 250); // Light neutral background
    pdf.rect(mapX, mapY, mapWidth, mapHeight, 'F');
    drawPolygon(pdf, polygon.coordinates, mapX + 8, mapY + 8, mapWidth - 16, mapHeight - 16, extent);
    drawCornerCoordinates(pdf, mapX, mapY, mapWidth, mapHeight, extent);
  }
  
  // Scale bar (bottom-left inside map)
  const scaleInfo = calculateScaleBar(extent, mapWidth);
  drawScaleBar(pdf, mapX + 6, mapY + mapHeight - 14, scaleInfo);
  
  // North arrow (top-right inside map)
  drawNorthArrow(pdf, mapX + mapWidth - 12, mapY + 12, 9);
  
  // Legend (bottom-right inside map)
  const legendX = mapX + mapWidth - 28;
  const legendY = mapY + mapHeight - 14;
  
  pdf.setFillColor(255, 255, 255);
  pdf.setGState(pdf.GState({ opacity: 0.9 }));
  pdf.roundedRect(legendX - 2, legendY - 3, 28, 11, 1, 1, 'F');
  pdf.setGState(pdf.GState({ opacity: 1 }));
  
  pdf.setFontSize(5.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  pdf.text('Legend', legendX, legendY);
  
  pdf.setFillColor(COLORS.polygonFill[0], COLORS.polygonFill[1], COLORS.polygonFill[2]);
  pdf.setGState(pdf.GState({ opacity: 0.3 }));
  pdf.rect(legendX, legendY + 2, 6, 3, 'F');
  pdf.setGState(pdf.GState({ opacity: 1 }));
  pdf.setDrawColor(COLORS.polygonStroke[0], COLORS.polygonStroke[1], COLORS.polygonStroke[2]);
  pdf.setLineWidth(0.4);
  pdf.rect(legendX, legendY + 2, 6, 3, 'S');
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5);
  pdf.text('Polygon', legendX + 8, legendY + 4.5);
  
  y = mapY + mapHeight + 5;
  
  // === INFORMATION PANEL (Below map, 3-column layout) ===
  const colWidth = contentWidth / 3;
  
  // Column 1: Spatial Metrics
  let col1Y = y;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  pdf.text('Spatial Metrics', margin, col1Y);
  
  col1Y += 4;
  
  const edges = calculateEdgeLengths(polygon.coordinates);
  const perimeter = calculatePerimeter(edges);
  const dimensions = calculateDimensions(polygon.coordinates);
  const areaVal = convertArea(polygon.area, config.areaUnit);
  
  const metrics = [
    { label: 'Area', value: `${areaVal.toFixed(4)} ${getUnitLabel(config.areaUnit)}` },
    { label: 'Perimeter', value: formatDistanceCompact(perimeter) },
    { label: 'Length', value: formatDistanceCompact(dimensions.length) },
    { label: 'Breadth', value: formatDistanceCompact(dimensions.breadth) },
    { label: 'Vertices', value: `${polygon.coordinates.length}` },
  ];
  
  pdf.setFontSize(6);
  metrics.forEach((m, i) => {
    const rowY = col1Y + i * 5;
    
    if (i % 2 === 0) {
      pdf.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
      pdf.rect(margin, rowY, colWidth - 3, 5, 'F');
    }
    
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
    pdf.text(m.label, margin + 1, rowY + 3.5);
    
    pdf.setFont('helvetica', 'normal');
    pdf.text(m.value, margin + colWidth - 5, rowY + 3.5, { align: 'right' });
  });
  
  // Column 2: Edge Distances
  let col2Y = y;
  const col2X = margin + colWidth;
  
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  pdf.text('Edge Distances', col2X, col2Y);
  
  col2Y += 4;
  pdf.setFontSize(5.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  
  const maxEdges = Math.min(edges.length, 8);
  for (let i = 0; i < maxEdges; i++) {
    const next = (i + 1) % polygon.coordinates.length;
    const rowY = col2Y + i * 4;
    
    if (i % 2 === 0) {
      pdf.setFillColor(COLORS.tableAlt[0], COLORS.tableAlt[1], COLORS.tableAlt[2]);
      pdf.rect(col2X, rowY - 0.5, colWidth - 3, 4, 'F');
    }
    
    pdf.text(`${i + 1} → ${next + 1}`, col2X + 1, rowY + 2.5);
    pdf.text(formatDistanceCompact(edges[i]), col2X + colWidth - 6, rowY + 2.5, { align: 'right' });
  }
  
  if (edges.length > maxEdges) {
    pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    pdf.text(`+${edges.length - maxEdges} more`, col2X + 1, col2Y + maxEdges * 4 + 2);
  }
  
  // Column 3: Coordinates (compact)
  let col3Y = y;
  const col3X = margin + colWidth * 2;
  
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  pdf.text('Vertex Coordinates', col3X, col3Y);
  
  col3Y += 4;
  pdf.setFontSize(5);
  pdf.setFont('helvetica', 'normal');
  
  const maxCoords = Math.min(polygon.coordinates.length, 10);
  for (let i = 0; i < maxCoords; i++) {
    const coord = polygon.coordinates[i];
    const rowY = col3Y + i * 3.5;
    
    if (i % 2 === 0) {
      pdf.setFillColor(COLORS.tableAlt[0], COLORS.tableAlt[1], COLORS.tableAlt[2]);
      pdf.rect(col3X, rowY - 0.5, colWidth - 3, 3.5, 'F');
    }
    
    pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    pdf.text(`${i + 1}`, col3X + 1, rowY + 2);
    pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
    pdf.text(`${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`, col3X + 6, rowY + 2);
  }
  
  if (polygon.coordinates.length > maxCoords) {
    pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    pdf.text(`+${polygon.coordinates.length - maxCoords} more`, col3X + 1, col3Y + maxCoords * 3.5 + 2);
  }
  
  // Self-intersection warning
  const hasSelfIntersection = checkSelfIntersection(polygon.coordinates);
  if (hasSelfIntersection) {
    y = Math.max(col1Y + metrics.length * 5, col2Y + maxEdges * 4, col3Y + maxCoords * 3.5) + 6;
    
    pdf.setFillColor(255, 245, 245);
    pdf.setDrawColor(200, 80, 80);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(margin, y, contentWidth, 5, 1, 1, 'FD');
    
    pdf.setFontSize(5.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(180, 50, 50);
    pdf.text('⚠ Warning: Self-intersecting polygon detected. Area calculations may be inaccurate.', margin + 2, y + 3.5);
  }
  
  // === BASEMAP ATTRIBUTION ===
  if (config.basemapId) {
    const attribution = getPlainTextAttribution(config.basemapId);
    const attrY = PAGE.height - margin - 16;
    
    pdf.setFontSize(4.5);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    pdf.text(`Basemap: ${attribution}`, margin + 2, attrY);
  }
  
  // === DISCLAIMER FOOTER ===
  const disclaimerY = PAGE.height - margin - 10;
  
  pdf.setFillColor(COLORS.disclaimer[0], COLORS.disclaimer[1], COLORS.disclaimer[2]);
  pdf.rect(margin, disclaimerY, contentWidth, 8, 'F');
  
  pdf.setFontSize(5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
  pdf.text(
    'Disclaimer: Accuracy depends on coordinate precision and projection assumptions. This output is for planning and visualization purposes only.',
    margin + 2, disclaimerY + 3
  );
  pdf.text(
    'It should not replace official cadastral surveys or legal boundary documentation.',
    margin + 2, disclaimerY + 6.5
  );
  
  // Footer line
  pdf.setDrawColor(COLORS.tableBorder[0], COLORS.tableBorder[1], COLORS.tableBorder[2]);
  pdf.setLineWidth(0.2);
  pdf.line(margin, PAGE.height - 5, PAGE.width - margin, PAGE.height - 5);
  
  pdf.setFontSize(4.5);
  pdf.text('Generated by RessComm Plotter', margin, PAGE.height - 2);
  pdf.text(new Date().toLocaleString(), PAGE.width - margin, PAGE.height - 2, { align: 'right' });
  
  // Generate filename
  const fileDateStr = new Date().toISOString().slice(0, 10);
  const safeName = polygon.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25);
  const filename = `${safeName}_PolygonReport_${orientation}_${fileDateStr}.pdf`;
  
  pdf.save(filename);
  
  return {
    success: true,
    basemapCaptured: captureResult?.success ?? false,
    message: captureResult?.message ?? 'PDF exported without basemap'
  };
}

// Export multiple polygons - single page summary
export async function exportMultiplePolygonsPdf(
  polygons: PolygonData[],
  config: PdfExportConfig
): Promise<PdfExportResult> {
  if (polygons.length === 0) {
    throw new Error('No polygons to export');
  }
  
  // Determine orientation based on overall extent
  let orientation: 'portrait' | 'landscape' = 'portrait';
  if (config.orientation === 'auto') {
    const allCoords = polygons.flatMap(p => p.coordinates);
    orientation = determineOptimalOrientation(allCoords);
  } else if (config.orientation === 'landscape') {
    orientation = 'landscape';
  }
  
  const PAGE = orientation === 'landscape' ? PAGE_LANDSCAPE : PAGE_PORTRAIT;
  
  const pdf = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4',
  });
  
  const margin = PAGE.margin;
  const contentWidth = PAGE.width - margin * 2;
  let y = margin;
  
  // === HEADER ===
  pdf.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  pdf.rect(0, 0, PAGE.width, 18, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Multi-Polygon Analysis Report', margin, 11);
  
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  });
  pdf.text(`${polygons.length} Polygons  •  ${config.dataSource}  •  ${dateStr}`, margin, 16);
  
  y = 25;
  
  // === SUMMARY TABLE ===
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  pdf.text('Polygon Summary', margin, y);
  
  y += 5;
  
  // Adjust column widths for orientation
  const colWidths = orientation === 'landscape' 
    ? [80, 45, 25, 35, 45]
    : [55, 35, 20, 25, 35];
  
  // Table header
  pdf.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  pdf.rect(margin, y, contentWidth, 6, 'F');
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  
  let xPos = margin + 2;
  ['Name', 'Land Use', 'Pts', 'Perimeter', `Area (${getUnitLabel(config.areaUnit)})`].forEach((h, i) => {
    pdf.text(h, xPos, y + 4);
    xPos += colWidths[i];
  });
  y += 6;
  
  // Table rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  
  let totalArea = 0;
  let totalPerimeter = 0;
  
  const maxRows = orientation === 'landscape' 
    ? Math.min(polygons.length, 20)
    : Math.min(polygons.length, 30);
  
  for (let i = 0; i < maxRows; i++) {
    const p = polygons[i];
    const edges = calculateEdgeLengths(p.coordinates);
    const perimeter = calculatePerimeter(edges);
    
    if (i % 2 === 0) {
      pdf.setFillColor(COLORS.tableAlt[0], COLORS.tableAlt[1], COLORS.tableAlt[2]);
      pdf.rect(margin, y, contentWidth, 5, 'F');
    }
    
    pdf.setDrawColor(COLORS.tableBorder[0], COLORS.tableBorder[1], COLORS.tableBorder[2]);
    pdf.setLineWidth(0.1);
    pdf.rect(margin, y, contentWidth, 5, 'S');
    
    xPos = margin + 2;
    pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
    
    pdf.text(p.name.slice(0, orientation === 'landscape' ? 40 : 28), xPos, y + 3.5);
    xPos += colWidths[0];
    
    const landUseLabel = LAND_USE_CATEGORIES.find(c => c.value === p.landUse)?.label || p.landUse;
    pdf.text(landUseLabel.slice(0, orientation === 'landscape' ? 20 : 15), xPos, y + 3.5);
    xPos += colWidths[1];
    
    pdf.text(`${p.coordinates.length}`, xPos, y + 3.5);
    xPos += colWidths[2];
    
    pdf.text(formatDistanceCompact(perimeter), xPos, y + 3.5);
    xPos += colWidths[3];
    
    const areaVal = convertArea(p.area, config.areaUnit);
    pdf.text(areaVal.toFixed(4), xPos, y + 3.5);
    
    totalArea += p.area;
    totalPerimeter += perimeter;
    y += 5;
  }
  
  if (polygons.length > maxRows) {
    pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    pdf.text(`... and ${polygons.length - maxRows} more polygons`, margin + 2, y + 3);
    y += 6;
  }
  
  y += 4;
  
  // === TOTALS BOX ===
  pdf.setFillColor(COLORS.primaryLight[0], COLORS.primaryLight[1], COLORS.primaryLight[2]);
  pdf.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  
  pdf.text('Combined Totals:', margin + 4, y + 5);
  pdf.text(`Area: ${convertArea(totalArea, config.areaUnit).toFixed(4)} ${getUnitLabel(config.areaUnit)}`, margin + 4, y + 10);
  pdf.text(`Perimeter: ${formatDistanceCompact(totalPerimeter)}`, margin + 80, y + 10);
  
  y += 18;
  
  // === CRS INFO ===
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  pdf.text('Coordinate Reference: WGS 84 (EPSG:4326) • Projection: Geographic (Lat/Lng)', margin, y);
  
  // === BASEMAP ATTRIBUTION ===
  if (config.basemapId) {
    const attribution = getPlainTextAttribution(config.basemapId);
    const attrY = PAGE.height - margin - 16;
    
    pdf.setFontSize(4.5);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    pdf.text(`Basemap: ${attribution}`, margin + 2, attrY);
  }
  
  // === DISCLAIMER ===
  const disclaimerY = PAGE.height - margin - 10;
  
  pdf.setFillColor(COLORS.disclaimer[0], COLORS.disclaimer[1], COLORS.disclaimer[2]);
  pdf.rect(margin, disclaimerY, contentWidth, 8, 'F');
  
  pdf.setFontSize(5.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
  pdf.text(
    'Disclaimer: Accuracy depends on coordinate precision and projection assumptions. This output is for planning and visualization purposes only.',
    margin + 2, disclaimerY + 3.5
  );
  pdf.text(
    'It should not replace official cadastral surveys or legal boundary documentation.',
    margin + 2, disclaimerY + 7
  );
  
  // Footer
  pdf.setDrawColor(COLORS.tableBorder[0], COLORS.tableBorder[1], COLORS.tableBorder[2]);
  pdf.setLineWidth(0.2);
  pdf.line(margin, PAGE.height - 5, PAGE.width - margin, PAGE.height - 5);
  
  pdf.setFontSize(5);
  pdf.text('Generated by RessComm Plotter', margin, PAGE.height - 2);
  pdf.text(new Date().toLocaleString(), PAGE.width - margin, PAGE.height - 2, { align: 'right' });
  
  // Generate filename
  const fileDateStr = new Date().toISOString().slice(0, 10);
  const filename = `MultiPolygon_Report_${polygons.length}areas_${orientation}_${fileDateStr}.pdf`;
  
  pdf.save(filename);
  
  return {
    success: true,
    basemapCaptured: false,
    message: 'Multi-polygon summary exported (basemap not included in summary view)'
  };
}
