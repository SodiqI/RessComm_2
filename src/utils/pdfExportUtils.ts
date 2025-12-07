// PDF Export utilities for ZULIM
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { AnalysisResults, AnalysisConfig, ColorScheme } from '@/types/spatial';
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

// Output type labels
const OUTPUT_LABELS = {
  'single-variable': {
    continuous: 'Interpolated Surface (Continuous Raster)',
    classified: 'Classified Surface',
    accuracy: 'Cross-Validation Accuracy Surface',
    rpe: 'Reliable Prediction Extent (RPE) Mask'
  },
  'predictor-based': {
    continuous: 'Model-Based Predicted Surface',
    residuals: 'Residual Map (Observed – Predicted)',
    uncertainty: 'Prediction Uncertainty Surface',
    rpe: 'Reliable Prediction Extent (RPE) Layer'
  }
};

// Get interpretation notes based on layer type
function getInterpretationNotes(layerType: string, analysisType: string): string[] {
  const notes: Record<string, string[]> = {
    continuous: analysisType === 'single-variable' 
      ? [
          'This surface shows spatially interpolated values of the target variable.',
          'Higher values (warm colors) indicate greater concentrations/intensities.',
          'Lower values (cool colors) indicate reduced concentrations/intensities.',
          'Values are estimated based on inverse distance weighting from sample points.'
        ]
      : [
          'This surface shows model-predicted values based on predictor variables.',
          'Predictions are derived from machine learning regression analysis.',
          'Higher values (warm colors) indicate greater predicted concentrations.',
          'Model accuracy depends on the quality and coverage of training data.'
        ],
    classified: [
      'This map groups continuous values into discrete classes for easier interpretation.',
      'Class breaks are calculated using the selected classification method.',
      'Each class represents a range of values with similar characteristics.',
      'Class boundaries should be interpreted as approximate thresholds.'
    ],
    accuracy: [
      'This map shows the spatial distribution of prediction accuracy.',
      'Green areas indicate high prediction reliability (low cross-validation error).',
      'Red/orange areas indicate lower reliability (higher prediction uncertainty).',
      'Accuracy is estimated through k-fold cross-validation procedures.'
    ],
    residuals: [
      'This map shows the difference between observed and predicted values.',
      'Positive residuals (warm colors): model under-predicts actual values.',
      'Negative residuals (cool colors): model over-predicts actual values.',
      'Ideal model performance shows residuals clustered around zero.'
    ],
    uncertainty: [
      'This map shows the confidence level of predictions across the study area.',
      'Low uncertainty (green): high confidence in predicted values.',
      'High uncertainty (red): predictions should be interpreted with caution.',
      'Uncertainty typically increases with distance from training points.'
    ],
    rpe: [
      'The Reliable Prediction Extent (RPE) shows where predictions are trustworthy.',
      'Areas within the RPE have adequate training data support.',
      'Areas outside the RPE represent extrapolated or low-confidence predictions.',
      'Use RPE boundaries to guide interpretation and decision-making.'
    ]
  };
  return notes[layerType] || notes.continuous;
}

// Generate filename based on analysis settings
export function generatePdfFilename(
  results: AnalysisResults,
  config: AnalysisConfig,
  activeLayer: string
): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const algorithmShort = config.algorithm.toUpperCase();
  const layerName = activeLayer.charAt(0).toUpperCase() + activeLayer.slice(1);
  const analysisShort = results.analysisType === 'predictor-based' ? 'Predictor' : 'SingleVar';
  
  return `${algorithmShort}_${analysisShort}_${layerName}_${dateStr}.pdf`;
}

