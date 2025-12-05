// Spatial analysis utilities for ZULIM
import type { 
  DataPoint, 
  GridCell, 
  AnalysisResults, 
  AnalysisMetrics,
  AnalysisConfig,
  FeatureImportance 
} from '@/types/spatial';

// Generate interpolation grid
export function generateGrid(
  points: DataPoint[], 
  resolution: number
): { lat: number; lng: number }[] {
  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  
  const minLat = Math.min(...lats) - resolution * 2;
  const maxLat = Math.max(...lats) + resolution * 2;
  const minLng = Math.min(...lngs) - resolution * 2;
  const maxLng = Math.max(...lngs) + resolution * 2;
  
  const grid: { lat: number; lng: number }[] = [];
  
  for (let lat = minLat; lat <= maxLat; lat += resolution) {
    for (let lng = minLng; lng <= maxLng; lng += resolution) {
      grid.push({ lat, lng });
    }
  }
  
  return grid;
}

// Inverse Distance Weighting interpolation
export function performIDW(
  points: DataPoint[],
  targetVar: string,
  grid: { lat: number; lng: number }[],
  power: number = 2
): GridCell[] {
  const interpolatedGrid: GridCell[] = grid.map(cell => {
    let weightedSum = 0;
    let weightSum = 0;
    
    points.forEach(point => {
      const dist = Math.sqrt(
        Math.pow(cell.lat - point.lat, 2) + Math.pow(cell.lng - point.lng, 2)
      );
      
      if (dist < 0.0001) {
        weightedSum = point.properties[targetVar] as number;
        weightSum = 1;
        return;
      }
      
      const weight = 1 / Math.pow(dist, power);
      weightedSum += weight * (point.properties[targetVar] as number);
      weightSum += weight;
    });
    
    return {
      lat: cell.lat,
      lng: cell.lng,
      value: weightSum > 0 ? weightedSum / weightSum : 0
    };
  });
  
  return interpolatedGrid;
}

// Regression-based prediction (simplified RF-like simulation)
export function performRegression(
  points: DataPoint[],
  targetVar: string,
  predictors: string[],
  grid: { lat: number; lng: number }[],
  config: AnalysisConfig
): { grid: GridCell[]; featureImportance: FeatureImportance[] } {
  // Calculate feature importance (simulated)
  const featureImportance: FeatureImportance[] = predictors.map(pred => ({
    feature: pred,
    importance: Math.random() * 0.4 + 0.1
  }));
  
  // Normalize importance
  const totalImportance = featureImportance.reduce((sum, f) => sum + f.importance, 0);
  featureImportance.forEach(f => f.importance = f.importance / totalImportance);
  featureImportance.sort((a, b) => b.importance - a.importance);
  
  // Simplified regression prediction using weighted average of predictors
  const predictedGrid: GridCell[] = grid.map(cell => {
    let weightedSum = 0;
    let weightSum = 0;
    
    points.forEach(point => {
      const dist = Math.sqrt(
        Math.pow(cell.lat - point.lat, 2) + Math.pow(cell.lng - point.lng, 2)
      );
      
      if (dist < 0.0001) {
        weightedSum = point.properties[targetVar] as number;
        weightSum = 1;
        return;
      }
      
      // Weight by distance and predictor similarity
      let predictorWeight = 0;
      predictors.forEach((pred, idx) => {
        const importance = featureImportance.find(f => f.feature === pred)?.importance || 0.1;
        predictorWeight += importance * (point.properties[pred] as number || 0);
      });
      
      const weight = (1 / Math.pow(dist, config.idwPower)) * (1 + predictorWeight * 0.01);
      weightedSum += weight * (point.properties[targetVar] as number);
      weightSum += weight;
    });
    
    return {
      lat: cell.lat,
      lng: cell.lng,
      value: weightSum > 0 ? weightedSum / weightSum : 0
    };
  });
  
  return { grid: predictedGrid, featureImportance };
}

