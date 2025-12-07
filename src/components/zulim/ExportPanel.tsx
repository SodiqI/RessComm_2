import { useState } from 'react';
import { Download, FileImage, FileText, Table2, Map, Shield, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { AnalysisResults, AnalysisConfig, ExportOption, ColorScheme, LayerVisibility } from '@/types/spatial';
import { generateComprehensivePDF, generatePdfFilename } from '@/utils/pdfExportUtils';

interface ExportPanelProps {
  results: AnalysisResults | null;
  config: AnalysisConfig;
  colorScheme: ColorScheme;
  layerVisibility: LayerVisibility;
  mapRef: React.RefObject<HTMLDivElement>;
}

export function ExportPanel({ results, config, colorScheme, layerVisibility, mapRef }: ExportPanelProps) {
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
    { id: 'interpolated', label: 'Interpolated Raster', description: 'Continuous surface (GeoTIFF)', format: 'geotiff', available: true },
    { id: 'classified', label: 'Classified Map', description: 'Class boundaries (GeoTIFF/SHP)', format: 'geotiff', available: !!results.classified },
    { id: 'accuracy', label: 'Accuracy Surface', description: 'CV error map (GeoTIFF)', format: 'geotiff', available: !!results.accuracy },
    { id: 'rpe', label: 'RPE Layer', description: 'Reliable extent (GeoTIFF/SHP)', format: 'shapefile', available: !!results.rpe },
    { id: 'pdf', label: 'Full PDF Report', description: 'Maps + legend + metrics + interpretation', format: 'pdf', available: true },
  ];

  const predictorExports: ExportOption[] = [
    { id: 'predicted', label: 'Predicted Surface', description: 'Model output (GeoTIFF)', format: 'geotiff', available: true },
    { id: 'residuals', label: 'Residual Map', description: 'Errors (GeoTIFF/SHP)', format: 'geotiff', available: !!results.residuals },
    { id: 'uncertainty', label: 'Uncertainty Map', description: 'Confidence (GeoTIFF)', format: 'geotiff', available: !!results.uncertainty },
    { id: 'rpe', label: 'RPE Layer', description: 'Reliable extent (GeoTIFF/SHP)', format: 'shapefile', available: !!results.rpe },
    { id: 'importance', label: 'Feature Importance', description: 'Variable rankings (CSV)', format: 'csv', available: !!results.featureImportance },
    { id: 'pdf', label: 'Full PDF Report', description: 'Maps + legend + model summary', format: 'pdf', available: true },
  ];

  const exportOptions = isSingleVariable ? singleVariableExports : predictorExports;

  const handleExport = async (option: ExportOption) => {
    // Check if there's an active layer for PDF export
    if (option.format === 'pdf') {
      const hasActiveLayer = Object.values(layerVisibility).some(v => v);
      if (!hasActiveLayer || (!layerVisibility.continuous && !layerVisibility.classified && 
          !layerVisibility.accuracy && !layerVisibility.residuals && 
          !layerVisibility.uncertainty && !layerVisibility.rpe)) {
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
      switch (option.format) {
        case 'pdf':
          await handlePdfExport();
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
      setExportProgress(0);
      setExportMessage('');
    }
  };

  const handlePdfExport = async () => {
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
    const timestamp = Date.now();
    let filename = '';
    
    if (type === 'importance' && results.featureImportance) {
      csvContent = 'Rank,Feature,Importance,Percentage\n';
      results.featureImportance.forEach((f, idx) => {
        csvContent += `${idx + 1},${f.feature},${f.importance},${(f.importance * 100).toFixed(2)}%\n`;
      });
      
      // Add metadata header
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
    a.download = filename || `zulim_${type}_${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportGeoData = (type: string) => {
    let data: any = null;
    let layerName = type;
    
    switch (type) {
      case 'interpolated':
      case 'predicted':
        data = results.continuous.grid;
        layerName = isSingleVariable ? 'InterpolatedSurface' : 'PredictedSurface';
        break;
      case 'classified':
        data = results.classified;
        layerName = 'ClassifiedSurface';
        break;
      case 'accuracy':
        data = results.accuracy;
        layerName = 'AccuracySurface';
        break;
      case 'residuals':
        data = results.residuals;
        layerName = 'ResidualMap';
        break;
      case 'uncertainty':
        data = results.uncertainty;
        layerName = 'UncertaintyMap';
        break;
      case 'rpe':
        data = results.rpePolygon;
        layerName = 'RPELayer';
        break;
    }
    
    if (!data) {
      throw new Error('No data available for this export');
    }
    
    // Convert to GeoJSON with full metadata
    const geojson = {
      type: 'FeatureCollection',
      name: layerName,
      crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:EPSG::4326' }
      },
      metadata: {
        analysisType: results.analysisType,
        algorithm: config.algorithm,
        targetVariable: results.targetVar,
        predictors: results.predictors,
        generatedAt: new Date().toISOString(),
        metrics: results.metrics,
        rpeMethod: config.rpeMethod,
        gridResolution: config.gridResolution
      },
      features: Array.isArray(data) ? data.map((cell: any, idx: number) => ({
        type: 'Feature',
        id: idx,
        geometry: {
          type: 'Point',
          coordinates: [cell.lng, cell.lat]
        },
        properties: {
          value: cell.value,
          class: cell.class,
          accuracy: cell.accuracy,
          residual: cell.residual,
          uncertainty: cell.uncertainty,
          reliable: cell.reliable
        }
      })) : data
    };
    
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${config.algorithm.toUpperCase()}_${layerName}_${dateStr}.geojson`;
    
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
            <p className="text-xs text-forest-light mt-1">
              Active layer: {getActiveLayer().charAt(0).toUpperCase() + getActiveLayer().slice(1)}
            </p>
          </div>

          {/* Export Progress */}
          {isExporting === 'pdf' && exportProgress > 0 && (
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

          {/* PDF Export Info */}
          <div className="mt-4 p-3 bg-forest-light/5 border border-forest-light/20 rounded-lg">
            <p className="text-xs font-medium text-forest-dark mb-2">PDF Report includes:</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>✓ Color legend matching map view</li>
              <li>✓ Analysis method declaration</li>
              <li>✓ Output type & metadata summary</li>
              <li>✓ Performance metrics (RMSE, R², etc.)</li>
              <li>✓ Interpretation notes & disclaimers</li>
              <li>✓ Reliability summary & warnings</li>
              {!isSingleVariable && <li>✓ Feature importance table</li>}
            </ul>
          </div>

          {/* Reliability Note */}
          <div className="mt-3 p-3 bg-sage-light rounded-lg text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Export Notes:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Reliable areas are marked in the RPE layer</li>
              <li>Low-confidence regions are flagged in exports</li>
              <li>PDF filename includes analysis details</li>
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
