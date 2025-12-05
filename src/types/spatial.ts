// Spatial data types for ZULIM

export interface DataPoint {
  lat: number;
  lng: number;
  properties: Record<string, number | string>;
}

export interface GridCell {
  lat: number;
  lng: number;
  value: number;
  class?: number;
  accuracy?: number;
  residual?: number;
  uncertainty?: number;
  reliable?: boolean;
}

export interface UploadedData {
  type: 'csv' | 'geojson' | 'demo';
  headers: string[];
  data: any[];
  points: DataPoint[];
}

export interface AnalysisMetrics {
  rmse: string;
  mae: string;
  r2: string;
  bias: string;
  sampleSize?: number;
  cvFolds?: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface AnalysisResults {
  analysisType: 'single-variable' | 'predictor-based';
  targetVar: string;
  predictors: string[];
  continuous: {
    grid: GridCell[];
    minVal: number;
    maxVal: number;
  };
  classified?: GridCell[];
  accuracy?: GridCell[];
  residuals?: GridCell[];
  uncertainty?: GridCell[];
  rpe?: GridCell[];
  rpePolygon?: DataPoint[];
  metrics: AnalysisMetrics;
  featureImportance?: FeatureImportance[];
  timestamp: Date;
}

export interface AnalysisConfig {
  algorithm: 'idw' | 'rf' | 'svr' | 'kriging' | 'regression-kriging';
  gridResolution: number;
  numClasses: number;
  classificationMethod: 'equal' | 'quantile' | 'jenks';
  cvFolds: number;
  idwPower: number;
  rfTrees: number;
  rpeMethod: 'convex-hull' | 'kernel-density' | 'distance' | 'uncertainty' | 'combined';
  rpeBuffer: number;
  uncertaintyThreshold: number;
}

export type OutputLayerType = 
  | 'continuous' 
  | 'classified' 
  | 'accuracy' 
  | 'residuals' 
  | 'uncertainty' 
  | 'rpe' 
  | 'points';

export interface LayerVisibility {
  continuous: boolean;
  classified: boolean;
  accuracy: boolean;
  residuals: boolean;
  uncertainty: boolean;
  rpe: boolean;
  points: boolean;
}

export type ColorScheme = 'viridis' | 'plasma' | 'coolwarm' | 'greens' | 'reds' | 'terrain' | 'spectral';

export interface ExportOption {
  id: string;
  label: string;
  description: string;
  format: 'geotiff' | 'shapefile' | 'csv' | 'pdf' | 'png';
  available: boolean;
}
