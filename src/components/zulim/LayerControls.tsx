import { Layers, Eye, EyeOff, Map, Grid, BarChart3, AlertTriangle, Shield, MapPin } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LayerVisibility, ColorScheme, AnalysisResults } from '@/types/spatial';

interface LayerControlsProps {
  results: AnalysisResults | null;
  visibility: LayerVisibility;
  onVisibilityChange: (layer: keyof LayerVisibility, visible: boolean) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  colorScheme: ColorScheme;
  onColorSchemeChange: (scheme: ColorScheme) => void;
}

const LAYER_INFO = {
  continuous: { 
    icon: Map, 
    label: 'Continuous Surface', 
    color: 'bg-forest-light',
    description: 'Interpolated values across the study area'
  },
  classified: { 
    icon: Grid, 
    label: 'Classified Map', 
    color: 'bg-layer-classified',
    description: 'Values grouped into discrete classes'
  },
  accuracy: { 
    icon: BarChart3, 
    label: 'Accuracy Map', 
    color: 'bg-success',
    description: 'Cross-validation error magnitude'
  },
  residuals: { 
    icon: BarChart3, 
    label: 'Residual Map', 
    color: 'bg-layer-residual',
    description: 'Observed - Predicted differences'
  },
  uncertainty: { 
    icon: AlertTriangle, 
    label: 'Uncertainty Map', 
    color: 'bg-layer-uncertainty',
    description: 'Prediction confidence levels'
  },
  rpe: { 
    icon: Shield, 
    label: 'Reliable Extent (RPE)', 
    color: 'bg-layer-rpe',
    description: 'Area with trustworthy predictions'
  },
  points: { 
    icon: MapPin, 
    label: 'Sample Points', 
    color: 'bg-forest-dark',
    description: 'Original data point locations'
  }
};

export function LayerControls({
  results,
  visibility,
  onVisibilityChange,
  opacity,
  onOpacityChange,
  colorScheme,
  onColorSchemeChange
}: LayerControlsProps) {
  const analysisType = results?.analysisType || 'single-variable';
  
  // Determine available layers based on analysis type
  const availableLayers: (keyof LayerVisibility)[] = [
    'continuous',
    'classified',
    ...(analysisType === 'single-variable' ? ['accuracy'] : ['residuals', 'uncertainty']),
    'rpe',
    'points'
  ] as (keyof LayerVisibility)[];

  return (
    <div className="zulim-section">
      <h3 className="zulim-section-title">
        <Layers className="w-4 h-4" />
        Output Layers
      </h3>

      {!results ? (
        <p className="text-sm text-muted-foreground">
          Run analysis to view output layers
        </p>
      ) : (
        <div className="space-y-4">
          {/* Analysis Type Badge */}
          <div className="p-2 bg-sage-light rounded-md">
            <p className="text-xs text-muted-foreground mb-1">Output Type:</p>
            <span className={`analysis-badge ${analysisType}`}>
              {analysisType === 'predictor-based' 
                ? 'Model-based Predicted Surface' 
                : 'Pure Interpolation Output'}
            </span>
          </div>

          {/* Layer Toggles */}
          <div className="space-y-2">
            {availableLayers.map(layerKey => {
              const info = LAYER_INFO[layerKey];
              const Icon = info.icon;
              const isVisible = visibility[layerKey];

              return (
                <div 
                  key={layerKey}
                  className={`layer-toggle ${isVisible ? 'active' : ''}`}
                  onClick={() => onVisibilityChange(layerKey, !isVisible)}
                >
                  <div className={`w-3 h-3 rounded-full ${info.color}`} />
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{info.label}</p>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                  {isVisible ? (
                    <Eye className="w-4 h-4 text-forest-light" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Color Scheme */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Color Scheme</Label>
            <Select value={colorScheme} onValueChange={(v) => onColorSchemeChange(v as ColorScheme)}>
              <SelectTrigger className="bg-sage-light border-forest-light/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viridis">Viridis</SelectItem>
                <SelectItem value="plasma">Plasma</SelectItem>
                <SelectItem value="terrain">Terrain</SelectItem>
                <SelectItem value="spectral">Spectral</SelectItem>
                <SelectItem value="coolwarm">Cool-Warm</SelectItem>
                <SelectItem value="greens">Greens</SelectItem>
                <SelectItem value="reds">Reds</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Opacity Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Layer Opacity</Label>
              <span className="text-xs text-muted-foreground">{Math.round(opacity * 100)}%</span>
            </div>
            <Slider
              value={[opacity]}
              onValueChange={([v]) => onOpacityChange(v)}
              min={0.1}
              max={1}
              step={0.05}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
