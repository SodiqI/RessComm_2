import { useState, useRef, useCallback } from 'react';
import { Play, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ZulimHeader } from '@/components/zulim/ZulimHeader';
import { DataUpload } from '@/components/zulim/DataUpload';
import { VariableSelection } from '@/components/zulim/VariableSelection';
import { AnalysisConfigPanel } from '@/components/zulim/AnalysisConfig';
import { LayerControls } from '@/components/zulim/LayerControls';
import { ExportPanel } from '@/components/zulim/ExportPanel';
import { MetricsPanel } from '@/components/zulim/MetricsPanel';
import { ProgressBar } from '@/components/zulim/ProgressBar';
import { SpatialMap } from '@/components/zulim/SpatialMap';
import { runAnalysis } from '@/utils/spatialAnalysis';
import type { 
  UploadedData, 
  AnalysisConfig, 
  AnalysisResults, 
  LayerVisibility,
  ColorScheme 
} from '@/types/spatial';

const DEFAULT_CONFIG: AnalysisConfig = {
  algorithm: 'rf',
  gridResolution: 0.005,
  numClasses: 5,
  classificationMethod: 'quantile',
  cvFolds: 5,
  idwPower: 2,
  rfTrees: 100,
  rpeMethod: 'combined',
  rpeBuffer: 0.01,
  uncertaintyThreshold: 0.3
};

const DEFAULT_VISIBILITY: LayerVisibility = {
  continuous: true,
  classified: false,
  accuracy: false,
  residuals: false,
  uncertainty: false,
  rpe: true,
  points: true
};

export default function Zulim() {
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  
  // Data state
  const [uploadedData, setUploadedData] = useState<UploadedData | null>(null);
  const [targetVariable, setTargetVariable] = useState('');
  const [usePredictors, setUsePredictors] = useState(false);
  const [selectedPredictors, setSelectedPredictors] = useState<string[]>([]);
  
  // Analysis configuration
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_CONFIG);
  
  // Results and visualization
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(DEFAULT_VISIBILITY);
  const [opacity, setOpacity] = useState(0.7);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('viridis');
  
  // UI state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [showMetrics, setShowMetrics] = useState(false);

  const handleDataLoaded = useCallback((data: UploadedData) => {
    setUploadedData(data);
    setResults(null);
    setTargetVariable('');
    setSelectedPredictors([]);
  }, []);

  const handleLayerVisibilityChange = useCallback((layer: keyof LayerVisibility, visible: boolean) => {
    setLayerVisibility(prev => ({ ...prev, [layer]: visible }));
  }, []);

  const handleRunAnalysis = useCallback(async () => {
    if (!uploadedData || !targetVariable) {
      toast({
        title: "Missing data",
        description: "Please upload data and select a target variable",
        variant: "destructive"
      });
      return;
    }

    if (uploadedData.points.length < 3) {
      toast({
        title: "Insufficient data",
        description: "At least 3 data points are required",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setProgressMessage('Initializing...');

    try {
      const predictors = usePredictors ? selectedPredictors : [];
      
      const analysisResults = await runAnalysis(
        uploadedData.points,
        targetVariable,
        predictors,
        config,
        (prog, msg) => {
          setProgress(prog);
          setProgressMessage(msg);
        }
      );

      setResults(analysisResults);
      
      // Update layer visibility based on analysis type
      if (analysisResults.analysisType === 'single-variable') {
        setLayerVisibility({
          continuous: true,
          classified: false,
          accuracy: false,
          residuals: false,
          uncertainty: false,
          rpe: true,
          points: true
        });
      } else {
        setLayerVisibility({
          continuous: true,
          classified: false,
          accuracy: false,
          residuals: false,
          uncertainty: false,
          rpe: true,
          points: true
        });
      }

      toast({
        title: "Analysis complete",
        description: `${analysisResults.analysisType === 'predictor-based' ? 'Model-based prediction' : 'Interpolation'} completed successfully`,
      });

      setShowMetrics(true);
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [uploadedData, targetVariable, usePredictors, selectedPredictors, config, toast]);

  const canRunAnalysis = uploadedData && targetVariable && !isAnalyzing;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <ZulimHeader />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[380px] min-w-[380px] zulim-sidebar overflow-y-auto scrollbar-thin">
          <DataUpload 
            onDataLoaded={handleDataLoaded}
            uploadedData={uploadedData}
          />
          
          <VariableSelection
            uploadedData={uploadedData}
            targetVariable={targetVariable}
            onTargetChange={setTargetVariable}
            usePredictors={usePredictors}
            onUsePredictorsChange={setUsePredictors}
            selectedPredictors={selectedPredictors}
            onPredictorsChange={setSelectedPredictors}
          />
          
          <AnalysisConfigPanel
            config={config}
            onConfigChange={setConfig}
            usePredictors={usePredictors && selectedPredictors.length > 0}
          />
          
          {/* Run Analysis Button */}
          <div className="zulim-section">
            {isAnalyzing ? (
              <ProgressBar 
                progress={progress}
                message={progressMessage}
                isActive={isAnalyzing}
              />
            ) : (
              <Button 
                onClick={handleRunAnalysis}
                disabled={!canRunAnalysis}
                className="w-full bg-forest-light hover:bg-forest-mid text-white"
                size="lg"
              >
                <Play className="w-4 h-4 mr-2" />
                Run Analysis
              </Button>
            )}
            
            {results && !isAnalyzing && (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => setShowMetrics(true)}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View Metrics
              </Button>
            )}
          </div>
          
          <LayerControls
            results={results}
            visibility={layerVisibility}
            onVisibilityChange={handleLayerVisibilityChange}
            opacity={opacity}
            onOpacityChange={setOpacity}
            colorScheme={colorScheme}
            onColorSchemeChange={setColorScheme}
          />
          
          <ExportPanel 
            results={results}
            mapRef={mapRef}
          />
        </aside>
        
        {/* Map Container */}
        <main className="flex-1 relative">
          <SpatialMap
            ref={mapRef}
            dataPoints={uploadedData?.points || []}
            results={results}
            visibility={layerVisibility}
            opacity={opacity}
            colorScheme={colorScheme}
          />
          
          <MetricsPanel
            results={results}
            isOpen={showMetrics}
            onClose={() => setShowMetrics(false)}
          />
        </main>
      </div>
    </div>
  );
}
