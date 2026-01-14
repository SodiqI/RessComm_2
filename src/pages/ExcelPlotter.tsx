import { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, Polyline, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Plus, Trash2, Download, RotateCcw, RotateCw, Upload, Home, MousePointer, Layers, FileText } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { exportMultiplePolygonsPdf, LAND_USE_CATEGORIES, type AreaUnit, type PolygonData } from '@/utils/polygonPdfExport';
import { eastingNorthingToLatLng, isProjectedCoordinate } from '@/utils/coordinateUtils';
import { BasemapSelector } from '@/components/BasemapSelector';
import { getBasemapById, DEFAULT_BASEMAP } from '@/utils/basemapConfig';
import 'leaflet/dist/leaflet.css';

type CoordType = 'latLng' | 'eastingNorthing';

interface PointConfig {
  id: number;
  latColumn: string;
  lngColumn: string;
}

interface PlottedArea {
  id: number;
  type: 'area' | 'distance';
  points: [number, number][];
  area?: number;
  hectares?: number;
  sqKm?: number;
  totalDistance?: number;
  distances?: number[];
  attributes: Record<string, unknown>;
}

// Calculate geodesic area
function calculateGeodesicArea(points: [number, number][]): number {
  if (points.length < 3) return 0;
  const earthRadius = 6371000;
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const lat1 = points[i][0] * Math.PI / 180;
    const lng1 = points[i][1] * Math.PI / 180;
    const lat2 = points[j][0] * Math.PI / 180;
    const lng2 = points[j][1] * Math.PI / 180;
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  return Math.abs(area * earthRadius * earthRadius / 2);
}

// Calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Fit bounds component
function FitBounds({ areas }: { areas: PlottedArea[] }) {
  const map = useMap();

  useEffect(() => {
    if (areas.length > 0) {
      const allPoints = areas.flatMap(a => a.points);
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints.map(p => [p[0], p[1]]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [areas, map]);

  return null;
}

const ExcelPlotter = () => {
  const [excelData, setExcelData] = useState<Record<string, unknown>[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [coordType, setCoordType] = useState<CoordType>('latLng');
  const [pointConfigs, setPointConfigs] = useState<PointConfig[]>([
    { id: 1, latColumn: '', lngColumn: '' },
    { id: 2, latColumn: '', lngColumn: '' }
  ]);
  const [plotType, setPlotType] = useState<'area' | 'distance'>('area');
  const [plottedAreas, setPlottedAreas] = useState<PlottedArea[]>([]);
  const [undoStack, setUndoStack] = useState<PlottedArea[][]>([]);
  const [redoStack, setRedoStack] = useState<PlottedArea[][]>([]);
  const [fileStatus, setFileStatus] = useState<string>('No file uploaded yet');
  const [plotStatus, setPlotStatus] = useState<string>('Ready to plot');
  
  // Basemap state
  const [basemapId, setBasemapId] = useState(DEFAULT_BASEMAP);
  const currentBasemap = getBasemapById(basemapId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLElement | null>(null);

  const saveState = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), [...plottedAreas]]);
    setRedoStack([]);
  }, [plottedAreas]);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        setExcelData(jsonData);
        const columns = Object.keys(jsonData[0] || {});
        setExcelColumns(columns);

        setFileStatus(`File loaded successfully!\nRows: ${jsonData.length}\nColumns: ${columns.length}\nAvailable: ${columns.join(', ')}`);
        toast.success(`Loaded ${jsonData.length} rows from Excel`);
      } catch (error) {
        toast.error('Error reading Excel file');
        setFileStatus('Error loading file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const addPoint = () => {
    setPointConfigs(prev => [...prev, { id: prev.length + 1, latColumn: '', lngColumn: '' }]);
  };

  const removeLastPoint = () => {
    if (pointConfigs.length > 2) {
      setPointConfigs(prev => prev.slice(0, -1));
    } else {
      toast.error('Minimum 2 points required');
    }
  };

  const updatePointConfig = (index: number, field: 'latColumn' | 'lngColumn', value: string) => {
    setPointConfigs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const plotData = () => {
    const isValid = pointConfigs.every(config => config.latColumn && config.lngColumn);
    if (!isValid) {
      toast.error('Please select latitude and longitude columns for all points');
      return;
    }

    saveState();
    let plotCount = 0;
    let skippedCount = 0;
    const newAreas: PlottedArea[] = [];

    excelData.forEach((row, rowIndex) => {
      const points: [number, number][] = [];

      pointConfigs.forEach(config => {
        const rawX = parseFloat(String(row[config.lngColumn]));
        const rawY = parseFloat(String(row[config.latColumn]));

        if (!isNaN(rawX) && !isNaN(rawY) && rawX !== 0 && rawY !== 0) {
          if (coordType === 'eastingNorthing') {
            const { lat, lng } = eastingNorthingToLatLng(rawX, rawY);
            points.push([lat, lng]);
          } else {
            points.push([rawY, rawX]);
          }
        }
      });

      if (plotType === 'area' && points.length >= 3) {
        const area = calculateGeodesicArea(points);
        newAreas.push({
          id: rowIndex + 1,
          type: 'area',
          points,
          area,
          hectares: area / 10000,
          sqKm: area / 1000000,
          attributes: row
        });
        plotCount++;
      } else if (plotType === 'distance' && points.length >= 2) {
        let totalDistance = 0;
        const distances: number[] = [];

        for (let i = 0; i < points.length - 1; i++) {
          const dist = calculateDistance(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
          distances.push(dist);
          totalDistance += dist;
        }

        newAreas.push({
          id: rowIndex + 1,
          type: 'distance',
          points,
          totalDistance,
          distances,
          attributes: row
        });
        plotCount++;
      } else {
        skippedCount++;
      }
    });

    setPlottedAreas(prev => [...prev, ...newAreas]);
    setPlotStatus(`Plotted: ${plotCount} rows\nSkipped: ${skippedCount} rows\nTotal: ${plottedAreas.length + newAreas.length}`);
    toast.success(`Plotted ${plotCount} ${plotType === 'area' ? 'areas' : 'distances'}`);
  };

  const clearAll = () => {
    saveState();
    setPlottedAreas([]);
    setPlotStatus('All data cleared');
    toast.success('All data cleared');
  };

  const undo = () => {
    if (undoStack.length === 0) {
      toast.error('Nothing to undo');
      return;
    }
    setRedoStack(prev => [...prev, [...plottedAreas]]);
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setPlottedAreas(previousState);
  };

  const redo = () => {
    if (redoStack.length === 0) {
      toast.error('Nothing to redo');
      return;
    }
    setUndoStack(prev => [...prev, [...plottedAreas]]);
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setPlottedAreas(nextState);
  };

  // Export functions
  const escapeXml = (unsafe: unknown): string => {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  const exportKMZ = async () => {
    if (plottedAreas.length === 0) {
      toast.error('No data to export');
      return;
    }

    let kmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    kmlContent += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
    kmlContent += '  <Document>\n';
    kmlContent += '    <name>RessComm Excel Plotter Results</name>\n';
    kmlContent += '    <Style id="areaStyle"><PolyStyle><color>7f52b788</color></PolyStyle><LineStyle><color>ff40916c</color><width>2</width></LineStyle></Style>\n';
    kmlContent += '    <Style id="distanceStyle"><LineStyle><color>ffe74c3c</color><width>3</width></LineStyle></Style>\n';

    plottedAreas.forEach(item => {
      if (item.type === 'area') {
        const coords = item.points.map(p => `${p[1]},${p[0]},0`);
        coords.push(coords[0]);

        kmlContent += '    <Placemark>\n';
        kmlContent += `      <name>Area ${item.id}</name>\n`;
        kmlContent += `      <description>Area: ${item.area?.toFixed(2)} m² | ${item.hectares?.toFixed(4)} ha</description>\n`;
        kmlContent += '      <styleUrl>#areaStyle</styleUrl>\n';
        kmlContent += '      <Polygon><outerBoundaryIs><LinearRing>\n';
        kmlContent += `        <coordinates>${coords.join(' ')}</coordinates>\n`;
        kmlContent += '      </LinearRing></outerBoundaryIs></Polygon>\n';
        kmlContent += '    </Placemark>\n';
      } else {
        const coords = item.points.map(p => `${p[1]},${p[0]},0`);
        kmlContent += '    <Placemark>\n';
        kmlContent += `      <name>Distance ${item.id}</name>\n`;
        kmlContent += `      <description>Total: ${((item.totalDistance || 0) / 1000).toFixed(3)} km</description>\n`;
        kmlContent += '      <styleUrl>#distanceStyle</styleUrl>\n';
        kmlContent += '      <LineString>\n';
        kmlContent += `        <coordinates>${coords.join(' ')}</coordinates>\n`;
        kmlContent += '      </LineString>\n';
        kmlContent += '    </Placemark>\n';
      }
    });

    kmlContent += '  </Document>\n</kml>';

    const zip = new JSZip();
    zip.file("doc.kml", kmlContent);
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, 'resscomm_excel_results.kmz');
    toast.success('KMZ exported');
  };

  const exportShapefile = async () => {
    if (plottedAreas.length === 0) {
      toast.error('No data to export');
      return;
    }

    const geojson = {
      type: "FeatureCollection",
      features: plottedAreas.map(item => ({
        type: "Feature",
        properties: {
          id: item.id,
          type: item.type,
          ...(item.type === 'area' ? { area_m2: item.area, area_ha: item.hectares, area_sqkm: item.sqKm } : {}),
          ...(item.type === 'distance' ? { total_dist_m: item.totalDistance, total_dist_km: (item.totalDistance || 0) / 1000 } : {}),
          points_count: item.points.length,
          ...item.attributes
        },
        geometry: item.type === 'area' ? {
          type: "Polygon",
          coordinates: [item.points.map(p => [p[1], p[0]])]
        } : {
          type: "LineString",
          coordinates: item.points.map(p => [p[1], p[0]])
        }
      }))
    };

    const zip = new JSZip();
    zip.file("data.geojson", JSON.stringify(geojson, null, 2));
    zip.file("projection.prj", 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]');

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, 'resscomm_excel_export.zip');
    toast.success('Shapefile package exported');
  };

  const exportJSON = () => {
    if (plottedAreas.length === 0) {
      toast.error('No data to export');
      return;
    }

    const blob = new Blob([JSON.stringify(plottedAreas, null, 2)], { type: 'application/json' });
    saveAs(blob, 'resscomm_excel_data.json');
    toast.success('JSON exported');
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-forest-dark to-forest-mid text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <h1 className="text-xl font-bold">Excel Plotter - Land Area Analysis</h1>
        <nav className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-sage-light hover:text-white transition-colors">
            <Home className="w-4 h-4" /> Home
          </Link>
          <Link to="/manual-plotter" className="flex items-center gap-2 text-sage-light hover:text-white transition-colors">
            <MousePointer className="w-4 h-4" /> Manual Plotter
          </Link>
          <Link to="/zulim" className="flex items-center gap-2 text-sage-light hover:text-white transition-colors">
            <Layers className="w-4 h-4" /> ZULIM
          </Link>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-[450px] bg-card overflow-y-auto p-4 space-y-4 border-r border-border">
          {/* Upload Panel */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-lg border-b border-border pb-2">1. Upload Excel File</h2>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full">
              <Upload className="w-4 h-4 mr-2" /> Select Excel File
            </Button>
            <div className="bg-background rounded p-3 text-xs whitespace-pre-wrap max-h-24 overflow-y-auto">
              {fileStatus}
            </div>
          </div>

          {/* Coordinate Type Selection */}
          <div className={`bg-muted/50 rounded-lg p-4 space-y-3 ${excelData.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
            <h2 className="font-semibold text-lg border-b border-border pb-2">2. Coordinate System</h2>
            <RadioGroup value={coordType} onValueChange={(v) => setCoordType(v as CoordType)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="latLng" id="latLng" />
                <Label htmlFor="latLng">Latitude / Longitude (WGS84)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="eastingNorthing" id="eastingNorthing" />
                <Label htmlFor="eastingNorthing">Easting / Northing (UTM)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Plot Type */}
          <div className={`bg-muted/50 rounded-lg p-4 space-y-3 ${excelData.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
            <h2 className="font-semibold text-lg border-b border-border pb-2">3. Configure Plot Type</h2>
            <RadioGroup value={plotType} onValueChange={(v) => setPlotType(v as 'area' | 'distance')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="area" id="area" />
                <Label htmlFor="area">Plot Areas</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="distance" id="distance" />
                <Label htmlFor="distance">Calculate Distances</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Points Configuration */}
          <div className={`bg-muted/50 rounded-lg p-4 space-y-3 ${excelData.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
            <h2 className="font-semibold text-lg border-b border-border pb-2">4. Configure Points</h2>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {pointConfigs.map((config, index) => (
                <div key={config.id} className="bg-background rounded p-3 space-y-2">
                  <p className="font-medium text-sm">Point {config.id}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">{coordType === 'eastingNorthing' ? 'Northing Column' : 'Latitude Column'}</Label>
                      <Select value={config.latColumn} onValueChange={(v) => updatePointConfig(index, 'latColumn', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {excelColumns.map(col => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{coordType === 'eastingNorthing' ? 'Easting Column' : 'Longitude Column'}</Label>
                      <Select value={config.lngColumn} onValueChange={(v) => updatePointConfig(index, 'lngColumn', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {excelColumns.map(col => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={addPoint} size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" /> Add Point</Button>
              <Button onClick={removeLastPoint} size="sm" variant="outline"><Trash2 className="w-4 h-4 mr-1" /> Remove</Button>
            </div>
          </div>

          {/* Plot Controls */}
          <div className={`bg-muted/50 rounded-lg p-4 space-y-3 ${excelData.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
            <h2 className="font-semibold text-lg border-b border-border pb-2">5. Plot Data</h2>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={plotData} className="bg-forest-light hover:bg-forest-mid">Plot All</Button>
              <Button onClick={clearAll} variant="destructive">Clear All</Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={undo} variant="outline" size="sm"><RotateCcw className="w-4 h-4 mr-1" /> Undo</Button>
              <Button onClick={redo} variant="outline" size="sm"><RotateCw className="w-4 h-4 mr-1" /> Redo</Button>
            </div>
            <div className="bg-background rounded p-3 text-xs whitespace-pre-wrap">
              {plotStatus}
            </div>
          </div>

          {/* Plotted Areas List */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h2 className="font-semibold text-lg border-b border-border pb-2 mb-3">Plotted Areas ({plottedAreas.length})</h2>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {plottedAreas.slice(0, 20).map(area => (
                <div key={area.id} className="bg-background rounded p-2 text-xs border-l-4" style={{ borderLeftColor: area.type === 'area' ? '#3498db' : '#e74c3c' }}>
                  <strong>{area.type === 'area' ? 'Area' : 'Distance'} {area.id}</strong>
                  <br />
                  {area.type === 'area' ? (
                    <span>{area.points.length} pts, {area.hectares?.toFixed(4)} ha</span>
                  ) : (
                    <span>{area.points.length} pts, {((area.totalDistance || 0) / 1000).toFixed(3)} km</span>
                  )}
                </div>
              ))}
              {plottedAreas.length > 20 && (
                <p className="text-xs text-muted-foreground">...and {plottedAreas.length - 20} more</p>
              )}
            </div>
          </div>

          {/* Export Section */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-lg border-b border-border pb-2">Export Data</h2>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={exportKMZ} variant="outline" size="sm"><Download className="w-4 h-4 mr-1" /> KMZ</Button>
              <Button onClick={exportShapefile} variant="outline" size="sm"><Download className="w-4 h-4 mr-1" /> SHP</Button>
              <Button onClick={exportJSON} variant="outline" size="sm"><Download className="w-4 h-4 mr-1" /> JSON</Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={plottedAreas.filter(a => a.type === 'area').length === 0}
                onClick={async () => {
                  const areas = plottedAreas.filter(a => a.type === 'area');
                  if (areas.length === 0) {
                    toast.error('No areas to export');
                    return;
                  }
                  const polygonData: PolygonData[] = areas.map(a => ({
                    id: a.id,
                    name: `Area ${a.id}`,
                    landUse: 'agricultural',
                    coordinates: a.points.map(p => ({ lat: p[0], lng: p[1] })),
                    area: a.area || 0,
                    hectares: a.hectares || 0,
                    sqKm: a.sqKm || 0,
                  }));
                  await exportMultiplePolygonsPdf(polygonData, { 
                    areaUnit: 'hectares', 
                    polygons: polygonData, 
                    dataSource: 'Excel Upload',
                    mapElement: mapRef.current,
                    basemapId: basemapId,
                  });
                  toast.success('PDF exported');
                }}
              >
                <FileText className="w-4 h-4 mr-1" /> PDF
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-info/10 rounded-lg p-4 text-sm">
            <h3 className="font-semibold mb-2">How to Use:</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
              <li>Upload an Excel file with coordinate data</li>
              <li>Choose between plotting areas or calculating distances</li>
              <li>Configure points by selecting latitude/longitude columns</li>
              <li>The system handles varying numbers of points per row</li>
              <li>Empty cells are automatically ignored</li>
              <li>Export results as KMZ, Shapefile, or JSON</li>
            </ul>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <div className="absolute top-3 right-3 z-[1000] pdf-hide">
            <BasemapSelector value={basemapId} onChange={setBasemapId} compact />
          </div>
          <MapContainer center={[9.06, 7.49]} zoom={6} style={{ height: '100%', width: '100%' }} ref={(el) => { if (el) mapRef.current = el.getContainer(); }}>
            <TileLayer
              key={basemapId}
              attribution={currentBasemap.attribution}
              url={currentBasemap.url}
              maxZoom={currentBasemap.maxZoom}
            />
            <FitBounds areas={plottedAreas} />

            {plottedAreas.map(area => (
              area.type === 'area' ? (
                <Polygon
                  key={`area-${area.id}`}
                  positions={area.points.map(p => [p[0], p[1]] as [number, number])}
                  pathOptions={{ color: '#3498db', fillOpacity: 0.5, weight: 2 }}
                >
                  <Popup>
                    <strong>Area {area.id}</strong><br />
                    Points: {area.points.length}<br />
                    Area: {area.area?.toFixed(2)} m²<br />
                    Hectares: {area.hectares?.toFixed(4)} ha<br />
                    Sq Km: {area.sqKm?.toFixed(6)} km²
                  </Popup>
                </Polygon>
              ) : (
                <Polyline
                  key={`dist-${area.id}`}
                  positions={area.points.map(p => [p[0], p[1]] as [number, number])}
                  pathOptions={{ color: '#e74c3c', weight: 3 }}
                >
                  <Popup>
                    <strong>Distance {area.id}</strong><br />
                    Points: {area.points.length}<br />
                    Total: {((area.totalDistance || 0) / 1000).toFixed(3)} km
                  </Popup>
                </Polyline>
              )
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default ExcelPlotter;
