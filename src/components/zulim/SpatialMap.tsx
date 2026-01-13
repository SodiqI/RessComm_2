import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DataPoint, GridCell, AnalysisResults, LayerVisibility, ColorScheme } from '@/types/spatial';
import { getColorForValue, getColorForClass, getReliabilityColor, getGradientCSS } from '@/utils/colorSchemes';
import { BASEMAP_OPTIONS, DEFAULT_BASEMAP, getBasemapById } from '@/utils/basemapConfig';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Map } from 'lucide-react';

interface SpatialMapProps {
  dataPoints: DataPoint[];
  results: AnalysisResults | null;
  visibility: LayerVisibility;
  opacity: number;
  colorScheme: ColorScheme;
}

export const SpatialMap = forwardRef<HTMLDivElement, SpatialMapProps>(
  ({ dataPoints, results, visibility, opacity, colorScheme }, ref) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layersRef = useRef<Record<string, L.LayerGroup>>({});
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const [basemapId, setBasemapId] = useState(DEFAULT_BASEMAP);

    useImperativeHandle(ref, () => mapContainerRef.current!);

    // Initialize map
    useEffect(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [9.082, 8.675],
        zoom: 11,
        zoomControl: false
      });

      // Add initial tile layer
      const basemap = getBasemapById(basemapId);
      tileLayerRef.current = L.tileLayer(basemap.url, {
        attribution: basemap.attribution,
        maxZoom: basemap.maxZoom || 19
      }).addTo(map);

      // Add zoom control to top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
      };
    }, []);
    
    // Update basemap when selection changes
    useEffect(() => {
      if (!mapRef.current) return;
      
      const basemap = getBasemapById(basemapId);
      
      if (tileLayerRef.current) {
        mapRef.current.removeLayer(tileLayerRef.current);
      }
      
      tileLayerRef.current = L.tileLayer(basemap.url, {
        attribution: basemap.attribution,
        maxZoom: basemap.maxZoom || 19
      }).addTo(mapRef.current);
      
      // Move tile layer to back
      tileLayerRef.current.bringToBack();
    }, [basemapId]);

    // Update data points layer
    useEffect(() => {
      if (!mapRef.current) return;

      // Remove existing points layer
      if (layersRef.current.points) {
        mapRef.current.removeLayer(layersRef.current.points);
      }

      if (dataPoints.length === 0) return;

      const markers = dataPoints.map(point => 
        L.circleMarker([point.lat, point.lng], {
          radius: 6,
          fillColor: '#1b4332',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        }).bindPopup(`
          <div style="font-family: 'Plus Jakarta Sans', sans-serif;">
            <strong>Sample Point</strong><br/>
            <small>Lat: ${point.lat.toFixed(6)}<br/>
            Lng: ${point.lng.toFixed(6)}</small>
            ${Object.entries(point.properties)
              .filter(([k]) => !k.toLowerCase().includes('lat') && !k.toLowerCase().includes('lng'))
              .slice(0, 5)
              .map(([k, v]) => `<br/><span style="color: #666;">${k}:</span> ${typeof v === 'number' ? v.toFixed(2) : v}`)
              .join('')}
          </div>
        `)
      );

      layersRef.current.points = L.layerGroup(markers);
      
      if (visibility.points) {
        layersRef.current.points.addTo(mapRef.current);
      }

      // Fit bounds to points
      const bounds = L.latLngBounds(dataPoints.map(p => [p.lat, p.lng]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }, [dataPoints]);

    // Update result layers
    useEffect(() => {
      if (!mapRef.current || !results) return;

      const { continuous, classified, accuracy, residuals, uncertainty, rpe, rpePolygon } = results;
      
      // Calculate cell size
      const grid = continuous.grid;
      if (grid.length === 0) return;

      const sortedByLat = [...grid].sort((a, b) => a.lat - b.lat);
      const sortedByLng = [...grid].sort((a, b) => a.lng - b.lng);
      
      let minLatSpacing = Infinity;
      let minLngSpacing = Infinity;
      
      for (let i = 1; i < Math.min(sortedByLat.length, 100); i++) {
        const spacing = sortedByLat[i].lat - sortedByLat[i-1].lat;
        if (spacing > 0.0001 && spacing < minLatSpacing) minLatSpacing = spacing;
      }
      
      for (let i = 1; i < Math.min(sortedByLng.length, 100); i++) {
        const spacing = sortedByLng[i].lng - sortedByLng[i-1].lng;
        if (spacing > 0.0001 && spacing < minLngSpacing) minLngSpacing = spacing;
      }
      
      const cellSizeLat = minLatSpacing < Infinity ? minLatSpacing : 0.005;
      const cellSizeLng = minLngSpacing < Infinity ? minLngSpacing : 0.005;

      // Clear existing result layers
      ['continuous', 'classified', 'accuracy', 'residuals', 'uncertainty', 'rpe'].forEach(key => {
        if (layersRef.current[key]) {
          mapRef.current?.removeLayer(layersRef.current[key]);
          delete layersRef.current[key];
        }
      });

      // Create continuous surface layer
      const continuousRects = continuous.grid.map(cell => {
        const color = getColorForValue(cell.value, continuous.minVal, continuous.maxVal, colorScheme);
        return L.rectangle(
          [[cell.lat, cell.lng], [cell.lat + cellSizeLat, cell.lng + cellSizeLng]],
          {
            color: color,
            fillColor: color,
            fillOpacity: opacity * 0.7,
            weight: 0
          }
        ).bindPopup(`Value: ${cell.value.toFixed(2)}`);
      });
      layersRef.current.continuous = L.layerGroup(continuousRects);

      // Create classified layer
      if (classified) {
        const classifiedRects = classified.map(cell => {
          const color = getColorForClass(cell.class || 0, 5);
          return L.rectangle(
            [[cell.lat, cell.lng], [cell.lat + cellSizeLat, cell.lng + cellSizeLng]],
            {
              color: color,
              fillColor: color,
              fillOpacity: opacity * 0.7,
              weight: 0
            }
          ).bindPopup(`Class: ${(cell.class || 0) + 1}<br/>Value: ${cell.value.toFixed(2)}`);
        });
        layersRef.current.classified = L.layerGroup(classifiedRects);
      }

      // Create accuracy layer (single-variable)
      if (accuracy) {
        const maxAccuracy = Math.max(...accuracy.map(c => c.accuracy || 0));
        const accuracyRects = accuracy.map(cell => {
          const normalized = 1 - ((cell.accuracy || 0) / (maxAccuracy || 1));
          const color = getColorForValue(normalized, 0, 1, 'greens');
          return L.rectangle(
            [[cell.lat, cell.lng], [cell.lat + cellSizeLat, cell.lng + cellSizeLng]],
            {
              color: color,
              fillColor: color,
              fillOpacity: opacity * 0.6,
              weight: 0
            }
          ).bindPopup(`Accuracy: ${(normalized * 100).toFixed(1)}%<br/>Error: ${(cell.accuracy || 0).toFixed(2)}`);
        });
        layersRef.current.accuracy = L.layerGroup(accuracyRects);
      }

      // Create residuals layer (predictor-based)
      if (residuals) {
        const maxResidual = Math.max(...residuals.map(c => Math.abs(c.residual || 0)));
        const residualRects = residuals.map(cell => {
          const absResidual = Math.abs(cell.residual || 0);
          const color = getColorForValue(absResidual, 0, maxResidual, 'coolwarm');
          return L.rectangle(
            [[cell.lat, cell.lng], [cell.lat + cellSizeLat, cell.lng + cellSizeLng]],
            {
              color: color,
              fillColor: color,
              fillOpacity: opacity * 0.6,
              weight: 0
            }
          ).bindPopup(`Residual: ${(cell.residual || 0).toFixed(2)}<br/>|Error|: ${absResidual.toFixed(2)}`);
        });
        layersRef.current.residuals = L.layerGroup(residualRects);
      }

      // Create uncertainty layer
      if (uncertainty) {
        const uncertaintyRects = uncertainty.map(cell => {
          const color = getColorForValue(cell.uncertainty || 0, 0, 1, 'plasma');
          return L.rectangle(
            [[cell.lat, cell.lng], [cell.lat + cellSizeLat, cell.lng + cellSizeLng]],
            {
              color: color,
              fillColor: color,
              fillOpacity: opacity * 0.6,
              weight: 0
            }
          ).bindPopup(`Uncertainty: ${((cell.uncertainty || 0) * 100).toFixed(1)}%`);
        });
        layersRef.current.uncertainty = L.layerGroup(uncertaintyRects);
      }

      // Create RPE layer
      if (rpePolygon && rpePolygon.length > 0) {
        const hullLatLngs = rpePolygon.map(p => [p.lat, p.lng] as [number, number]);
        const rpePolygonLayer = L.polygon(hullLatLngs, {
          color: '#f44336',
          weight: 3,
          fillColor: '#4caf50',
          fillOpacity: 0.1,
          dashArray: '10, 10'
        }).bindPopup('Reliable Prediction Extent<br/><small>Predictions outside this area may be unreliable</small>');
        
        layersRef.current.rpe = L.layerGroup([rpePolygonLayer]);
      }

      // Add visible layers
      if (visibility.continuous && layersRef.current.continuous) {
        layersRef.current.continuous.addTo(mapRef.current);
      }

    }, [results, colorScheme, opacity]);

    // Update layer visibility
    useEffect(() => {
      if (!mapRef.current) return;

      Object.entries(visibility).forEach(([key, isVisible]) => {
        const layer = layersRef.current[key];
        if (!layer) return;

        if (isVisible && !mapRef.current!.hasLayer(layer)) {
          layer.addTo(mapRef.current!);
        } else if (!isVisible && mapRef.current!.hasLayer(layer)) {
          mapRef.current!.removeLayer(layer);
        }
      });

      // Keep points on top
      if (layersRef.current.points && visibility.points && mapRef.current) {
        mapRef.current.removeLayer(layersRef.current.points);
        layersRef.current.points.addTo(mapRef.current);
      }
    }, [visibility]);

    // Update opacity
    useEffect(() => {
      // This would require recreating layers, which is handled in the results effect
    }, [opacity]);

    // Helper to get active layer for legend
    const getActiveLayerType = () => {
      if (visibility.continuous) return 'continuous';
      if (visibility.classified) return 'classified';
      if (visibility.accuracy) return 'accuracy';
      if (visibility.residuals) return 'residuals';
      if (visibility.uncertainty) return 'uncertainty';
      if (visibility.rpe) return 'rpe';
      return null;
    };

    const activeLayer = getActiveLayerType();
    const numClasses = results?.classified ? Math.max(...results.classified.map(c => (c.class || 0) + 1)) : 5;

    return (
      <div className="relative w-full h-full">
        <div ref={mapContainerRef} className="w-full h-full" />
        
        {/* Continuous Surface Legend */}
        {results && visibility.continuous && (
          <div className="absolute bottom-6 left-4 z-[1000] bg-card p-3 rounded-lg shadow-lg border border-border min-w-[180px]">
            <h4 className="text-xs font-semibold mb-2 text-foreground">
              {results.analysisType === 'predictor-based' ? 'Predicted Surface' : 'Interpolated Surface'}
            </h4>
            <p className="text-[10px] text-muted-foreground mb-1">{results.targetVar}</p>
            <div 
              className="h-4 rounded-sm mb-1"
              style={{ background: getGradientCSS(colorScheme) }}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{results.continuous.minVal.toFixed(2)}</span>
              <span>{results.continuous.maxVal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground/70 mt-0.5">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        )}

        {/* Classified Map Legend */}
        {results && visibility.classified && results.classified && (
          <div className="absolute bottom-6 left-4 z-[1000] bg-card p-3 rounded-lg shadow-lg border border-border min-w-[180px]">
            <h4 className="text-xs font-semibold mb-2 text-foreground">Classified Map</h4>
            <p className="text-[10px] text-muted-foreground mb-2">{results.targetVar}</p>
            <div className="space-y-1">
              {Array.from({ length: numClasses }).map((_, i) => {
                const classRange = (results.continuous.maxVal - results.continuous.minVal) / numClasses;
                const low = results.continuous.minVal + i * classRange;
                const high = results.continuous.minVal + (i + 1) * classRange;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div 
                      className="w-4 h-3 rounded-sm border border-border/50"
                      style={{ backgroundColor: getColorForClass(i, numClasses) }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Class {i + 1}: {low.toFixed(2)} - {high.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Accuracy Surface Legend (Single-variable) */}
        {results && visibility.accuracy && results.accuracy && (
          <div className="absolute bottom-6 left-4 z-[1000] bg-card p-3 rounded-lg shadow-lg border border-border min-w-[180px]">
            <h4 className="text-xs font-semibold mb-2 text-foreground">Cross-Validation Accuracy</h4>
            <p className="text-[10px] text-muted-foreground mb-1">Prediction Reliability</p>
            <div 
              className="h-4 rounded-sm mb-1"
              style={{ background: getGradientCSS('greens') }}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>High Error</span>
              <span>Low Error</span>
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground/70 mt-0.5">
              <span>Less Reliable</span>
              <span>More Reliable</span>
            </div>
          </div>
        )}

        {/* Residuals Legend (Predictor-based) */}
        {results && visibility.residuals && results.residuals && (
          <div className="absolute bottom-6 left-4 z-[1000] bg-card p-3 rounded-lg shadow-lg border border-border min-w-[180px]">
            <h4 className="text-xs font-semibold mb-2 text-foreground">Residual Map</h4>
            <p className="text-[10px] text-muted-foreground mb-1">Observed − Predicted</p>
            <div 
              className="h-4 rounded-sm mb-1"
              style={{ background: getGradientCSS('coolwarm') }}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Over-predict</span>
              <span>Under-predict</span>
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground/70 mt-0.5">
              <span>Negative</span>
              <span>Positive</span>
            </div>
          </div>
        )}

        {/* Uncertainty Legend (Predictor-based) */}
        {results && visibility.uncertainty && results.uncertainty && (
          <div className="absolute bottom-6 left-4 z-[1000] bg-card p-3 rounded-lg shadow-lg border border-border min-w-[180px]">
            <h4 className="text-xs font-semibold mb-2 text-foreground">Prediction Uncertainty</h4>
            <p className="text-[10px] text-muted-foreground mb-1">Model Confidence</p>
            <div 
              className="h-4 rounded-sm mb-1"
              style={{ background: getGradientCSS('plasma') }}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Low</span>
              <span>High</span>
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground/70 mt-0.5">
              <span>High Confidence</span>
              <span>Low Confidence</span>
            </div>
          </div>
        )}

        {/* RPE Legend */}
        {results && visibility.rpe && results.rpePolygon && (
          <div className="absolute bottom-6 left-4 z-[1000] bg-card p-3 rounded-lg shadow-lg border border-border min-w-[180px]">
            <h4 className="text-xs font-semibold mb-2 text-foreground">Reliable Prediction Extent</h4>
            <p className="text-[10px] text-muted-foreground mb-2">Prediction Reliability Zones</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-3 rounded-sm border-2"
                  style={{ backgroundColor: 'rgba(76, 175, 80, 0.3)', borderColor: '#4caf50' }}
                />
                <span className="text-[10px] text-muted-foreground">High Reliability (within RPE)</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-3 rounded-sm border-2"
                  style={{ backgroundColor: 'rgba(244, 67, 54, 0.2)', borderColor: '#f44336', borderStyle: 'dashed' }}
                />
                <span className="text-[10px] text-muted-foreground">Low Reliability (outside RPE)</span>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground/70 mt-2 italic">
              ⚠ Extrapolated zones may be unreliable
            </p>
          </div>
        )}

        {/* Basemap Selector */}
        <div className="absolute top-4 right-14 z-[1000]">
          <Select value={basemapId} onValueChange={setBasemapId}>
            <SelectTrigger className="h-8 text-xs w-[160px] bg-card border-border shadow-md">
              <Map className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Basemap" />
            </SelectTrigger>
            <SelectContent>
              {BASEMAP_OPTIONS.map((basemap) => (
                <SelectItem key={basemap.id} value={basemap.id} className="text-xs">
                  {basemap.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Coordinates display */}
        <div className="absolute top-4 left-4 z-[1000] bg-card px-3 py-2 rounded-lg shadow-md border border-border text-xs text-muted-foreground">
          <span className="font-mono">
            {dataPoints.length > 0 
              ? `${dataPoints.length} points loaded`
              : 'No data loaded'}
          </span>
        </div>
      </div>
    );
  }
);

SpatialMap.displayName = 'SpatialMap';