// Main PDF export function
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
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  
  onProgress?.(5, 'Initializing PDF...');

  // Colors as tuples
  const forestDark: [number, number, number] = [27, 67, 50];
  const forestLight: [number, number, number] = [76, 127, 93];
  const textDark: [number, number, number] = [40, 40, 40];
  const textMuted: [number, number, number] = [100, 100, 100];
  
  const isSingleVariable = results.analysisType === 'single-variable';
  const outputLabels = isSingleVariable ? OUTPUT_LABELS['single-variable'] : OUTPUT_LABELS['predictor-based'];
  const outputTypeLabel = (outputLabels as Record<string, string>)[activeLayer] || 'Analysis Output';

  // ==================== PAGE 1: COVER PAGE ====================
  
  // Header background
  pdf.setFillColor(forestDark[0], forestDark[1], forestDark[2]);
  pdf.rect(0, 0, pageWidth, 50, 'F');
  
  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('ZULIM Analysis Report', margin, 28);
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Spatial Interpolation & Prediction Analysis', margin, 38);
  
  // Analysis Method Declaration
  let y = 60;
  pdf.setFillColor(240, 245, 240);
  pdf.roundedRect(margin, y, contentWidth, 30, 3, 3, 'F');
  
  pdf.setTextColor(forestDark[0], forestDark[1], forestDark[2]);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Analysis Method:', margin + 5, y + 10);
  pdf.setFontSize(14);
  pdf.text(ALGORITHM_NAMES[config.algorithm] || config.algorithm, margin + 5, y + 22);
  
  // Output Type Declaration
  y = 100;
  pdf.setFillColor(245, 240, 235);
  pdf.roundedRect(margin, y, contentWidth, 30, 3, 3, 'F');
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(forestDark[0], forestDark[1], forestDark[2]);
  pdf.text('Output Type:', margin + 5, y + 10);
  pdf.setFontSize(14);
  pdf.text(outputTypeLabel, margin + 5, y + 22);
  
  // Timestamp and analysis badge
  y = 140;
  pdf.setFontSize(10);
  pdf.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  
  const badge = isSingleVariable ? 'Pure Interpolation Output' : 'Model-based Predicted Surface';
  pdf.setFillColor(forestLight[0], forestLight[1], forestLight[2]);
  pdf.roundedRect(margin + 100, y - 6, 70, 10, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.text(badge, margin + 105, y);
  
  onProgress?.(15, 'Building metadata section...');

  // ==================== METADATA SUMMARY BLOCK ====================
  y = 160;
  pdf.setDrawColor(forestLight[0], forestLight[1], forestLight[2]);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);
  
  y += 10;
  pdf.setTextColor(forestDark[0], forestDark[1], forestDark[2]);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Metadata Summary', margin, y);
  
  y += 10;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  
  const metadata = [
    ['Dataset name:', datasetName],
    ['Interpolation type:', isSingleVariable ? 'Single-variable' : 'Predictor-based'],
    ['Model used:', ALGORITHM_NAMES[config.algorithm] || config.algorithm],
    ['Target variable:', results.targetVar],
    ['Number of predictors:', results.predictors.length > 0 ? results.predictors.length.toString() : 'N/A'],
    ['Predictors:', results.predictors.length > 0 ? results.predictors.join(', ') : 'None (single-variable)'],
    ['Cross-validation type:', `${config.cvFolds}-fold CV`],
    ['Spatial resolution:', `${config.gridResolution} degrees`],
    ['Number of classes:', config.numClasses.toString()],
    ['Classification method:', config.classificationMethod.charAt(0).toUpperCase() + config.classificationMethod.slice(1)],
    ['RPE method:', RPE_METHOD_NAMES[config.rpeMethod] || config.rpeMethod],
    ['Sample size:', results.metrics.sampleSize?.toString() || 'N/A']
  ];
  
  metadata.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin + 5, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value.substring(0, 60) + (value.length > 60 ? '...' : ''), margin + 50, y);
    y += 6;
  });
  
  onProgress?.(25, 'Adding performance metrics...');

  // ==================== PAGE 2: METRICS & RELIABILITY ====================
  pdf.addPage();
  y = 20;
  
  // Model Performance Metrics
  pdf.setTextColor(forestDark[0], forestDark[1], forestDark[2]);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Model Performance Metrics', margin, y);
  
  y += 15;
  pdf.setFillColor(245, 250, 245);
  pdf.roundedRect(margin, y, contentWidth, 50, 3, 3, 'F');
  
  pdf.setFontSize(10);
  const metricsData = [
    { label: 'RMSE', value: results.metrics.rmse, desc: 'Root Mean Square Error' },
    { label: 'MAE', value: results.metrics.mae, desc: 'Mean Absolute Error' },
    { label: 'R²', value: results.metrics.r2, desc: 'Coefficient of Determination' },
    { label: 'Bias', value: results.metrics.bias, desc: 'Mean Prediction Bias' }
  ];
  
  const colWidth = contentWidth / 4;
  metricsData.forEach((m, i) => {
    const x = margin + 5 + i * colWidth;
    pdf.setTextColor(forestDark[0], forestDark[1], forestDark[2]);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(m.label, x, y + 15);
    
    pdf.setFontSize(18);
    pdf.text(m.value, x, y + 28);
    
    pdf.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text(m.desc, x, y + 38);
  });
  
  // Feature Importance (for predictor-based)
  if (!isSingleVariable && results.featureImportance && results.featureImportance.length > 0) {
    y += 65;
    pdf.setTextColor(forestDark[0], forestDark[1], forestDark[2]);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Feature Importance', margin, y);
    
    y += 10;
    pdf.setFillColor(250, 250, 250);
    pdf.roundedRect(margin, y, contentWidth, 8 + results.featureImportance.length * 8, 3, 3, 'F');
    
    y += 8;
    pdf.setFontSize(9);
    results.featureImportance.forEach((f, idx) => {
      const importance = f.importance * 100;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
      pdf.text(`${idx + 1}. ${f.feature}`, margin + 5, y);
      
      // Importance bar
      pdf.setFillColor(forestLight[0], forestLight[1], forestLight[2]);
      pdf.rect(margin + 70, y - 3, importance * 0.8, 4, 'F');
      
      pdf.text(`${importance.toFixed(1)}%`, margin + 145, y);
      y += 8;
    });
  }
  
  // Reliability Summary
  y += 20;
  pdf.setTextColor(forestDark[0], forestDark[1], forestDark[2]);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Reliability Summary', margin, y);
  
  y += 10;
  pdf.setFillColor(255, 250, 245);
  pdf.roundedRect(margin, y, contentWidth, 60, 3, 3, 'F');
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  
  const reliabilityInfo = isSingleVariable ? [
    `• RPE Method: ${RPE_METHOD_NAMES[config.rpeMethod]}`,
    `• Buffer distance: ${config.rpeBuffer} degrees`,
    `• Uncertainty threshold: ${(config.uncertaintyThreshold * 100).toFixed(0)}%`,
    `• Cross-validation folds: ${config.cvFolds}`,
    `• IDW Power: ${config.idwPower}`,
    '• Accuracy map shows spatial distribution of CV residuals'
  ] : [
    `• RPE Method: ${RPE_METHOD_NAMES[config.rpeMethod]}`,
    `• Buffer distance: ${config.rpeBuffer} degrees`,
    `• Uncertainty threshold: ${(config.uncertaintyThreshold * 100).toFixed(0)}%`,
    `• Model: ${ALGORITHM_NAMES[config.algorithm]}`,
    config.algorithm === 'rf' ? `• Number of trees: ${config.rfTrees}` : '',
    '• Distance-to-training-points assessed for extrapolation warnings'
  ].filter(Boolean);
  
  reliabilityInfo.forEach((line, idx) => {
    pdf.text(line, margin + 5, y + 10 + idx * 8);
  });

  onProgress?.(40, 'Capturing map screenshot...');

  // ==================== PAGE 3: MAP WITH LEGEND ====================
  pdf.addPage();
  y = 20;
  
  pdf.setTextColor(forestDark[0], forestDark[1], forestDark[2]);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Map Output', margin, y);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  pdf.text(outputTypeLabel, margin, y + 8);
  
  y += 20;
  
  // Capture map
  if (mapRef.current) {
    try {
      const canvas = await html2canvas(mapRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      
      pdf.addImage(imgData, 'PNG', margin, y, imgWidth, Math.min(imgHeight, 120));
      y += Math.min(imgHeight, 120) + 10;
    } catch (e) {
      console.warn('Could not capture map screenshot', e);
      pdf.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      pdf.text('Map screenshot unavailable', margin, y + 20);
      y += 40;
    }
  } else {
    pdf.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    pdf.text('Map not available', margin, y + 20);
    y += 40;
  }
  
  onProgress?.(60, 'Rendering legend...');

  // Legend Section
  pdf.setTextColor(forestDark[0], forestDark[1], forestDark[2]);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Legend', margin, y);
  
  y += 8;
  
  // Color scale legend
  const schemeColors = getSchemeColors(colorScheme);
  const legendWidth = 120;
  const legendHeight = 10;
  
  // Draw color gradient
  const gradientSteps = 20;
  const stepWidth = legendWidth / gradientSteps;
  for (let i = 0; i < gradientSteps; i++) {
    const colorIdx = Math.floor((i / gradientSteps) * (schemeColors.length - 1));
    const nextIdx = Math.min(colorIdx + 1, schemeColors.length - 1);
    const t = ((i / gradientSteps) * (schemeColors.length - 1)) % 1;
    
    // Parse RGB
    const parseRgb = (c: string): [number, number, number] => {
      const match = c.match(/\d+/g);
      return match ? [Number(match[0]), Number(match[1]), Number(match[2])] : [128, 128, 128];
    };
    const c1 = parseRgb(schemeColors[colorIdx]);
    const c2 = parseRgb(schemeColors[nextIdx]);
    
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    
    pdf.setFillColor(r, g, b);
    pdf.rect(margin + i * stepWidth, y, stepWidth + 0.5, legendHeight, 'F');
  }
  
  // Legend labels
  pdf.setFontSize(8);
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  pdf.text(results.continuous.minVal.toFixed(2), margin, y + legendHeight + 6);
  pdf.text(results.continuous.maxVal.toFixed(2), margin + legendWidth - 15, y + legendHeight + 6);
  
  // Legend title based on layer
  const legendTitles: Record<string, string> = {
    continuous: isSingleVariable ? 'Interpolated Values' : 'Predicted Values',
    classified: 'Classification Classes',
    accuracy: 'Accuracy (CV Error)',
    residuals: 'Residuals (Obs - Pred)',
    uncertainty: 'Uncertainty Level',
    rpe: 'Reliability Zone'
  };
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(legendTitles[activeLayer] || 'Values', margin, y - 3);
  
  // RPE Legend (always show if available)
  y += 25;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Reliability Zones:', margin, y);
  
  y += 6;
  pdf.setFillColor(76, 175, 80);
  pdf.rect(margin, y, 15, 6, 'F');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('High reliability (within RPE)', margin + 18, y + 5);
  
  y += 10;
  pdf.setFillColor(244, 67, 54);
  pdf.rect(margin, y, 15, 6, 'F');
  pdf.text('Low reliability (outside RPE)', margin + 18, y + 5);
  
  // Add class legend if classified layer
  if (activeLayer === 'classified' && config.numClasses) {
    y += 15;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('Classification Classes:', margin, y);
    
    y += 6;
    const classRange = (results.continuous.maxVal - results.continuous.minVal) / config.numClasses;
    for (let i = 0; i < config.numClasses; i++) {
      const color = getColorForClass(i, config.numClasses);
      const parseHex = (hex: string): [number, number, number] => {
        const match = hex.match(/[a-fA-F0-9]{2}/g);
        if (match && match.length >= 3) {
          return [parseInt(match[0], 16), parseInt(match[1], 16), parseInt(match[2], 16)];
        }
        return [128, 128, 128];
      };
      const rgb = parseHex(color);
      pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
      pdf.rect(margin, y, 10, 5, 'F');
      
      const low = results.continuous.minVal + i * classRange;
      const high = results.continuous.minVal + (i + 1) * classRange;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.text(`Class ${i + 1}: ${low.toFixed(2)} - ${high.toFixed(2)}`, margin + 13, y + 4);
      y += 7;
    }
  }
  
  // Map elements note
  y += 10;
  pdf.setDrawColor(forestLight[0], forestLight[1], forestLight[2]);
  pdf.line(margin, y, margin + 100, y);
  y += 8;
  pdf.setFontSize(8);
  pdf.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  pdf.text('Map includes: Scale bar, North arrow, Coordinate grid', margin, y);
  pdf.text(`Extent: ${results.continuous.grid.length > 0 ? 'Study area bounds' : 'N/A'}`, margin, y + 5);

  onProgress?.(75, 'Adding interpretation notes...');

  // ==================== PAGE 4: INTERPRETATION NOTES ====================
  pdf.addPage();
  y = 20;
  
  pdf.setTextColor(forestDark[0], forestDark[1], forestDark[2]);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Interpretation Guide', margin, y);
  
  y += 15;
  
  // What this map represents
  pdf.setFillColor(245, 250, 245);
  pdf.roundedRect(margin, y, contentWidth, 50, 3, 3, 'F');
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('What This Map Represents', margin + 5, y + 12);
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  
  const interpretNotes = getInterpretationNotes(activeLayer, results.analysisType);
  interpretNotes.forEach((note, idx) => {
    pdf.text(`• ${note}`, margin + 5, y + 22 + idx * 7);
  });
  
  // How to interpret values
  y += 60;
  pdf.setTextColor(forestDark[0], forestDark[1], forestDark[2]);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Value Interpretation', margin, y);
  
  y += 10;
  pdf.setFillColor(250, 250, 255);
  pdf.roundedRect(margin, y, contentWidth / 2 - 5, 35, 3, 3, 'F');
  pdf.roundedRect(margin + contentWidth / 2 + 5, y, contentWidth / 2 - 5, 35, 3, 3, 'F');
  
  pdf.setFontSize(9);
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  pdf.setFont('helvetica', 'bold');
  pdf.text('High Values (Warm Colors)', margin + 5, y + 12);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Indicate greater concentrations', margin + 5, y + 22);
  pdf.text('or higher intensity of the variable.', margin + 5, y + 29);
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('Low Values (Cool Colors)', margin + contentWidth / 2 + 10, y + 12);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Indicate lower concentrations', margin + contentWidth / 2 + 10, y + 22);
  pdf.text('or reduced intensity of the variable.', margin + contentWidth / 2 + 10, y + 29);
  
  // Disclaimer for extrapolated zones
  y += 50;
  pdf.setFillColor(255, 245, 240);
  pdf.setDrawColor(244, 67, 54);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(margin, y, contentWidth, 40, 3, 3, 'FD');
  
  pdf.setTextColor(180, 50, 50);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Important Disclaimer', margin + 5, y + 12);
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Values outside the Reliable Prediction Extent (RPE) represent low-confidence', margin + 5, y + 24);
  pdf.text('predictions and should be interpreted cautiously. The RPE mask identifies areas', margin + 5, y + 32);
  pdf.text('where the model has adequate training data support for reliable predictions.', margin + 5, y + 40);
  
  // Additional warnings
  y += 55;
  pdf.setTextColor(forestDark[0], forestDark[1], forestDark[2]);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Additional Considerations', margin, y);
  
  y += 10;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  
  const warnings = [
    '• Predictions are based on the spatial pattern of training samples.',
    '• Edge effects may reduce reliability near study area boundaries.',
    '• Temporal validity: predictions reflect conditions at data collection time.',
    '• Local anomalies may not be captured due to smoothing effects.',
    `• Model validation: ${config.cvFolds}-fold cross-validation was used to assess accuracy.`,
    '• Consider field validation for critical decision-making applications.'
  ];
  
  warnings.forEach((w, idx) => {
    pdf.text(w, margin + 5, y + idx * 7);
  });

  onProgress?.(90, 'Finalizing document...');

  // ==================== FOOTER ON ALL PAGES ====================
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    
    // Footer line
    pdf.setDrawColor(forestLight[0], forestLight[1], forestLight[2]);
    pdf.setLineWidth(0.3);
    pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    
    // Footer text
    pdf.setFontSize(8);
    pdf.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    pdf.text(`ZULIM Analysis Report | ${results.targetVar}`, margin, pageHeight - 10);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
    pdf.text('Generated by RessComm Plotter', pageWidth / 2 - 20, pageHeight - 10);
  }
  
  onProgress?.(100, 'Complete!');
  
  // Save with dynamic filename
  const filename = generatePdfFilename(results, config, activeLayer);
  pdf.save(filename);
}

// Export specific layer PDF
export async function exportLayerPDF(
  layerType: string,
  results: AnalysisResults,
  config: AnalysisConfig,
  colorScheme: ColorScheme,
  mapRef: React.RefObject<HTMLDivElement>,
  onProgress?: (progress: number, message: string) => void
): Promise<void> {
  await generateComprehensivePDF(
    results,
    config,
    colorScheme,
    layerType,
    mapRef,
    'Uploaded Dataset',
    onProgress
  );
}