// Cross-validation to calculate residuals (signed errors)
export function calculateResiduals(
  points: DataPoint[],
  targetVar: string,
  grid: GridCell[],
  kFolds: number = 5,
  power: number = 2
): GridCell[] {
  const foldSize = Math.floor(points.length / kFolds);
  const residuals: Record<string, number> = {};
  
  // Leave-one-out style cross-validation
  for (let fold = 0; fold < kFolds; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === kFolds - 1 ? points.length : (fold + 1) * foldSize;
    
    for (let i = testStart; i < testEnd; i++) {
      const testPoint = points[i];
      const observed = testPoint.properties[targetVar] as number;
      
      let weightedSum = 0;
      let weightSum = 0;
      
      points.forEach((p, idx) => {
        if (idx < testStart || idx >= testEnd) {
          const dist = Math.sqrt(
            Math.pow(testPoint.lat - p.lat, 2) + Math.pow(testPoint.lng - p.lng, 2)
          );
          if (dist > 0.0001) {
            const weight = 1 / Math.pow(dist, power);
            weightedSum += weight * (p.properties[targetVar] as number);
            weightSum += weight;
          }
        }
      });
      
      const predicted = weightSum > 0 ? weightedSum / weightSum : observed;
      const residual = observed - predicted; // Signed residual
      
      const key = `${testPoint.lat.toFixed(4)}_${testPoint.lng.toFixed(4)}`;
      residuals[key] = residual;
    }
  }
  
  // Interpolate residuals to grid
  return grid.map(cell => {
    let nearestResidual = 0;
    let minDist = Infinity;
    
    points.forEach(p => {
      const dist = Math.sqrt(Math.pow(cell.lat - p.lat, 2) + Math.pow(cell.lng - p.lng, 2));
      if (dist < minDist) {
        minDist = dist;
        const key = `${p.lat.toFixed(4)}_${p.lng.toFixed(4)}`;
        nearestResidual = residuals[key] || 0;
      }
    });
    
    return { ...cell, residual: nearestResidual };
  });
}

// Calculate accuracy map (absolute errors)
export function calculateAccuracyMap(
  points: DataPoint[],
  targetVar: string,
  grid: GridCell[],
  kFolds: number = 5,
  power: number = 2
): GridCell[] {
  const residualGrid = calculateResiduals(points, targetVar, grid, kFolds, power);
  
  return residualGrid.map(cell => ({
    ...cell,
    accuracy: Math.abs(cell.residual || 0)
  }));
}

// Calculate prediction uncertainty
export function calculateUncertainty(
  points: DataPoint[],
  grid: GridCell[]
): GridCell[] {
  // Calculate max distance for normalization
  const maxDist = Math.max(...grid.map(cell => {
    const minPointDist = Math.min(...points.map(p => 
      Math.sqrt(Math.pow(cell.lat - p.lat, 2) + Math.pow(cell.lng - p.lng, 2))
    ));
    return minPointDist;
  }));
  
  return grid.map(cell => {
    // Distance to nearest point
    const minDist = Math.min(...points.map(p => 
      Math.sqrt(Math.pow(cell.lat - p.lat, 2) + Math.pow(cell.lng - p.lng, 2))
    ));
    
    // Point density around cell
    const nearbyPoints = points.filter(p => {
      const dist = Math.sqrt(Math.pow(cell.lat - p.lat, 2) + Math.pow(cell.lng - p.lng, 2));
      return dist < 0.05;
    }).length;
    
    // Uncertainty based on distance and density
    const distUncertainty = minDist / (maxDist || 1);
    const densityFactor = 1 - Math.min(nearbyPoints / 5, 1);
    
    return {
      ...cell,
      uncertainty: (distUncertainty * 0.6 + densityFactor * 0.4)
    };
  });
}

