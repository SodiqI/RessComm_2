// PDF Export utilities for Manual and Excel Plotter - Polygon reports
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

export interface PdfExportConfig {
  areaUnit: AreaUnit;
  polygons: PolygonData[];
  dataSource: 'Manual Plotter' | 'Excel Upload';
  mapElement?: HTMLElement | null;
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

// Color palette
const COLORS = {
  forestDark: [27, 67, 50] as [number, number, number],
  forestLight: [76, 127, 93] as [number, number, number],
  textDark: [40, 40, 40] as [number, number, number],
  textMuted: [100, 100, 100] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  warningBg: [255, 250, 240] as [number, number, number],
  warningBorder: [220, 160, 50] as [number, number, number],
  tableBorder: [200, 200, 200] as [number, number, number],
  tableHeader: [240, 245, 250] as [number, number, number],
  tableAlt: [248, 250, 252] as [number, number, number],
};

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
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

// Calculate bounding box dimensions (approximate length and breadth)
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

// Calculate extent
function calculateExtent(coords: PolygonPoint[]): {
  minLat: number; maxLat: number; minLng: number; maxLng: number; centerLat: number; centerLng: number;
} {
  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    centerLat: (Math.min(...lats) + Math.max(...lats)) / 2,
    centerLng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
}

// Calculate scale bar
function calculateScaleBar(extent: ReturnType<typeof calculateExtent>): {
  kmValue: number; mValue: number; barWidthDegrees: number;
} {
  const latDiff = extent.maxLat - extent.minLat;
  const lngDiff = extent.maxLng - extent.minLng;
  const latKm = latDiff * 111;
  const lngKm = lngDiff * 111 * Math.cos((extent.centerLat * Math.PI) / 180);
  const avgKm = (latKm + lngKm) / 2;
  
  const targetBarKm = avgKm / 4;
  const niceValues = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
  const kmValue = niceValues.reduce((prev, curr) => 
    Math.abs(curr - targetBarKm) < Math.abs(prev - targetBarKm) ? curr : prev
  );
  
  return {
    kmValue,
    mValue: kmValue * 1000,
    barWidthDegrees: kmValue / 111,
  };
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
    case 'acres': return 'acres';
    case 'sqMeters': return 'm²';
  }
}

function getUnitFullName(unit: AreaUnit): string {
  switch (unit) {
    case 'hectares': return 'Hectares';
    case 'acres': return 'Acres';
    case 'sqMeters': return 'Square Meters';
  }
}

// Format coordinate for display
function formatCoord(val: number, isLat: boolean): string {
  const absVal = Math.abs(val).toFixed(6);
  if (isLat) {
    return val >= 0 ? `${absVal}°N` : `${absVal}°S`;
  }
  return val >= 0 ? `${absVal}°E` : `${absVal}°W`;
}

