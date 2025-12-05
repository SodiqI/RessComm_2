import { X, BarChart3, TrendingUp, Target, AlertTriangle, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AnalysisResults } from '@/types/spatial';

interface MetricsPanelProps {
  results: AnalysisResults | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MetricsPanel({ results, isOpen, onClose }: MetricsPanelProps) {
  if (!isOpen || !results) return null;

  const { metrics, featureImportance, analysisType, targetVar, predictors } = results;

  return (
    <div className="absolute top-4 right-4 z-[1000] w-80 bg-card rounded-xl shadow-xl border border-border animate-slide-in-right">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-forest-light" />
          <h3 className="font-semibold">Analysis Metrics</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Analysis Info */}
        <div className="p-3 bg-sage-light rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Analysis Type</p>
          <span className={`analysis-badge ${analysisType}`}>
            {analysisType === 'predictor-based' ? 'Model-based Prediction' : 'Pure Interpolation'}
          </span>
          <p className="text-sm mt-2">
            <span className="text-muted-foreground">Target:</span>{' '}
            <span className="font-medium">{targetVar}</span>
          </p>
          {predictors.length > 0 && (
            <p className="text-sm">
              <span className="text-muted-foreground">Predictors:</span>{' '}
              <span className="font-medium">{predictors.join(', ')}</span>
            </p>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="metrics-card">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-destructive" />
              <span className="metric-label">RMSE</span>
            </div>
            <p className="metric-value">{metrics.rmse}</p>
          </div>
          
          <div className="metrics-card">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-info" />
              <span className="metric-label">MAE</span>
            </div>
            <p className="metric-value">{metrics.mae}</p>
          </div>
          
          <div className="metrics-card">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-4 h-4 text-success" />
              <span className="metric-label">R²</span>
            </div>
            <p className="metric-value">{metrics.r2}</p>
          </div>
          
          <div className="metrics-card">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="metric-label">Bias</span>
            </div>
            <p className="metric-value">{metrics.bias}</p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Sample size: {metrics.sampleSize}</p>
          <p>Cross-validation: {metrics.cvFolds}-fold</p>
        </div>

        {/* Feature Importance (for predictor-based) */}
        {featureImportance && featureImportance.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Award className="w-4 h-4 text-forest-light" />
              Feature Importance
            </h4>
            <div className="space-y-2">
              {featureImportance.map((f, idx) => (
                <div key={f.feature} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{f.feature}</span>
                      <span className="text-muted-foreground">{(f.importance * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div 
                        className="h-full bg-forest-light rounded-full transition-all"
                        style={{ width: `${f.importance * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reliability Warning */}
        <div className="p-3 bg-warning/10 rounded-lg border border-warning/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-warning">Reliability Note</p>
              <p className="text-muted-foreground mt-1">
                Predictions outside the Reliable Prediction Extent (RPE) may be unreliable. 
                Check the RPE layer for spatial confidence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
