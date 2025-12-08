// PDF Export utilities for ZULIM - Multi-page comprehensive reports
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { AnalysisResults, AnalysisConfig, ColorScheme, LayerVisibility } from '@/types/spatial';
import { getSchemeColors, getColorForClass } from './colorSchemes';

// Algorithm display names
const ALGORITHM_NAMES: Record<string, string> = {
  'idw': 'Inverse Distance Weighting (IDW)',
  'rf': 'Random Forest Regression',
  'svr': 'Support Vector Machine (SVM)',
  'kriging': 'Ordinary Kriging',
  'regression-kriging': 'Regression-Kriging'
};

// RPE method display names
const RPE_METHOD_NAMES: Record<string, string> = {
  'convex-hull': 'Convex Hull + Buffer',
  'kernel-density': 'Kernel Density Threshold',
  'distance': 'Distance-to-Training-Points Limit',
  'uncertainty': 'Uncertainty Threshold',
  'combined': 'Combined Approach'
};

// Layer titles and descriptions
const LAYER_INFO = {
  'single-variable': {
    continuous: {
      title: 'Interpolated Surface (Continuous Raster)',
      short: 'Interpolated Surface',
      description: 'Spatially interpolated values using inverse distance weighting from sample points.'
    },
    classified: {
      title: 'Classified Surface',
      short: 'Classified Map',
      description: 'Discrete classification of continuous values into user-defined classes.'
    },
    accuracy: {
      title: 'Cross-Validation Accuracy Surface',
      short: 'Accuracy Map',
      description: 'Spatial distribution of prediction reliability based on cross-validation residuals.'
    },
    rpe: {
      title: 'Reliable Prediction Extent (RPE) Mask',
      short: 'RPE Layer',
      description: 'Boundary indicating where predictions have adequate data support.'
    }
  },
  'predictor-based': {
    continuous: {
      title: 'Model-Based Predicted Surface',
      short: 'Predicted Surface',
      description: 'Regression-based predictions using machine learning with predictor variables.'
    },
    residuals: {
      title: 'Residual Map (Observed – Predicted)',
      short: 'Residual Map',
      description: 'Difference between observed values and model predictions at sample locations.'
    },
    uncertainty: {
      title: 'Prediction Uncertainty Surface',
      short: 'Uncertainty Map',
      description: 'Spatial distribution of prediction confidence based on model variance.'
    },
    rpe: {
      title: 'Reliable Prediction Extent (RPE) Layer',
      short: 'RPE Layer',
      description: 'Boundary identifying areas with reliable vs. extrapolated predictions.'
    }
  }
};

// Color tuples for styling
const COLORS = {
  forestDark: [27, 67, 50] as [number, number, number],
  forestLight: [76, 127, 93] as [number, number, number],
  textDark: [40, 40, 40] as [number, number, number],
  textMuted: [100, 100, 100] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  warningBg: [255, 245, 240] as [number, number, number],
  warningBorder: [244, 67, 54] as [number, number, number],
  successGreen: [76, 175, 80] as [number, number, number],
  errorRed: [244, 67, 54] as [number, number, number]
};

// Generate filename based on analysis settings
export function generatePdfFilename(
  results: AnalysisResults,
  config: AnalysisConfig,
  exportType: 'full' | 'single' = 'full',
  layerName?: string
): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
  const algorithmShort = config.algorithm.toUpperCase();
  const analysisShort = results.analysisType === 'predictor-based' ? 'Predictor' : 'SingleVar';
  
  if (exportType === 'single' && layerName) {
    return `${algorithmShort}_${analysisShort}_${layerName}_${dateStr}_${timeStr}.pdf`;
  }
  return `${algorithmShort}_${analysisShort}_FullReport_${dateStr}_${timeStr}.pdf`;
}

// Parse RGB from CSS color string
function parseRgb(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const match = color.match(/[a-fA-F0-9]{2}/g);
    if (match && match.length >= 3) {
      return [parseInt(match[0], 16), parseInt(match[1], 16), parseInt(match[2], 16)];
    }
  }
  const rgbMatch = color.match(/\d+/g);
  return rgbMatch ? [Number(rgbMatch[0]), Number(rgbMatch[1]), Number(rgbMatch[2])] : [128, 128, 128];
}