// Format distance
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(3)} km`;
  }
  return `${meters.toFixed(2)} m`;
}

// Check for self-intersection (simple check)
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

// Draw header on page
function drawHeader(pdf: jsPDF, title: string, pageNum: number, totalPages: number) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  
  pdf.setFillColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.rect(0, 0, pageWidth, 18, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, 10, 12);
  
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 25, 12);
}

// Draw footer
function drawFooter(pdf: jsPDF) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  pdf.setDrawColor(COLORS.tableBorder[0], COLORS.tableBorder[1], COLORS.tableBorder[2]);
  pdf.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);
  
  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
  pdf.text('RessComm Polygon Analysis Report', 10, pageHeight - 6);
  pdf.text(new Date().toLocaleString(), pageWidth - 50, pageHeight - 6);
}

// Draw scale bar
function drawScaleBar(pdf: jsPDF, x: number, y: number, scaleInfo: ReturnType<typeof calculateScaleBar>, mapWidth: number, extent: ReturnType<typeof calculateExtent>) {
  const { kmValue, mValue } = scaleInfo;
  const mapDegreesWidth = extent.maxLng - extent.minLng;
  const degreesPerPixel = mapDegreesWidth / mapWidth;
  const kmDegrees = kmValue / (111 * Math.cos((extent.centerLat * Math.PI) / 180));
  const barWidth = Math.min(kmDegrees / degreesPerPixel, mapWidth * 0.25);
  
  // Background
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(x - 3, y - 3, barWidth + 35, 18, 2, 2, 'F');
  pdf.setDrawColor(100, 100, 100);
  pdf.roundedRect(x - 3, y - 3, barWidth + 35, 18, 2, 2, 'S');
  
  // Bar
  pdf.setFillColor(0, 0, 0);
  pdf.rect(x, y, barWidth / 2, 4, 'F');
  pdf.setFillColor(255, 255, 255);
  pdf.rect(x + barWidth / 2, y, barWidth / 2, 4, 'F');
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(x, y, barWidth, 4, 'S');
  
  // Labels
  pdf.setFontSize(6);
  pdf.setTextColor(0, 0, 0);
  pdf.text('0', x, y + 9);
  if (kmValue >= 1) {
    pdf.text(`${kmValue} km`, x + barWidth - 5, y + 9);
  } else {
    pdf.text(`${mValue} m`, x + barWidth - 5, y + 9);
  }
}

// Draw north arrow
function drawNorthArrow(pdf: jsPDF, x: number, y: number, size: number = 12) {
  pdf.setFillColor(255, 255, 255);
  pdf.circle(x, y, size / 2 + 2, 'F');
  pdf.setDrawColor(100, 100, 100);
  pdf.circle(x, y, size / 2 + 2, 'S');
  
  pdf.setFillColor(0, 0, 0);
  pdf.triangle(x, y - size / 2, x - size / 4, y + size / 3, x, y + size / 6);
  
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(0, 0, 0);
  pdf.triangle(x, y - size / 2, x + size / 4, y + size / 3, x, y + size / 6);
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('N', x - 2, y - size / 2 - 2);
}

// Draw coordinate labels
function drawCoordinateLabels(pdf: jsPDF, mapX: number, mapY: number, mapWidth: number, mapHeight: number, extent: ReturnType<typeof calculateExtent>) {
  pdf.setFontSize(5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(255, 255, 255);
  
  // Background boxes for readability
  pdf.setFillColor(0, 0, 0);
  pdf.setGState(pdf.GState({ opacity: 0.5 }));
  pdf.rect(mapX + 2, mapY + 2, 28, 8, 'F');
  pdf.rect(mapX + mapWidth - 30, mapY + 2, 28, 8, 'F');
  pdf.rect(mapX + 2, mapY + mapHeight - 10, 28, 8, 'F');
  pdf.rect(mapX + mapWidth - 30, mapY + mapHeight - 10, 28, 8, 'F');
  pdf.setGState(pdf.GState({ opacity: 1 }));
  
  pdf.text(formatCoord(extent.maxLat, true), mapX + 3, mapY + 5);
  pdf.text(formatCoord(extent.minLng, false), mapX + 3, mapY + 9);
  
  pdf.text(formatCoord(extent.maxLat, true), mapX + mapWidth - 29, mapY + 5);
  pdf.text(formatCoord(extent.maxLng, false), mapX + mapWidth - 29, mapY + 9);
  
  pdf.text(formatCoord(extent.minLat, true), mapX + 3, mapY + mapHeight - 6);
  pdf.text(formatCoord(extent.minLng, false), mapX + 3, mapY + mapHeight - 3);
  
  pdf.text(formatCoord(extent.minLat, true), mapX + mapWidth - 29, mapY + mapHeight - 6);
  pdf.text(formatCoord(extent.maxLng, false), mapX + mapWidth - 29, mapY + mapHeight - 3);
}

// Draw disclaimer box
function drawDisclaimer(pdf: jsPDF, x: number, y: number, width: number): number {
  const disclaimerText = [
    'DISCLAIMER:',
    'All spatial measurements and area calculations are derived from user-provided coordinates.',
    'Accuracy depends on coordinate precision, projection assumptions, and data source quality.',
    'This output is intended for planning and visualization purposes only and should not',
    'replace official cadastral surveys or legal boundary documentation.'
  ];
  
  const boxHeight = 32;
  
  pdf.setFillColor(COLORS.warningBg[0], COLORS.warningBg[1], COLORS.warningBg[2]);
  pdf.setDrawColor(COLORS.warningBorder[0], COLORS.warningBorder[1], COLORS.warningBorder[2]);
  pdf.roundedRect(x, y, width, boxHeight, 2, 2, 'FD');
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.warningBorder[0], COLORS.warningBorder[1], COLORS.warningBorder[2]);
  pdf.text(disclaimerText[0], x + 5, y + 7);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  for (let i = 1; i < disclaimerText.length; i++) {
    pdf.text(disclaimerText[i], x + 5, y + 7 + i * 5);
  }
  
  return y + boxHeight + 5;
}

// Page 1: Overview Map
async function drawMapPage(
  pdf: jsPDF,
  polygon: PolygonData,
  config: PdfExportConfig,
  mapImage: string | null
): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 10;
  
  drawHeader(pdf, `${polygon.name} - Map Overview`, 1, 3);
  
  let y = 25;
  
  // Polygon info box
  pdf.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  pdf.roundedRect(margin, y, pageWidth - margin * 2, 18, 2, 2, 'F');
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.text(polygon.name, margin + 5, y + 7);
  
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
  const landUseLabel = LAND_USE_CATEGORIES.find(c => c.value === polygon.landUse)?.label || polygon.landUse;
  pdf.text(`Land Use: ${landUseLabel}`, margin + 5, y + 14);
  
  const areaVal = convertArea(polygon.area, config.areaUnit);
  pdf.text(`Area: ${areaVal.toFixed(4)} ${getUnitLabel(config.areaUnit)}`, pageWidth / 2, y + 14);
  
  y += 25;
  
  // Map
  const mapHeight = 120;
  const mapWidth = pageWidth - margin * 2;
  
  if (mapImage) {
    try {
      pdf.addImage(mapImage, 'PNG', margin, y, mapWidth, mapHeight);
    } catch {
      // Fallback: draw placeholder
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, y, mapWidth, mapHeight, 'F');
      pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
      pdf.setFontSize(10);
      pdf.text('Map Preview', pageWidth / 2 - 15, y + mapHeight / 2);
    }
  } else {
    // Draw simple polygon representation
    pdf.setFillColor(245, 247, 250);
    pdf.rect(margin, y, mapWidth, mapHeight, 'F');
    
    const extent = calculateExtent(polygon.coordinates);
    const scaleX = (mapWidth - 20) / (extent.maxLng - extent.minLng);
    const scaleY = (mapHeight - 20) / (extent.maxLat - extent.minLat);
    const scale = Math.min(scaleX, scaleY);
    
    const offsetX = margin + 10 + ((mapWidth - 20) - (extent.maxLng - extent.minLng) * scale) / 2;
    const offsetY = y + 10 + ((mapHeight - 20) - (extent.maxLat - extent.minLat) * scale) / 2;
    
    // Draw polygon
    pdf.setFillColor(COLORS.forestLight[0], COLORS.forestLight[1], COLORS.forestLight[2]);
    pdf.setDrawColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
    
    const points = polygon.coordinates.map(c => ({
      x: offsetX + (c.lng - extent.minLng) * scale,
      y: offsetY + (extent.maxLat - c.lat) * scale
    }));
    
    if (points.length >= 3) {
      pdf.setGState(pdf.GState({ opacity: 0.4 }));
      const first = points[0];
      pdf.moveTo(first.x, first.y);
      points.slice(1).forEach(p => pdf.lineTo(p.x, p.y));
      pdf.lineTo(first.x, first.y);
      pdf.fill();
      pdf.setGState(pdf.GState({ opacity: 1 }));
      
      pdf.setLineWidth(1.5);
      pdf.moveTo(first.x, first.y);
      points.slice(1).forEach(p => pdf.lineTo(p.x, p.y));
      pdf.lineTo(first.x, first.y);
      pdf.stroke();
      
      // Draw vertices
      pdf.setFillColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
      points.forEach((p, i) => {
        pdf.circle(p.x, p.y, 2, 'F');
        pdf.setFontSize(5);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${i + 1}`, p.x + 3, p.y - 2);
      });
    }
    
    // Scale bar and north arrow
    const scaleInfo = calculateScaleBar(extent);
    drawScaleBar(pdf, margin + 10, y + mapHeight - 18, scaleInfo, mapWidth, extent);
    drawNorthArrow(pdf, pageWidth - margin - 15, y + 15);
    drawCoordinateLabels(pdf, margin, y, mapWidth, mapHeight, extent);
  }
  
  y += mapHeight + 10;
  
  // Legend
  pdf.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  pdf.roundedRect(margin, y, 60, 20, 2, 2, 'F');
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  pdf.text('Legend', margin + 5, y + 6);
  
  pdf.setFillColor(COLORS.forestLight[0], COLORS.forestLight[1], COLORS.forestLight[2]);
  pdf.rect(margin + 5, y + 9, 8, 6, 'F');
  pdf.setDrawColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.rect(margin + 5, y + 9, 8, 6, 'S');
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  pdf.text('Polygon Boundary', margin + 16, y + 14);
  
  drawFooter(pdf);
}

