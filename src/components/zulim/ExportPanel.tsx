import { useState } from 'react';
import { Download, FileImage, FileText, Table2, Map, Shield, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import type { AnalysisResults, ExportOption } from '@/types/spatial';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ExportPanelProps {
  results: AnalysisResults | null;
  mapRef: React.RefObject<HTMLDivElement>;
}

export function ExportPanel({ results, mapRef }: ExportPanelProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  if (!results) {
    return (
      <div className="zulim-section">
        <h3 className="zulim-section-title">
          <Download className="w-4 h-4" />
          Export Results
        </h3>
        <p className="text-sm text-muted-foreground">
          Run analysis to enable exports
        </p>
      </div>
    );
  }

  const isSingleVariable = results.analysisType === 'single-variable';

  // Define export options based on analysis type
  const singleVariableExports: ExportOption[] = [
    { id: 'interpolated', label: 'Interpolated Raster', description: 'Continuous surface (GeoTIFF)', format: 'geotiff', available: true },
    { id: 'classified', label: 'Classified Map', description: 'Class boundaries (GeoTIFF/SHP)', format: 'geotiff', available: !!results.classified },
    { id: 'accuracy', label: 'Accuracy Surface', description: 'CV error map (GeoTIFF)', format: 'geotiff', available: !!results.accuracy },
    { id: 'rpe', label: 'RPE Layer', description: 'Reliable extent (GeoTIFF/SHP)', format: 'shapefile', available: !!results.rpe },
    { id: 'pdf', label: 'Full PDF Report', description: 'Maps + metrics + summary', format: 'pdf', available: true },
  ];

  const predictorExports: ExportOption[] = [
    { id: 'predicted', label: 'Predicted Surface', description: 'Model output (GeoTIFF)', format: 'geotiff', available: true },
    { id: 'residuals', label: 'Residual Map', description: 'Errors (GeoTIFF/SHP)', format: 'geotiff', available: !!results.residuals },
    { id: 'uncertainty', label: 'Uncertainty Map', description: 'Confidence (GeoTIFF)', format: 'geotiff', available: !!results.uncertainty },
    { id: 'rpe', label: 'RPE Layer', description: 'Reliable extent (GeoTIFF/SHP)', format: 'shapefile', available: !!results.rpe },
    { id: 'importance', label: 'Feature Importance', description: 'Variable rankings (CSV)', format: 'csv', available: !!results.featureImportance },
    { id: 'pdf', label: 'Full PDF Report', description: 'Maps + model summary', format: 'pdf', available: true },
  ];

  const exportOptions = isSingleVariable ? singleVariableExports : predictorExports;

  const handleExport = async (option: ExportOption) => {
    setIsExporting(option.id);
    
    try {
      switch (option.format) {
        case 'pdf':
          await exportPDF();
          break;
        case 'csv':
          exportCSV(option.id);
          break;
        case 'geotiff':
        case 'shapefile':
          exportGeoData(option.id);
          break;
        default:
          throw new Error('Unknown export format');
      }
      
      toast({
        title: "Export successful",
        description: `${option.label} has been exported`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  };

  const exportPDF = async () => {
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    
    // Title
    pdf.setFontSize(20);
    pdf.setTextColor(27, 67, 50);
    pdf.text('ZULIM Analysis Report', 20, 20);
    
    // Subtitle
    pdf.setFontSize(12);
    pdf.setTextColor(100);
    pdf.text(`${results.analysisType === 'predictor-based' ? 'Model-based Prediction' : 'Pure Interpolation'} Analysis`, 20, 28);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, 34);
    
    // Analysis Info
    pdf.setFontSize(14);
    pdf.setTextColor(27, 67, 50);
    pdf.text('Analysis Summary', 20, 48);
    
    pdf.setFontSize(10);
    pdf.setTextColor(60);
    const summaryY = 55;
    pdf.text(`Target Variable: ${results.targetVar}`, 25, summaryY);
    pdf.text(`Analysis Type: ${results.analysisType}`, 25, summaryY + 6);
    if (results.predictors.length > 0) {
      pdf.text(`Predictors: ${results.predictors.join(', ')}`, 25, summaryY + 12);
    }
    
    // Metrics
    pdf.setFontSize(14);
    pdf.setTextColor(27, 67, 50);
    pdf.text('Validation Metrics', 20, summaryY + 28);
    
    pdf.setFontSize(10);
    pdf.setTextColor(60);
    const metricsY = summaryY + 35;
    pdf.text(`RMSE: ${results.metrics.rmse}`, 25, metricsY);
    pdf.text(`MAE: ${results.metrics.mae}`, 25, metricsY + 6);
    pdf.text(`R²: ${results.metrics.r2}`, 25, metricsY + 12);
    pdf.text(`Bias: ${results.metrics.bias}`, 25, metricsY + 18);
    pdf.text(`Sample Size: ${results.metrics.sampleSize}`, 25, metricsY + 24);
    pdf.text(`Cross-validation: ${results.metrics.cvFolds}-fold`, 25, metricsY + 30);
    
    // Feature importance (if available)
    if (results.featureImportance && results.featureImportance.length > 0) {
      pdf.setFontSize(14);
      pdf.setTextColor(27, 67, 50);
      pdf.text('Feature Importance', 20, metricsY + 46);
      
      pdf.setFontSize(10);
      pdf.setTextColor(60);
      let fiY = metricsY + 53;
      results.featureImportance.forEach((f, idx) => {
        pdf.text(`${idx + 1}. ${f.feature}: ${(f.importance * 100).toFixed(1)}%`, 25, fiY);
        fiY += 6;
      });
    }
    
    // Capture map screenshot if available
    if (mapRef.current) {
      try {
        const canvas = await html2canvas(mapRef.current, {
          useCORS: true,
          allowTaint: true,
          scale: 2
        });
        const imgData = canvas.toDataURL('image/png');
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.setTextColor(27, 67, 50);
        pdf.text('Map Output', 20, 20);
        pdf.addImage(imgData, 'PNG', 20, 30, 250, 150);
      } catch (e) {
        console.warn('Could not capture map screenshot', e);
      }
    }
    
    // Reliability Warning
    pdf.addPage();
    pdf.setFontSize(14);
    pdf.setTextColor(27, 67, 50);
    pdf.text('Reliability Notes', 20, 20);
    
    pdf.setFontSize(10);
    pdf.setTextColor(60);
    const warnText = [
      '• Predictions outside the Reliable Prediction Extent (RPE) may be unreliable.',
      '• The RPE was calculated using: ' + results.analysisType,
      '• Areas with high uncertainty or far from training points should be interpreted with caution.',
      '• Cross-validation metrics provide an estimate of prediction accuracy within the RPE.',
    ];
    warnText.forEach((line, idx) => {
      pdf.text(line, 25, 30 + idx * 8);
    });
    
    pdf.save(`zulim_report_${Date.now()}.pdf`);
  };

  const exportCSV = (type: string) => {
    let csvContent = '';
    
    if (type === 'importance' && results.featureImportance) {
      csvContent = 'Feature,Importance\n';
      results.featureImportance.forEach(f => {
        csvContent += `${f.feature},${f.importance}\n`;
      });
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zulim_${type}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportGeoData = (type: string) => {
    // In a production app, this would generate actual GeoTIFF/Shapefile
    // For now, export as GeoJSON
    let data: any = null;
    
    switch (type) {
      case 'interpolated':
      case 'predicted':
        data = results.continuous.grid;
        break;
      case 'classified':
        data = results.classified;
        break;
      case 'accuracy':
        data = results.accuracy;
        break;
      case 'residuals':
        data = results.residuals;
        break;
      case 'uncertainty':
        data = results.uncertainty;
        break;
      case 'rpe':
        data = results.rpePolygon;
        break;
    }
    
    if (!data) {
      throw new Error('No data available for this export');
    }
    
    // Convert to GeoJSON
    const geojson = {
      type: 'FeatureCollection',
      features: Array.isArray(data) ? data.map((cell: any) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [cell.lng, cell.lat]
        },
        properties: cell
      })) : data
    };
    
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zulim_${type}_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Note",
      description: "Exported as GeoJSON. GeoTIFF export requires backend processing.",
    });
  };

  const getIcon = (format: string) => {
    switch (format) {
      case 'geotiff':
        return Map;
      case 'shapefile':
        return Shield;
      case 'csv':
        return Table2;
      case 'pdf':
        return FileText;
      default:
        return FileImage;
    }
  };

  return (
    <div className="zulim-section">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <h3 className="zulim-section-title mb-0">
            <Download className="w-4 h-4" />
            Export Results
          </h3>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-4">
          {/* Export Type Label */}
          <div className="mb-3 p-2 bg-sage-light rounded-md">
            <p className="text-xs text-muted-foreground">
              {isSingleVariable 
                ? 'Single-variable interpolation exports' 
                : 'Predictor-based interpolation exports'}
            </p>
          </div>

          {/* Export Options */}
          <div className="space-y-2">
            {exportOptions.map(option => {
              const Icon = getIcon(option.format);
              const isLoading = isExporting === option.id;
              
              return (
                <div
                  key={option.id}
                  className={`export-option ${!option.available ? 'disabled' : ''}`}
                  onClick={() => option.available && !isLoading && handleExport(option)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                      option.available ? 'bg-forest-light/10' : 'bg-muted'
                    }`}>
                      <Icon className={`w-4 h-4 ${option.available ? 'text-forest-light' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                  
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-forest-light" />
                  ) : option.available ? (
                    <Download className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-muted-foreground/50" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Reliability Note */}
          <div className="mt-4 p-3 bg-sage-light rounded-lg text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Export Notes:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Reliable areas are marked in the RPE layer</li>
              <li>Low-confidence regions are flagged in exports</li>
              <li>PDF includes full reliability warnings</li>
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