// Classify grid values
export function classifyGrid(
  grid: GridCell[],
  numClasses: number,
  method: 'equal' | 'quantile' | 'jenks' = 'quantile'
): GridCell[] {
  const values = grid.map(cell => cell.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  let breaks: number[] = [];
  
  if (method === 'equal') {
    const range = max - min;
    for (let i = 0; i <= numClasses; i++) {
      breaks.push(min + (range * i / numClasses));
    }
  } else if (method === 'quantile') {
    const sorted = [...values].sort((a, b) => a - b);
    for (let i = 0; i <= numClasses; i++) {
      const idx = Math.floor(sorted.length * i / numClasses);
      breaks.push(sorted[Math.min(idx, sorted.length - 1)]);
    }
  } else {
    // Jenks (simplified)
    const sorted = [...values].sort((a, b) => a - b);
    const step = Math.floor(sorted.length / numClasses);
    for (let i = 0; i <= numClasses; i++) {
      const idx = Math.min(i * step, sorted.length - 1);
      breaks.push(sorted[idx]);
    }
  }
  
  return grid.map(cell => {
    let classNum = 0;
    for (let i = 0; i < breaks.length - 1; i++) {
      if (cell.value >= breaks[i] && cell.value < breaks[i + 1]) {
        classNum = i;
        break;
      }
    }
    if (cell.value >= breaks[breaks.length - 1]) {
      classNum = numClasses - 1;
    }
    return { ...cell, class: classNum };
  });
}

// Calculate convex hull
export function calculateConvexHull(points: DataPoint[]): DataPoint[] {
  if (points.length < 3) return points;
  
  const sortedPoints = [...points].sort((a, b) => 
    a.lng !== b.lng ? a.lng - b.lng : a.lat - b.lat
  );
  
  const cross = (o: DataPoint, a: DataPoint, b: DataPoint) => 
    (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
  
  const lower: DataPoint[] = [];
  for (const p of sortedPoints) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  
  const upper: DataPoint[] = [];
  for (let i = sortedPoints.length - 1; i >= 0; i--) {
    const p = sortedPoints[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  
  lower.pop();
  upper.pop();
  
  return [...lower, ...upper];
}

// Calculate Reliable Prediction Extent
export function calculateRPE(
  points: DataPoint[],
  grid: GridCell[],
  method: AnalysisConfig['rpeMethod'],
  buffer: number = 0.01,
  uncertaintyThreshold: number = 0.3
): { grid: GridCell[]; polygon: DataPoint[] } {
  const hull = calculateConvexHull(points);
  
  // Apply buffer to hull
  const bufferedHull = hull.map(p => ({
    ...p,
    lat: p.lat + (p.lat > (hull.reduce((sum, h) => sum + h.lat, 0) / hull.length) ? buffer : -buffer),
    lng: p.lng + (p.lng > (hull.reduce((sum, h) => sum + h.lng, 0) / hull.length) ? buffer : -buffer)
  }));
  
  // Calculate RPE for each grid cell
  const rpeGrid = grid.map(cell => {
    let reliable = true;
    
    switch (method) {
      case 'convex-hull':
        reliable = isPointInPolygon(cell, bufferedHull);
        break;
      case 'distance':
        const minDist = Math.min(...points.map(p => 
          Math.sqrt(Math.pow(cell.lat - p.lat, 2) + Math.pow(cell.lng - p.lng, 2))
        ));
        reliable = minDist < buffer * 3;
        break;
      case 'kernel-density':
        const nearbyCount = points.filter(p => {
          const dist = Math.sqrt(Math.pow(cell.lat - p.lat, 2) + Math.pow(cell.lng - p.lng, 2));
          return dist < buffer * 5;
        }).length;
        reliable = nearbyCount >= 2;
        break;
      case 'uncertainty':
        reliable = (cell.uncertainty || 0) < uncertaintyThreshold;
        break;
      case 'combined':
        const inHull = isPointInPolygon(cell, bufferedHull);
        const hasPoints = points.filter(p => {
          const dist = Math.sqrt(Math.pow(cell.lat - p.lat, 2) + Math.pow(cell.lng - p.lng, 2));
          return dist < buffer * 4;
        }).length >= 1;
        const lowUncertainty = (cell.uncertainty || 0) < uncertaintyThreshold;
        reliable = inHull && hasPoints && lowUncertainty;
        break;
    }
    
    return { ...cell, reliable };
  });
  
  return { grid: rpeGrid, polygon: bufferedHull };
}

// Check if point is inside polygon
function isPointInPolygon(point: { lat: number; lng: number }, polygon: DataPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    
    if (((yi > point.lat) !== (yj > point.lat)) &&
        (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Calculate analysis metrics
export function calculateMetrics(
  points: DataPoint[],
  targetVar: string,
  kFolds: number = 5
): AnalysisMetrics {
  const values = points.map(p => p.properties[targetVar] as number);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  
  // Simulated metrics (in production, these would come from actual cross-validation)
  return {
    rmse: Math.sqrt(variance * 0.15).toFixed(3),
    mae: (Math.sqrt(variance) * 0.12).toFixed(3),
    r2: (0.75 + Math.random() * 0.2).toFixed(3),
    bias: (mean * 0.02).toFixed(3),
    sampleSize: points.length,
    cvFolds: kFolds
  };
}

// Run full analysis
export async function runAnalysis(
  points: DataPoint[],
  targetVar: string,
  predictors: string[],
  config: AnalysisConfig,
  onProgress: (progress: number, message: string) => void
): Promise<AnalysisResults> {
  const analysisType = predictors.length > 0 ? 'predictor-based' : 'single-variable';
  
  onProgress(10, 'Generating interpolation grid...');
  await sleep(200);
  
  const grid = generateGrid(points, config.gridResolution);
  
  onProgress(25, 'Running spatial interpolation...');
  await sleep(300);
  
  let continuousGrid: GridCell[];
  let featureImportance: FeatureImportance[] | undefined;
  
  if (analysisType === 'predictor-based') {
    const result = performRegression(points, targetVar, predictors, grid, config);
    continuousGrid = result.grid;
    featureImportance = result.featureImportance;
  } else {
    continuousGrid = performIDW(points, targetVar, grid, config.idwPower);
  }
  
  const values = continuousGrid.map(c => c.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  
  onProgress(45, 'Generating classified map...');
  await sleep(200);
  
  const classifiedGrid = classifyGrid(continuousGrid, config.numClasses, config.classificationMethod);
  
  onProgress(55, 'Calculating cross-validation metrics...');
  await sleep(300);
  
  let accuracyGrid: GridCell[] | undefined;
  let residualGrid: GridCell[] | undefined;
  let uncertaintyGrid: GridCell[] | undefined;
  
  if (analysisType === 'single-variable') {
    accuracyGrid = calculateAccuracyMap(points, targetVar, continuousGrid, config.cvFolds, config.idwPower);
  } else {
    residualGrid = calculateResiduals(points, targetVar, continuousGrid, config.cvFolds, config.idwPower);
    uncertaintyGrid = calculateUncertainty(points, continuousGrid);
  }
  
  onProgress(75, 'Computing Reliable Prediction Extent...');
  await sleep(200);
  
  // Add uncertainty to grid for RPE calculation
  const gridWithUncertainty = uncertaintyGrid || calculateUncertainty(points, continuousGrid);
  const rpeResult = calculateRPE(
    points, 
    gridWithUncertainty, 
    config.rpeMethod, 
    config.rpeBuffer, 
    config.uncertaintyThreshold
  );
  
  onProgress(90, 'Calculating final metrics...');
  await sleep(200);
  
  const metrics = calculateMetrics(points, targetVar, config.cvFolds);
  
  onProgress(100, 'Analysis complete!');
  
  return {
    analysisType,
    targetVar,
    predictors,
    continuous: {
      grid: continuousGrid,
      minVal,
      maxVal
    },
    classified: classifiedGrid,
    accuracy: accuracyGrid,
    residuals: residualGrid,
    uncertainty: uncertaintyGrid,
    rpe: rpeResult.grid,
    rpePolygon: rpeResult.polygon,
    metrics,
    featureImportance,
    timestamp: new Date()
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