// Page 2: Spatial Metrics Summary
function drawMetricsPage(pdf: jsPDF, polygon: PolygonData, config: PdfExportConfig): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  
  drawHeader(pdf, `${polygon.name} - Spatial Metrics`, 2, 3);
  
  let y = 28;
  
  const edges = calculateEdgeLengths(polygon.coordinates);
  const perimeter = calculatePerimeter(edges);
  const dimensions = calculateDimensions(polygon.coordinates);
  
  // Edge Lengths Table
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.text('Point-to-Point Distances', margin, y);
  y += 6;
  
  const tableWidth = contentWidth;
  const colWidths = [25, 55, 55, 45];
  
  // Table header
  pdf.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  pdf.rect(margin, y, tableWidth, 8, 'F');
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  
  const headers = ['Edge', 'From Point', 'To Point', 'Distance'];
  let xPos = margin + 2;
  headers.forEach((h, i) => {
    pdf.text(h, xPos, y + 5);
    xPos += colWidths[i];
  });
  y += 8;
  
  // Table rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  
  const maxRows = Math.min(edges.length, 15);
  for (let i = 0; i < maxRows; i++) {
    const next = (i + 1) % polygon.coordinates.length;
    
    if (i % 2 === 0) {
      pdf.setFillColor(COLORS.tableAlt[0], COLORS.tableAlt[1], COLORS.tableAlt[2]);
      pdf.rect(margin, y, tableWidth, 7, 'F');
    }
    
    pdf.setDrawColor(COLORS.tableBorder[0], COLORS.tableBorder[1], COLORS.tableBorder[2]);
    pdf.rect(margin, y, tableWidth, 7, 'S');
    
    pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
    xPos = margin + 2;
    
    pdf.text(`${i + 1} → ${next + 1}`, xPos, y + 5);
    xPos += colWidths[0];
    
    pdf.text(`${polygon.coordinates[i].lat.toFixed(6)}, ${polygon.coordinates[i].lng.toFixed(6)}`, xPos, y + 5);
    xPos += colWidths[1];
    
    pdf.text(`${polygon.coordinates[next].lat.toFixed(6)}, ${polygon.coordinates[next].lng.toFixed(6)}`, xPos, y + 5);
    xPos += colWidths[2];
    
    pdf.text(formatDistance(edges[i]), xPos, y + 5);
    y += 7;
  }
  
  if (edges.length > maxRows) {
    pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    pdf.text(`... and ${edges.length - maxRows} more edges`, margin + 5, y + 5);
    y += 8;
  }
  
  y += 10;
  
  // Summary Metrics Box
  pdf.setFillColor(COLORS.forestLight[0], COLORS.forestLight[1], COLORS.forestLight[2]);
  pdf.roundedRect(margin, y, contentWidth, 45, 3, 3, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Summary Metrics', margin + 5, y + 8);
  
  y += 14;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  
  // Grid of metrics
  const metrics = [
    ['Total Perimeter:', formatDistance(perimeter)],
    ['Number of Points:', `${polygon.coordinates.length}`],
    ['Approx. Length:', formatDistance(dimensions.length)],
    ['Approx. Breadth:', formatDistance(dimensions.breadth)],
    [`Area (${getUnitFullName(config.areaUnit)}):`, `${convertArea(polygon.area, config.areaUnit).toFixed(4)} ${getUnitLabel(config.areaUnit)}`],
    ['Area (m²):', `${polygon.area.toFixed(2)} m²`],
  ];
  
  const col1X = margin + 5;
  const col2X = margin + contentWidth / 2 + 5;
  let metricsY = y;
  
  metrics.forEach((m, i) => {
    const x = i % 2 === 0 ? col1X : col2X;
    const yOffset = Math.floor(i / 2) * 8;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(m[0], x, metricsY + yOffset);
    pdf.setFont('helvetica', 'normal');
    pdf.text(m[1], x + 40, metricsY + yOffset);
  });
  
  drawFooter(pdf);
}

