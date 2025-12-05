import { useState, useMemo } from 'react';
import { Target, GitBranch, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { UploadedData } from '@/types/spatial';

interface VariableSelectionProps {
  uploadedData: UploadedData | null;
  targetVariable: string;
  onTargetChange: (value: string) => void;
  usePredictors: boolean;
  onUsePredictorsChange: (value: boolean) => void;
  selectedPredictors: string[];
  onPredictorsChange: (predictors: string[]) => void;
}

export function VariableSelection({
  uploadedData,
  targetVariable,
  onTargetChange,
  usePredictors,
  onUsePredictorsChange,
  selectedPredictors,
  onPredictorsChange
}: VariableSelectionProps) {
  const numericFields = useMemo(() => {
    if (!uploadedData) return [];
    
    return uploadedData.headers.filter(h => {
      const firstValue = uploadedData.points[0]?.properties[h];
      return typeof firstValue === 'number' && 
        !h.toLowerCase().includes('lat') && 
        !h.toLowerCase().includes('lon') &&
        !h.toLowerCase().includes('lng');
    });
  }, [uploadedData]);

  const availablePredictors = useMemo(() => {
    return numericFields.filter(f => f !== targetVariable);
  }, [numericFields, targetVariable]);

  const togglePredictor = (predictor: string) => {
    if (selectedPredictors.includes(predictor)) {
      onPredictorsChange(selectedPredictors.filter(p => p !== predictor));
    } else {
      onPredictorsChange([...selectedPredictors, predictor]);
    }
  };

  if (!uploadedData) {
    return (
      <div className="zulim-section">
        <h3 className="zulim-section-title">
          <Target className="w-4 h-4" />
          Variables
        </h3>
        <p className="text-sm text-muted-foreground">
          Upload a dataset to select variables
        </p>
      </div>
    );
  }

  return (
    <div className="zulim-section">
      <h3 className="zulim-section-title">
        <Target className="w-4 h-4" />
        Variables
      </h3>

      <div className="space-y-4">
        {/* Target Variable */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Target Variable</Label>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">The variable you want to interpolate across space</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select value={targetVariable} onValueChange={onTargetChange}>
            <SelectTrigger className="w-full bg-sage-light border-forest-light/30">
              <SelectValue placeholder="Select target variable" />
            </SelectTrigger>
            <SelectContent>
              {numericFields.map(field => (
                <SelectItem key={field} value={field}>
                  {field}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Use Predictors Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="use-predictors" 
            checked={usePredictors}
            onCheckedChange={(checked) => onUsePredictorsChange(checked as boolean)}
            className="border-forest-light data-[state=checked]:bg-forest-light"
          />
          <label 
            htmlFor="use-predictors" 
            className="text-sm font-medium cursor-pointer flex items-center gap-2"
          >
            Use Predictor Variables
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Enable to use regression-based interpolation with additional predictor variables
                </p>
              </TooltipContent>
            </Tooltip>
          </label>
        </div>

        {/* Predictor Selection */}
        {usePredictors && (
          <div className="p-3 bg-sage-light rounded-lg border border-forest-light/20 animate-fade-in">
            <Label className="text-sm font-medium mb-2 block">
              Select predictor variables:
            </Label>
            
            {availablePredictors.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {targetVariable 
                  ? "No other numeric fields available" 
                  : "Select a target variable first"}
              </p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-thin">
                {availablePredictors.map(field => (
                  <div key={field} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`pred-${field}`}
                      checked={selectedPredictors.includes(field)}
                      onCheckedChange={() => togglePredictor(field)}
                      className="border-forest-light/50 data-[state=checked]:bg-forest-mid"
                    />
                    <label 
                      htmlFor={`pred-${field}`}
                      className="text-sm cursor-pointer"
                    >
                      {field}
                    </label>
                  </div>
                ))}
              </div>
            )}
            
            {selectedPredictors.length > 0 && (
              <p className="text-xs text-forest-mid mt-2">
                {selectedPredictors.length} predictor(s) selected
              </p>
            )}
          </div>
        )}

        {/* Analysis Type Indicator */}
        {targetVariable && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Analysis type:</span>
              <span className={`analysis-badge ${usePredictors && selectedPredictors.length > 0 ? 'predictor-based' : 'single-variable'}`}>
                {usePredictors && selectedPredictors.length > 0 
                  ? 'Predictor-based' 
                  : 'Single-variable'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