// Calculate map extent from grid
function calculateExtent(grid: { lat: number; lng: number }[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
} {
  if (grid.length === 0) {
    return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0, centerLat: 0, centerLng: 0 };
  }
  const lats = grid.map(c => c.lat);
  const lngs = grid.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    centerLat: (minLat + maxLat) / 2,
    centerLng: (minLng + maxLng) / 2
  };
}

// Calculate scale bar values
function calculateScaleBar(extent: ReturnType<typeof calculateExtent>): {
  kmValue: number;
  miValue: number;
  barWidthDegrees: number;
} {
  const latDiff = extent.maxLat - extent.minLat;
  const lngDiff = extent.maxLng - extent.minLng;
  // Approximate degrees to km (at equator ~111km per degree)
  const latKm = latDiff * 111;
  const lngKm = lngDiff * 111 * Math.cos((extent.centerLat * Math.PI) / 180);
  const avgKm = (latKm + lngKm) / 2;
  
  // Choose a nice round scale bar value
  const targetBarKm = avgKm / 5; // Aim for 1/5 of map width
  const niceValues = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  const kmValue = niceValues.reduce((prev, curr) => 
    Math.abs(curr - targetBarKm) < Math.abs(prev - targetBarKm) ? curr : prev
  );
  
  return {
    kmValue,
    miValue: parseFloat((kmValue * 0.621371).toFixed(2)),
    barWidthDegrees: kmValue / 111
  };
}

// Draw scale bar on PDF
function drawScaleBar(
  pdf: jsPDF,
  x: number,
  y: number,
  scaleInfo: ReturnType<typeof calculateScaleBar>,
  mapWidth: number,
  extent: ReturnType<typeof calculateExtent>
) {
  const { kmValue, miValue } = scaleInfo;
  const mapDegreesWidth = extent.maxLng - extent.minLng;
  const degreesPerPixel = mapDegreesWidth / mapWidth;
  const kmDegrees = kmValue / (111 * Math.cos((extent.centerLat * Math.PI) / 180));
  const barWidth = Math.min(kmDegrees / degreesPerPixel, mapWidth * 0.3);
  
  // Draw bar background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(x - 2, y - 2, barWidth + 24, 16, 'F');
  
  // Draw black bar
  pdf.setFillColor(0, 0, 0);
  pdf.rect(x, y, barWidth / 2, 4, 'F');
  pdf.setFillColor(255, 255, 255);
  pdf.rect(x + barWidth / 2, y, barWidth / 2, 4, 'F');
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(x, y, barWidth, 4, 'S');
  
  // Add ticks
  pdf.setLineWidth(0.3);
  pdf.line(x, y, x, y + 6);
  pdf.line(x + barWidth / 2, y, x + barWidth / 2, y + 5);
  pdf.line(x + barWidth, y, x + barWidth, y + 6);
  
  // Add labels
  pdf.setFontSize(7);
  pdf.setTextColor(0, 0, 0);
  pdf.text('0', x, y + 10);
  pdf.text(`${kmValue} km`, x + barWidth - 5, y + 10);
  pdf.text(`(${miValue} mi)`, x + barWidth - 5, y + 14);
}

// Draw north arrow on PDF
function drawNorthArrow(pdf: jsPDF, x: number, y: number, size: number = 15) {
  // Background circle
  pdf.setFillColor(255, 255, 255);
  pdf.circle(x, y, size / 2 + 2, 'F');
  pdf.setDrawColor(100, 100, 100);
  pdf.circle(x, y, size / 2 + 2, 'S');
  
  // Arrow body
  pdf.setFillColor(0, 0, 0);
  pdf.triangle(
    x, y - size / 2,      // Top point
    x - size / 4, y + size / 3, // Bottom left
    x, y + size / 6       // Bottom center
  );
  
  // White half of arrow
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(0, 0, 0);
  pdf.triangle(
    x, y - size / 2,      // Top point
    x + size / 4, y + size / 3, // Bottom right
    x, y + size / 6       // Bottom center
  );
  pdf.setLineWidth(0.3);
  pdf.line(x, y - size / 2, x + size / 4, y + size / 3);
  
  // N label
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('N', x - 2, y - size / 2 - 3);
}