// Page 3: Metadata & Disclaimer
function drawMetadataPage(pdf: jsPDF, polygon: PolygonData, config: PdfExportConfig): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  
  drawHeader(pdf, `${polygon.name} - Metadata & Disclaimer`, 3, 3);
  
  let y = 28;
  
  // Coordinate Reference
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.text('Coordinate Reference Information', margin, y);
  y += 6;
  
  pdf.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  pdf.roundedRect(margin, y, contentWidth, 25, 2, 2, 'F');
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  
  const crsInfo = [
    ['Coordinate System:', 'WGS 84 (EPSG:4326)'],
    ['Projection:', 'Geographic (Latitude/Longitude)'],
    ['Datum:', 'World Geodetic System 1984'],
  ];
  
  let infoY = y + 6;
  crsInfo.forEach(info => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(info[0], margin + 5, infoY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(info[1], margin + 50, infoY);
    infoY += 6;
  });
  
  y += 32;
  
  // Export Metadata
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.text('Export Information', margin, y);
  y += 6;
  
  pdf.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  pdf.roundedRect(margin, y, contentWidth, 30, 2, 2, 'F');
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  
  const exportDate = new Date();
  const exportInfo = [
    ['Export Date:', exportDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
    ['Export Time:', exportDate.toLocaleTimeString()],
    ['Data Source:', config.dataSource],
    ['Area Unit Selected:', getUnitFullName(config.areaUnit)],
  ];
  
  infoY = y + 6;
  exportInfo.forEach(info => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(info[0], margin + 5, infoY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(info[1], margin + 50, infoY);
    infoY += 6;
  });
  
  y += 38;
  
  // Self-intersection warning if applicable
  const hasSelfIntersection = checkSelfIntersection(polygon.coordinates);
  if (hasSelfIntersection) {
    pdf.setFillColor(255, 235, 235);
    pdf.setDrawColor(220, 50, 50);
    pdf.roundedRect(margin, y, contentWidth, 12, 2, 2, 'FD');
    
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(180, 40, 40);
    pdf.text('⚠ WARNING: Self-intersecting polygon detected. Area calculations may be inaccurate.', margin + 5, y + 7);
    y += 18;
  }
  
  // Vertex coordinates table
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.text('Vertex Coordinates', margin, y);
  y += 6;
  
  const vtxColWidths = [20, 60, 60];
  
  pdf.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  pdf.rect(margin, y, 140, 7, 'F');
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  
  let vtxX = margin + 2;
  ['Point', 'Latitude', 'Longitude'].forEach((h, i) => {
    pdf.text(h, vtxX, y + 5);
    vtxX += vtxColWidths[i];
  });
  y += 7;
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  
  const maxVtx = Math.min(polygon.coordinates.length, 12);
  for (let i = 0; i < maxVtx; i++) {
    if (i % 2 === 0) {
      pdf.setFillColor(COLORS.tableAlt[0], COLORS.tableAlt[1], COLORS.tableAlt[2]);
      pdf.rect(margin, y, 140, 6, 'F');
    }
    pdf.setDrawColor(COLORS.tableBorder[0], COLORS.tableBorder[1], COLORS.tableBorder[2]);
    pdf.rect(margin, y, 140, 6, 'S');
    
    vtxX = margin + 2;
    pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
    pdf.text(`${i + 1}`, vtxX, y + 4);
    vtxX += vtxColWidths[0];
    pdf.text(formatCoord(polygon.coordinates[i].lat, true), vtxX, y + 4);
    vtxX += vtxColWidths[1];
    pdf.text(formatCoord(polygon.coordinates[i].lng, false), vtxX, y + 4);
    y += 6;
  }
  
  if (polygon.coordinates.length > maxVtx) {
    pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    pdf.text(`... and ${polygon.coordinates.length - maxVtx} more vertices`, margin + 5, y + 4);
    y += 8;
  }
  
  y += 10;
  
  // Disclaimer
  drawDisclaimer(pdf, margin, y, contentWidth);
  
  drawFooter(pdf);
}

