import { useState } from 'react';
import { Download, FileImage, FileText, Table2, Map, Shield, AlertTriangle, ChevronDown, ChevronUp, Loader2, FileStack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { AnalysisResults, AnalysisConfig, ExportOption, ColorScheme, LayerVisibility } from '@/types/spatial';
import { generateComprehensivePDF, generateMultiPagePDF, generatePdfFilename } from '@/utils/pdfExportUtils';
import { exportLayerAsGeoTIFF } from '@/utils/geotiffExport';

interface ExportPanelProps {
  results: AnalysisResults | null;
  config: AnalysisConfig;
  colorScheme: ColorScheme;
  layerVisibility: LayerVisibility;
  setLayerVisibility: (visibility: LayerVisibility) => void;
  mapRef: React.RefObject<HTMLDivElement>;
}

export function ExportPanel({ results, config, colorScheme, layerVisibility, setLayerVisibility, mapRef }: ExportPanelProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState('');

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
  
  // Determine which layer is currently active for smart export
  const getActiveLayer = (): string => {
    if (layerVisibility.continuous) return 'continuous';
    if (layerVisibility.classified) return 'classified';
    if (layerVisibility.accuracy) return 'accuracy';
    if (layerVisibility.residuals) return 'residuals';
    if (layerVisibility.uncertainty) return 'uncertainty';
    if (layerVisibility.rpe) return 'rpe';
    return 'continuous';
  };

  // Define export options based on analysis type
  const singleVariableExports: ExportOption[] = [
    { id: 'full-pdf', label: 'Full Multi-Page PDF', description: '4 pages: Surface, Classified, Accuracy, RPE', format: 'pdf', available: true },
    { id: 'interpolated', label: 'Interpolated Raster', description: 'Continuous surface (GeoTIFF)', format: 'geotiff', available: true },
    { id: 'classified', label: 'Classified Map', description: 'Class boundaries (GeoTIFF)', format: 'geotiff', available: !!results.classified },
    { id: 'accuracy', label: 'Accuracy Surface', description: 'CV error map (GeoTIFF)', format: 'geotiff', available: !!results.accuracy },
    { id: 'rpe', label: 'RPE Layer', description: 'Reliable extent (GeoTIFF)', format: 'geotiff', available: !!results.rpe },
    { id: 'single-pdf', label: 'Current Layer PDF', description: 'Single page with active layer', format: 'pdf', available: true },
  ];

  const predictorExports: ExportOption[] = [
    { id: 'full-pdf', label: 'Full Multi-Page PDF', description: '5 pages: Surface, Residuals, Uncertainty, RPE, Features', format: 'pdf', available: true },
    { id: 'predicted', label: 'Predicted Surface', description: 'Model output (GeoTIFF)', format: 'geotiff', available: true },
    { id: 'residuals', label: 'Residual Map', description: 'Errors (GeoTIFF)', format: 'geotiff', available: !!results.residuals },
    { id: 'uncertainty', label: 'Uncertainty Map', description: 'Confidence (GeoTIFF)', format: 'geotiff', available: !!results.uncertainty },
    { id: 'rpe', label: 'RPE Layer', description: 'Reliable extent (GeoTIFF)', format: 'geotiff', available: !!results.rpe },
    { id: 'importance', label: 'Feature Importance', description: 'Variable rankings (CSV)', format: 'csv', available: !!results.featureImportance },
    { id: 'single-pdf', label: 'Current Layer PDF', description: 'Single page with active layer', format: 'pdf', available: true },
  ];

  const exportOptions = isSingleVariable ? singleVariableExports : predictorExports;

  const handleExport = async (option: ExportOption) => {
    // Check if there's an active layer for single PDF export
    if (option.id === 'single-pdf') {
      const hasActiveLayer = layerVisibility.continuous || layerVisibility.classified || 
          layerVisibility.accuracy || layerVisibility.residuals || 
          layerVisibility.uncertainty || layerVisibility.rpe;
      if (!hasActiveLayer) {
        toast({
          title: "No active layer",
          description: "Please enable at least one map layer before exporting PDF",
          variant: "destructive"
        });
        return;
      }
    }

    setIsExporting(option.id);
    setExportProgress(0);
    setExportMessage('Starting export...');
    
    try {
      if (option.id === 'full-pdf') {
        await handleFullPdfExport();
      } else if (option.id === 'single-pdf') {
        await handleSinglePdfExport();
      } else if (option.format === 'csv') {
        exportCSV(option.id);
      } else if (option.format === 'geotiff') {
        exportGeoTIFF(option.id);
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
      setExportProgress(0);
      setExportMessage('');
    }
  };

  const handleFullPdfExport = async () => {
    await generateMultiPagePDF(
      results,
      config,
      colorScheme,
      mapRef,
      layerVisibility,
      setLayerVisibility,
      'Uploaded Dataset',
      (progress, message) => {
        setExportProgress(progress);
        setExportMessage(message);
      }
    );
  };

  const handleSinglePdfExport = async () => {
    const activeLayer = getActiveLayer();
    
    await generateComprehensivePDF(
      results,
      config,
      colorScheme,
      activeLayer,
      mapRef,
      'Uploaded Dataset',
      (progress, message) => {
        setExportProgress(progress);
        setExportMessage(message);
      }
    );
  };

  const exportCSV = (type: string) => {
    let csvContent = '';
    let filename = '';
    
    if (type === 'importance' && results.featureImportance) {
      csvContent = 'Rank,Feature,Importance,Percentage\n';
      results.featureImportance.forEach((f, idx) => {
        csvContent += `${idx + 1},${f.feature},${f.importance},${(f.importance * 100).toFixed(2)}%\n`;
      });
      
      const header = [
        '# ZULIM Feature Importance Export',
        `# Analysis Type: ${results.analysisType}`,
        `# Model: ${config.algorithm}`,
        `# Target Variable: ${results.targetVar}`,
        `# Generated: ${new Date().toISOString()}`,
        '#',
        ''
      ].join('\n');
      csvContent = header + csvContent;
      
      filename = `${config.algorithm.toUpperCase()}_FeatureImportance_${new Date().toISOString().split('T')[0]}.csv`;
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `zulim_${type}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportGeoTIFF = (type: string) => {
    exportLayerAsGeoTIFF(results, type, config);
  };

  const getIcon = (option: ExportOption) => {
    if (option.id === 'full-pdf') return FileStack;
    switch (option.format) {
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

  const layerPages = isSingleVariable 
    ? ['Interpolated Surface', 'Classified Map', 'Accuracy Surface', 'RPE Layer']
    : ['Predicted Surface', 'Residual Map', 'Uncertainty Map', 'RPE Layer', 'Feature Importance'];

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
            <p className="text-xs text-forest-light mt-1">
              Active layer: {getActiveLayer().charAt(0).toUpperCase() + getActiveLayer().slice(1)}
            </p>
          </div>

          {/* Export Progress */}
          {(isExporting === 'full-pdf' || isExporting === 'single-pdf') && exportProgress > 0 && (
            <div className="mb-3 p-3 bg-forest-light/10 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-forest-dark">{exportMessage}</span>
                <span className="text-xs text-muted-foreground">{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="h-2" />
            </div>
          )}

          {/* Export Options */}
          <div className="space-y-2">
            {exportOptions.map(option => {
              const Icon = getIcon(option);
              const isLoading = isExporting === option.id;
              const isFullPdf = option.id === 'full-pdf';
              
              return (
                <div
                  key={option.id}
                  className={`export-option ${!option.available ? 'disabled' : ''} ${isFullPdf ? 'border-2 border-forest-light/50 bg-forest-light/5' : ''}`}
                  onClick={() => option.available && !isLoading && handleExport(option)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                      isFullPdf ? 'bg-forest-light/20' : option.available ? 'bg-forest-light/10' : 'bg-muted'
                    }`}>
                      <Icon className={`w-4 h-4 ${isFullPdf ? 'text-forest-dark' : option.available ? 'text-forest-light' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isFullPdf ? 'text-forest-dark' : ''}`}>{option.label}</p>
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

          {/* Multi-Page PDF Info */}
          <div className="mt-4 p-3 bg-forest-light/5 border border-forest-light/20 rounded-lg">
            <p className="text-xs font-medium text-forest-dark mb-2">Full PDF Report includes:</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {layerPages.map((page, idx) => (
                <li key={idx}>✓ Page {idx + 1}: {page}</li>
              ))}
            </ul>
            <div className="mt-2 pt-2 border-t border-forest-light/10">
              <p className="text-xs text-muted-foreground">Each page contains:</p>
              <ul className="space-y-0.5 text-xs text-muted-foreground mt-1">
                <li>• Map with correct aspect ratio</li>
                <li>• Scale bar (km + miles)</li>
                <li>• North arrow & coordinates</li>
                <li>• Color legend with labels</li>
                <li>• CRS info (EPSG:4326)</li>
                <li>• Method & output type</li>
              </ul>
            </div>
          </div>

          {/* Reliability Note */}
          <div className="mt-3 p-3 bg-sage-light rounded-lg text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Export Notes:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>RPE marks reliable vs unreliable regions</li>
              <li>PDF filename includes method & timestamp</li>
              <li>GeoTIFF files include CRS (EPSG:4326)</li>
              <li>GeoTIFF compatible with ArcGIS & QGIS</li>
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