// Draw coordinate labels
function drawCoordinateLabels(
  pdf: jsPDF,
  mapX: number,
  mapY: number,
  mapWidth: number,
  mapHeight: number,
  extent: ReturnType<typeof calculateExtent>
) {
  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80, 80, 80);
  
  // Format coordinate
  const formatCoord = (val: number, isLat: boolean) => {
    const absVal = Math.abs(val).toFixed(4);
    if (isLat) {
      return val >= 0 ? `${absVal}°N` : `${absVal}°S`;
    }
    return val >= 0 ? `${absVal}°E` : `${absVal}°W`;
  };
  
  // Corner coordinates
  pdf.text(formatCoord(extent.maxLat, true), mapX + 2, mapY + 6);
  pdf.text(formatCoord(extent.minLng, false), mapX + 2, mapY + 11);
  
  pdf.text(formatCoord(extent.maxLat, true), mapX + mapWidth - 20, mapY + 6);
  pdf.text(formatCoord(extent.maxLng, false), mapX + mapWidth - 20, mapY + 11);
  
  pdf.text(formatCoord(extent.minLat, true), mapX + 2, mapY + mapHeight - 6);
  pdf.text(formatCoord(extent.minLng, false), mapX + 2, mapY + mapHeight - 1);
  
  pdf.text(formatCoord(extent.minLat, true), mapX + mapWidth - 20, mapY + mapHeight - 6);
  pdf.text(formatCoord(extent.maxLng, false), mapX + mapWidth - 20, mapY + mapHeight - 1);
}

// Draw legend for continuous data
function drawContinuousLegend(
  pdf: jsPDF,
  x: number,
  y: number,
  title: string,
  minVal: number,
  maxVal: number,
  colorScheme: ColorScheme,
  labels?: { low: string; high: string }
) {
  const legendWidth = 60;
  const legendHeight = 8;
  
  // Title
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  pdf.text(title, x, y);
  
  y += 5;
  
  // Draw gradient
  const schemeColors = getSchemeColors(colorScheme);
  const steps = 25;
  const stepWidth = legendWidth / steps;
  
  for (let i = 0; i < steps; i++) {
    const colorIdx = Math.floor((i / steps) * (schemeColors.length - 1));
    const nextIdx = Math.min(colorIdx + 1, schemeColors.length - 1);
    const t = ((i / steps) * (schemeColors.length - 1)) % 1;
    
    const c1 = parseRgb(schemeColors[colorIdx]);
    const c2 = parseRgb(schemeColors[nextIdx]);
    
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    
    pdf.setFillColor(r, g, b);
    pdf.rect(x + i * stepWidth, y, stepWidth + 0.5, legendHeight, 'F');
  }
  
  // Border
  pdf.setDrawColor(100, 100, 100);
  pdf.rect(x, y, legendWidth, legendHeight, 'S');
  
  // Value labels
  y += legendHeight + 4;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text(minVal.toFixed(2), x, y);
  pdf.text(maxVal.toFixed(2), x + legendWidth - 10, y);
  
  // Interpretation labels
  if (labels) {
    y += 5;
    pdf.setFontSize(6);
    pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    pdf.text(labels.low, x, y);
    pdf.text(labels.high, x + legendWidth - pdf.getTextWidth(labels.high), y);
  }
  
  return y + 5;
}

// Draw legend for classified data
function drawClassifiedLegend(
  pdf: jsPDF,
  x: number,
  y: number,
  numClasses: number,
  minVal: number,
  maxVal: number
) {
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  pdf.text('Classification Classes', x, y);
  
  y += 6;
  const classRange = (maxVal - minVal) / numClasses;
  
  for (let i = 0; i < numClasses; i++) {
    const color = getColorForClass(i, numClasses);
    const rgb = parseRgb(color);
    pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
    pdf.rect(x, y, 10, 5, 'F');
    pdf.setDrawColor(100, 100, 100);
    pdf.rect(x, y, 10, 5, 'S');
    
    const low = minVal + i * classRange;
    const high = minVal + (i + 1) * classRange;
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
    pdf.text(`Class ${i + 1}: ${low.toFixed(2)} - ${high.toFixed(2)}`, x + 12, y + 4);
    y += 7;
  }
  
  return y;
}