// Main export function
export async function exportPolygonPdf(
  polygon: PolygonData,
  config: PdfExportConfig,
  mapElement?: HTMLElement | null
): Promise<void> {
  if (polygon.coordinates.length < 3) {
    throw new Error('Polygon must have at least 3 points');
  }
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  // Capture map if element provided
  let mapImage: string | null = null;
  if (mapElement) {
    try {
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        logging: false,
      });
      mapImage = canvas.toDataURL('image/png');
    } catch {
      console.warn('Could not capture map image');
    }
  }
  
  // Page 1: Map Overview
  await drawMapPage(pdf, polygon, config, mapImage);
  
  // Page 2: Spatial Metrics
  pdf.addPage();
  drawMetricsPage(pdf, polygon, config);
  
  // Page 3: Metadata & Disclaimer
  pdf.addPage();
  drawMetadataPage(pdf, polygon, config);
  
  // Generate filename
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = polygon.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const filename = `${safeName}_PolygonReport_${dateStr}.pdf`;
  
  pdf.save(filename);
}

// Export multiple polygons
export async function exportMultiplePolygonsPdf(
  polygons: PolygonData[],
  config: PdfExportConfig
): Promise<void> {
  if (polygons.length === 0) {
    throw new Error('No polygons to export');
  }
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  
  // Cover page
  pdf.setFillColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.rect(0, 0, pageWidth, 50, 'F');
  pdf.setFillColor(COLORS.forestLight[0], COLORS.forestLight[1], COLORS.forestLight[2]);
  pdf.rect(0, 50, pageWidth, 4, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Polygon Analysis Report', margin, 28);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${polygons.length} Polygons • ${config.dataSource}`, margin, 40);
  pdf.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), margin, 46);
  
  let y = 65;
  
  // Summary table
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.text('Summary', margin, y);
  y += 8;
  
  const sumColWidths = [50, 35, 50, 35];
  
  pdf.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  pdf.rect(margin, y, contentWidth, 8, 'F');
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  
  let xPos = margin + 2;
  ['Polygon Name', 'Land Use', 'Points', `Area (${getUnitLabel(config.areaUnit)})`].forEach((h, i) => {
    pdf.text(h, xPos, y + 5);
    xPos += sumColWidths[i];
  });
  y += 8;
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  
  let totalArea = 0;
  polygons.slice(0, 25).forEach((p, i) => {
    if (i % 2 === 0) {
      pdf.setFillColor(COLORS.tableAlt[0], COLORS.tableAlt[1], COLORS.tableAlt[2]);
      pdf.rect(margin, y, contentWidth, 6, 'F');
    }
    pdf.setDrawColor(COLORS.tableBorder[0], COLORS.tableBorder[1], COLORS.tableBorder[2]);
    pdf.rect(margin, y, contentWidth, 6, 'S');
    
    xPos = margin + 2;
    pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
    pdf.text(p.name.slice(0, 25), xPos, y + 4);
    xPos += sumColWidths[0];
    
    const landUseLabel = LAND_USE_CATEGORIES.find(c => c.value === p.landUse)?.label || p.landUse;
    pdf.text(landUseLabel.slice(0, 15), xPos, y + 4);
    xPos += sumColWidths[1];
    
    pdf.text(`${p.coordinates.length}`, xPos, y + 4);
    xPos += sumColWidths[2];
    
    const areaVal = convertArea(p.area, config.areaUnit);
    pdf.text(areaVal.toFixed(4), xPos, y + 4);
    
    totalArea += p.area;
    y += 6;
  });
  
  if (polygons.length > 25) {
    pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    pdf.text(`... and ${polygons.length - 25} more polygons`, margin + 5, y + 4);
    y += 8;
  }
  
  y += 10;
  
  // Total area
  pdf.setFillColor(COLORS.forestLight[0], COLORS.forestLight[1], COLORS.forestLight[2]);
  pdf.roundedRect(margin, y, contentWidth, 15, 2, 2, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Total Combined Area:', margin + 5, y + 9);
  pdf.text(`${convertArea(totalArea, config.areaUnit).toFixed(4)} ${getUnitLabel(config.areaUnit)}`, margin + 60, y + 9);
  
  y += 25;
  
  // Disclaimer
  drawDisclaimer(pdf, margin, y, contentWidth);
  
  drawFooter(pdf);
  
  // Generate filename
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `MultiPolygon_Report_${polygons.length}areas_${dateStr}.pdf`;
  
  pdf.save(filename);
}
