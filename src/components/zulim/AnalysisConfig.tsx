import { useState } from 'react';
import { Settings, ChevronDown, ChevronUp, Brain, Grid, Shield } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AnalysisConfig } from '@/types/spatial';

interface AnalysisConfigProps {
  config: AnalysisConfig;
  onConfigChange: (config: AnalysisConfig) => void;
  usePredictors: boolean;
}

export function AnalysisConfigPanel({ config, onConfigChange, usePredictors }: AnalysisConfigProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rpeOpen, setRpeOpen] = useState(false);

  const updateConfig = (key: keyof AnalysisConfig, value: any) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="zulim-section">
      <h3 className="zulim-section-title">
        <Brain className="w-4 h-4" />
        Algorithm & Grid
      </h3>

      <div className="space-y-4">
        {/* Algorithm Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Interpolation Method</Label>
          <Select 
            value={config.algorithm} 
            onValueChange={(v) => updateConfig('algorithm', v)}
          >
            <SelectTrigger className="bg-sage-light border-forest-light/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="idw">Inverse Distance Weighting (IDW)</SelectItem>
              <SelectItem value="rf">Random Forest</SelectItem>
              <SelectItem value="svr">Support Vector Regression</SelectItem>
              <SelectItem value="kriging">Ordinary Kriging</SelectItem>
              <SelectItem value="regression-kriging">Regression-Kriging</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid Resolution */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Grid Resolution (degrees)</Label>
          <Input
            type="number"
            value={config.gridResolution}
            onChange={(e) => updateConfig('gridResolution', parseFloat(e.target.value) || 0.005)}
            min={0.001}
            max={0.1}
            step={0.001}
            className="bg-sage-light border-forest-light/30"
          />
        </div>

        {/* Classification */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Classes</Label>
            <Input
              type="number"
              value={config.numClasses}
              onChange={(e) => updateConfig('numClasses', parseInt(e.target.value) || 5)}
              min={2}
              max={10}
              className="bg-sage-light border-forest-light/30"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Method</Label>
            <Select 
              value={config.classificationMethod} 
              onValueChange={(v) => updateConfig('classificationMethod', v as any)}
            >
              <SelectTrigger className="bg-sage-light border-forest-light/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quantile">Quantile</SelectItem>
                <SelectItem value="equal">Equal Interval</SelectItem>
                <SelectItem value="jenks">Natural Breaks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Parameters */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-sage-light rounded-md hover:bg-sage transition-colors">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Settings className="w-4 h-4" />
              Advanced Parameters
            </span>
            {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">IDW Power</Label>
                <Input
                  type="number"
                  value={config.idwPower}
                  onChange={(e) => updateConfig('idwPower', parseFloat(e.target.value) || 2)}
                  min={1}
                  max={5}
                  step={0.1}
                  className="bg-sage-light border-forest-light/30 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">CV Folds</Label>
                <Input
                  type="number"
                  value={config.cvFolds}
                  onChange={(e) => updateConfig('cvFolds', parseInt(e.target.value) || 5)}
                  min={3}
                  max={10}
                  className="bg-sage-light border-forest-light/30 text-sm"
                />
              </div>
            </div>
            {usePredictors && (
              <div className="space-y-2">
                <Label className="text-xs">RF Trees</Label>
                <Input
                  type="number"
                  value={config.rfTrees}
                  onChange={(e) => updateConfig('rfTrees', parseInt(e.target.value) || 100)}
                  min={10}
                  max={500}
                  className="bg-sage-light border-forest-light/30 text-sm"
                />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* RPE Configuration */}
        <Collapsible open={rpeOpen} onOpenChange={setRpeOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-sage-light rounded-md hover:bg-sage transition-colors">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Shield className="w-4 h-4" />
              Reliable Prediction Extent
            </span>
            {rpeOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">RPE Method</Label>
              <Select 
                value={config.rpeMethod} 
                onValueChange={(v) => updateConfig('rpeMethod', v as any)}
              >
                <SelectTrigger className="bg-sage-light border-forest-light/30 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="convex-hull">Convex Hull + Buffer</SelectItem>
                  <SelectItem value="kernel-density">Kernel Density Threshold</SelectItem>
                  <SelectItem value="distance">Distance to Points</SelectItem>
                  <SelectItem value="uncertainty">Uncertainty Threshold</SelectItem>
                  <SelectItem value="combined">Combined (Recommended)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Buffer (deg)</Label>
                <Input
                  type="number"
                  value={config.rpeBuffer}
                  onChange={(e) => updateConfig('rpeBuffer', parseFloat(e.target.value) || 0.01)}
                  min={0.001}
                  max={0.1}
                  step={0.001}
                  className="bg-sage-light border-forest-light/30 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Uncertainty %</Label>
                <Input
                  type="number"
                  value={config.uncertaintyThreshold * 100}
                  onChange={(e) => updateConfig('uncertaintyThreshold', (parseFloat(e.target.value) || 30) / 100)}
                  min={10}
                  max={90}
                  className="bg-sage-light border-forest-light/30 text-sm"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