// Draw RPE legend
function drawRPELegend(pdf: jsPDF, x: number, y: number, rpeMethod: string) {
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  pdf.text('Reliability Zones', x, y);
  
  y += 6;
  
  // High reliability
  pdf.setFillColor(COLORS.successGreen[0], COLORS.successGreen[1], COLORS.successGreen[2]);
  pdf.rect(x, y, 10, 5, 'F');
  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'normal');
  pdf.text('High reliability (within RPE)', x + 12, y + 4);
  
  y += 7;
  
  // Low reliability
  pdf.setFillColor(COLORS.errorRed[0], COLORS.errorRed[1], COLORS.errorRed[2]);
  pdf.rect(x, y, 10, 5, 'F');
  pdf.text('Low reliability (outside RPE)', x + 12, y + 4);
  
  y += 10;
  pdf.setFontSize(6);
  pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
  pdf.text(`Method: ${RPE_METHOD_NAMES[rpeMethod] || rpeMethod}`, x, y);
  
  return y + 5;
}

// Draw a single map page
async function drawMapPage(
  pdf: jsPDF,
  layerKey: string,
  layerInfo: { title: string; short: string; description: string },
  results: AnalysisResults,
  config: AnalysisConfig,
  colorScheme: ColorScheme,
  mapRef: React.RefObject<HTMLDivElement>,
  pageNum: number,
  totalPages: number,
  onProgress?: (progress: number, message: string) => void
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  
  // Header bar
  pdf.setFillColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.rect(0, 0, pageWidth, 22, 'F');
  
  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(layerInfo.title, margin, 12);
  
  // Method badge
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${ALGORITHM_NAMES[config.algorithm] || config.algorithm}`, margin, 18);
  
  // Analysis type badge
  const badge = results.analysisType === 'single-variable' ? 'Pure Interpolation' : 'Model-Based Prediction';
  pdf.setFillColor(COLORS.forestLight[0], COLORS.forestLight[1], COLORS.forestLight[2]);
  const badgeWidth = pdf.getTextWidth(badge) + 8;
  pdf.roundedRect(pageWidth - margin - badgeWidth, 6, badgeWidth, 10, 2, 2, 'F');
  pdf.setFontSize(7);
  pdf.text(badge, pageWidth - margin - badgeWidth + 4, 12);
  
  let y = 28;
  
  // Calculate extent
  const extent = calculateExtent(results.continuous.grid);
  const scaleInfo = calculateScaleBar(extent);
  
  // Map area dimensions - maintain aspect ratio
  const gridWidth = extent.maxLng - extent.minLng;
  const gridHeight = extent.maxLat - extent.minLat;
  const aspectRatio = gridWidth / (gridHeight || 1);
  
  const maxMapWidth = contentWidth - 70; // Leave space for legend
  const maxMapHeight = 110;
  
  let mapWidth: number, mapHeight: number;
  if (aspectRatio > maxMapWidth / maxMapHeight) {
    mapWidth = maxMapWidth;
    mapHeight = mapWidth / aspectRatio;
  } else {
    mapHeight = maxMapHeight;
    mapWidth = mapHeight * aspectRatio;
  }
  
  // Capture map
  const mapX = margin;
  const mapY = y;
  
  if (mapRef.current) {
    try {
      onProgress?.(50 + pageNum * 5, `Capturing ${layerInfo.short}...`);
      
      const canvas = await html2canvas(mapRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        logging: false,
        backgroundColor: '#f5f5f5'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgAspect = canvas.width / canvas.height;
      
      // Use actual image aspect ratio
      if (imgAspect > maxMapWidth / maxMapHeight) {
        mapWidth = maxMapWidth;
        mapHeight = mapWidth / imgAspect;
      } else {
        mapHeight = maxMapHeight;
        mapWidth = mapHeight * imgAspect;
      }
      
      // Draw map frame
      pdf.setDrawColor(100, 100, 100);
      pdf.setLineWidth(0.5);
      pdf.rect(mapX - 1, mapY - 1, mapWidth + 2, mapHeight + 2, 'S');
      
      pdf.addImage(imgData, 'PNG', mapX, mapY, mapWidth, mapHeight);
      
      // Draw scale bar
      drawScaleBar(pdf, mapX + 5, mapY + mapHeight - 18, scaleInfo, mapWidth, extent);
      
      // Draw north arrow
      drawNorthArrow(pdf, mapX + mapWidth - 12, mapY + 12);
      
      // Draw coordinate labels
      drawCoordinateLabels(pdf, mapX, mapY, mapWidth, mapHeight, extent);
      
    } catch (e) {
      console.warn('Could not capture map screenshot', e);
      pdf.setFillColor(245, 245, 245);
      pdf.rect(mapX, mapY, mapWidth, mapHeight, 'F');
      pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
      pdf.setFontSize(10);
      pdf.text('Map capture unavailable', mapX + mapWidth / 2 - 20, mapY + mapHeight / 2);
    }
  }
  
  // Legend area (right side)
  const legendX = mapX + mapWidth + 8;
  let legendY = mapY;
  
  // Draw appropriate legend
  switch (layerKey) {
    case 'continuous':
      legendY = drawContinuousLegend(
        pdf, legendX, legendY,
        results.analysisType === 'single-variable' ? 'Interpolated Values' : 'Predicted Values',
        results.continuous.minVal,
        results.continuous.maxVal,
        colorScheme,
        { low: 'Low', high: 'High' }
      );
      break;
      
    case 'classified':
      legendY = drawClassifiedLegend(
        pdf, legendX, legendY,
        config.numClasses,
        results.continuous.minVal,
        results.continuous.maxVal
      );
      break;
      
    case 'accuracy':
      legendY = drawContinuousLegend(
        pdf, legendX, legendY,
        'Accuracy (CV Error)',
        0, 1,
        'greens',
        { low: 'High error', high: 'Low error' }
      );
      break;
      
    case 'residuals':
      const maxResidual = results.residuals 
        ? Math.max(...results.residuals.map(c => Math.abs(c.residual || 0)))
        : 1;
      legendY = drawContinuousLegend(
        pdf, legendX, legendY,
        'Residuals (Obs - Pred)',
        -maxResidual,
        maxResidual,
        'coolwarm',
        { low: 'Over-predict', high: 'Under-predict' }
      );
      break;
      
    case 'uncertainty':
      legendY = drawContinuousLegend(
        pdf, legendX, legendY,
        'Uncertainty Level',
        0, 1,
        'plasma',
        { low: 'High confidence', high: 'Low confidence' }
      );
      break;
      
    case 'rpe':
      legendY = drawRPELegend(pdf, legendX, legendY, config.rpeMethod);
      break;
  }
  
  // CRS info below legend
  legendY += 5;
  pdf.setFontSize(6);
  pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
  pdf.text('CRS: EPSG:4326', legendX, legendY);
  pdf.text('(WGS 84)', legendX, legendY + 4);
  legendY += 10;
  pdf.text(`Resolution: ${config.gridResolution}°`, legendX, legendY);
  
  // Description below map
  y = mapY + mapHeight + 8;
  pdf.setFillColor(245, 250, 245);
  pdf.roundedRect(margin, y, contentWidth, 18, 2, 2, 'F');
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.text('Description', margin + 3, y + 5);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  pdf.text(layerInfo.description, margin + 3, y + 11);
  
  // Extent info
  y += 22;
  pdf.setFontSize(6);
  pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
  pdf.text(
    `Extent: ${extent.minLng.toFixed(4)}°E to ${extent.maxLng.toFixed(4)}°E, ${extent.minLat.toFixed(4)}°N to ${extent.maxLat.toFixed(4)}°N`,
    margin, y
  );
  
  // RPE warning for non-RPE layers
  if (layerKey !== 'rpe') {
    y += 6;
    pdf.setFillColor(COLORS.warningBg[0], COLORS.warningBg[1], COLORS.warningBg[2]);
    pdf.setDrawColor(COLORS.warningBorder[0], COLORS.warningBorder[1], COLORS.warningBorder[2]);
    pdf.roundedRect(margin, y, contentWidth, 12, 2, 2, 'FD');
    
    pdf.setFontSize(6);
    pdf.setTextColor(150, 50, 50);
    pdf.setFont('helvetica', 'bold');
    pdf.text('⚠ Disclaimer:', margin + 3, y + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      'Values outside the Reliable Prediction Extent (RPE) represent low-confidence predictions.',
      margin + 25, y + 5
    );
    pdf.text(
      'Refer to the RPE layer to identify reliable prediction zones.',
      margin + 3, y + 10
    );
  }
  
  // Footer
  pdf.setDrawColor(COLORS.forestLight[0], COLORS.forestLight[1], COLORS.forestLight[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  
  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
  pdf.text(`ZULIM Report | ${results.targetVar}`, margin, pageHeight - 7);
  pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 7);
  pdf.text(new Date().toLocaleDateString(), pageWidth / 2 - 10, pageHeight - 7);
}

// Draw feature importance table page
function drawFeatureImportancePage(
  pdf: jsPDF,
  results: AnalysisResults,
  config: AnalysisConfig,
  pageNum: number,
  totalPages: number
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  
  // Header
  pdf.setFillColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.rect(0, 0, pageWidth, 22, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Feature Importance Analysis', margin, 12);
  
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${ALGORITHM_NAMES[config.algorithm] || config.algorithm}`, margin, 18);
  
  let y = 32;
  
  // Model performance summary
  pdf.setTextColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Model Performance Metrics', margin, y);
  
  y += 8;
  pdf.setFillColor(245, 250, 245);
  pdf.roundedRect(margin, y, contentWidth, 25, 2, 2, 'F');
  
  const metrics = [
    { label: 'RMSE', value: results.metrics.rmse, desc: 'Root Mean Square Error' },
    { label: 'MAE', value: results.metrics.mae, desc: 'Mean Absolute Error' },
    { label: 'R²', value: results.metrics.r2, desc: 'Coefficient of Determination' },
    { label: 'Bias', value: results.metrics.bias, desc: 'Mean Prediction Bias' }
  ];
  
  const colWidth = contentWidth / 4;
  metrics.forEach((m, i) => {
    const x = margin + 5 + i * colWidth;
    pdf.setTextColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(m.label, x, y + 8);
    
    pdf.setFontSize(14);
    pdf.text(m.value, x, y + 17);
    
    pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.text(m.desc, x, y + 22);
  });
  
  y += 35;
  
  // Feature importance table
  pdf.setTextColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Variable Importance Rankings', margin, y);
  
  y += 8;
  
  if (results.featureImportance && results.featureImportance.length > 0) {
    // Table header
    pdf.setFillColor(COLORS.forestLight[0], COLORS.forestLight[1], COLORS.forestLight[2]);
    pdf.rect(margin, y, contentWidth, 8, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Rank', margin + 5, y + 5.5);
    pdf.text('Feature', margin + 25, y + 5.5);
    pdf.text('Importance', margin + 90, y + 5.5);
    pdf.text('Bar', margin + 120, y + 5.5);
    
    y += 10;
    
    // Table rows
    results.featureImportance.forEach((f, idx) => {
      const importance = f.importance * 100;
      const isEven = idx % 2 === 0;
      
      if (isEven) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, y - 1, contentWidth, 8, 'F');
      }
      
      pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text(`${idx + 1}`, margin + 5, y + 4);
      pdf.text(f.feature.substring(0, 25), margin + 25, y + 4);
      pdf.text(`${importance.toFixed(1)}%`, margin + 90, y + 4);
      
      // Importance bar
      pdf.setFillColor(COLORS.forestLight[0], COLORS.forestLight[1], COLORS.forestLight[2]);
      pdf.rect(margin + 120, y, importance * 0.5, 5, 'F');
      
      y += 8;
    });
    
    // Table border
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(margin, y - results.featureImportance.length * 8 - 10, contentWidth, results.featureImportance.length * 8 + 10, 'S');
  } else {
    pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    pdf.setFontSize(9);
    pdf.text('Feature importance data not available for this analysis type.', margin, y + 10);
  }
  
  // Interpretation notes
  y = pageHeight - 60;
  pdf.setTextColor(COLORS.forestDark[0], COLORS.forestDark[1], COLORS.forestDark[2]);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Interpretation Notes', margin, y);
  
  y += 8;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
  
  const notes = [
    '• Feature importance indicates each variable\'s contribution to model predictions.',
    '• Higher importance suggests stronger predictive power for the target variable.',
    '• For Random Forest: Importance is based on mean decrease in impurity.',
    '• For SVM: Importance is approximated from feature weights.',
    '• Consider domain knowledge when interpreting variable rankings.'
  ];
  
  notes.forEach((note, idx) => {
    pdf.text(note, margin, y + idx * 6);
  });
  
  // Footer
  pdf.setDrawColor(COLORS.forestLight[0], COLORS.forestLight[1], COLORS.forestLight[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  
  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
  pdf.text(`ZULIM Report | ${results.targetVar}`, margin, pageHeight - 7);
  pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 7);
  pdf.text(new Date().toLocaleDateString(), pageWidth / 2 - 10, pageHeight - 7);
}

// Main multi-page PDF export function
export async function generateMultiPagePDF(
  results: AnalysisResults,
  config: AnalysisConfig,
  colorScheme: ColorScheme,
  mapRef: React.RefObject<HTMLDivElement>,
  layerVisibility: LayerVisibility,
  setLayerVisibility: (visibility: LayerVisibility) => void,
  datasetName: string = 'Uploaded Dataset',
  onProgress?: (progress: number, message: string) => void
): Promise<void> {
  const pdf = new jsPDF('portrait', 'mm', 'a4');
  const isSingleVariable = results.analysisType === 'single-variable';
  
  // Define which layers to export based on analysis type
  const layersToExport = isSingleVariable
    ? ['continuous', 'classified', 'accuracy', 'rpe'] as const
    : ['continuous', 'residuals', 'uncertainty', 'rpe'] as const;
  
  const layerInfoSource = isSingleVariable ? LAYER_INFO['single-variable'] : LAYER_INFO['predictor-based'];
  
  // Total pages: layers + feature importance page (for predictor-based)
  const totalPages = isSingleVariable ? layersToExport.length : layersToExport.length + 1;
  
  onProgress?.(5, 'Initializing multi-page PDF...');
  
  // Store original visibility
  const originalVisibility = { ...layerVisibility };
  
  // Export each layer
  for (let i = 0; i < layersToExport.length; i++) {
    const layerKey = layersToExport[i];
    const layerInfo = layerInfoSource[layerKey as keyof typeof layerInfoSource];
    
    if (!layerInfo) continue;
    
    onProgress?.(10 + (i * 80) / totalPages, `Preparing ${layerInfo.short}...`);
    
    // Set only this layer visible
    const newVisibility: LayerVisibility = {
      continuous: false,
      classified: false,
      accuracy: false,
      residuals: false,
      uncertainty: false,
      rpe: false,
      points: true
    };
    newVisibility[layerKey as keyof LayerVisibility] = true;
    setLayerVisibility(newVisibility);
    
    // Wait for map to update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Add new page for all except first
    if (i > 0) {
      pdf.addPage();
    }
    
    await drawMapPage(
      pdf,
      layerKey,
      layerInfo,
      results,
      config,
      colorScheme,
      mapRef,
      i + 1,
      totalPages,
      onProgress
    );
  }
  
  // Add feature importance page for predictor-based
  if (!isSingleVariable) {
    pdf.addPage();
    drawFeatureImportancePage(pdf, results, config, totalPages, totalPages);
  }
  
  // Restore original visibility
  setLayerVisibility(originalVisibility);
  
  onProgress?.(95, 'Finalizing document...');
  
  // Save PDF
  const filename = generatePdfFilename(results, config, 'full');
  pdf.save(filename);
  
  onProgress?.(100, 'Complete!');
}

// Export single layer PDF (for quick single exports)
export async function generateComprehensivePDF(
  results: AnalysisResults,
  config: AnalysisConfig,
  colorScheme: ColorScheme,
  activeLayer: string,
  mapRef: React.RefObject<HTMLDivElement>,
  datasetName: string = 'Uploaded Dataset',
  onProgress?: (progress: number, message: string) => void
): Promise<void> {
  const pdf = new jsPDF('portrait', 'mm', 'a4');
  const isSingleVariable = results.analysisType === 'single-variable';
  const layerInfoSource = isSingleVariable ? LAYER_INFO['single-variable'] : LAYER_INFO['predictor-based'];
  const layerInfo = layerInfoSource[activeLayer as keyof typeof layerInfoSource];
  
  if (!layerInfo) {
    throw new Error('Invalid layer type');
  }
  
  onProgress?.(10, 'Capturing map...');
  
  await drawMapPage(pdf, activeLayer, layerInfo, results, config, colorScheme, mapRef, 1, 1, onProgress);
  
  onProgress?.(100, 'Complete!');
  
  const filename = generatePdfFilename(results, config, 'single', layerInfo.short.replace(/\s+/g, ''));
  pdf.save(filename);
}
