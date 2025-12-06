import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, useMapEvents, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, Download, RotateCcw, RotateCw, Eye, Home, FileSpreadsheet, Layers } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import 'leaflet/dist/leaflet.css';

interface Coordinate {
  lat: number;
  lng: number;
}

interface PlottedPolygon {
  id: number;
  name: string;
  category: string;
  coordinates: Coordinate[];
  area: number;
  hectares: number;
  sqKm: number;
  excelData?: Record<string, unknown>;
}

// Calculate geodesic area
function calculateGeodesicArea(coords: Coordinate[]): number {
  if (coords.length < 3) return 0;
  const earthRadius = 6371000;
  let area = 0;

  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const lat1 = coords[i].lat * Math.PI / 180;
    const lng1 = coords[i].lng * Math.PI / 180;
    const lat2 = coords[j].lat * Math.PI / 180;
    const lng2 = coords[j].lng * Math.PI / 180;
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  return Math.abs(area * earthRadius * earthRadius / 2);
}

// Map click handler component
function MapClickHandler({ onMapClick }: { onMapClick: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    }
  });
  return null;
}

// Fit bounds component
function FitBounds({ polygons }: { polygons: PlottedPolygon[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (polygons.length > 0) {
      const allCoords = polygons.flatMap(p => p.coordinates);
      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords.map(c => [c.lat, c.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [polygons, map]);
  
  return null;
}

const ManualPlotter = () => {
  const [polygonId, setPolygonId] = useState<number>(1);
  const [polygonName, setPolygonName] = useState('');
  const [category, setCategory] = useState('residential');
  const [currentCoords, setCurrentCoords] = useState<Coordinate[]>([]);
  const [polygons, setPolygons] = useState<PlottedPolygon[]>([]);
  const [selectedPolygon, setSelectedPolygon] = useState<number | null>(null);
  const [bulkCoords, setBulkCoords] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [undoStack, setUndoStack] = useState<PlottedPolygon[][]>([]);
  const [redoStack, setRedoStack] = useState<PlottedPolygon[][]>([]);
  
  // Excel joining state
  const [excelData, setExcelData] = useState<Record<string, unknown>[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [idColumn, setIdColumn] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveState = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), [...polygons]]);
    setRedoStack([]);
  }, [polygons]);

  const handleMapClick = useCallback((latlng: L.LatLng) => {
    setCurrentCoords(prev => [...prev, { lat: latlng.lat, lng: latlng.lng }]);
  }, []);

  const addCoordinate = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng)) {
      setCurrentCoords(prev => [...prev, { lat, lng }]);
      setLatInput('');
      setLngInput('');
    } else {
      toast.error('Please enter valid coordinates');
    }
  };

  const addBulkCoordinates = () => {
    const lines = bulkCoords.split('\n').filter(l => l.trim());
    const newCoords: Coordinate[] = [];
    
    for (const line of lines) {
      const parts = line.split(',').map(p => parseFloat(p.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        newCoords.push({ lat: parts[0], lng: parts[1] });
      }
    }
    
    if (newCoords.length > 0) {
      setCurrentCoords(prev => [...prev, ...newCoords]);
      setBulkCoords('');
      toast.success(`Added ${newCoords.length} coordinates`);
    } else {
      toast.error('No valid coordinates found');
    }
  };

  const plotPolygon = () => {
    if (currentCoords.length < 3) {
      toast.error('At least 3 coordinates required');
      return;
    }

    saveState();
    
    const area = calculateGeodesicArea(currentCoords);
    const newPolygon: PlottedPolygon = {
      id: polygonId,
      name: polygonName || `Polygon ${polygonId}`,
      category,
      coordinates: [...currentCoords],
      area,
      hectares: area / 10000,
      sqKm: area / 1000000
    };

    setPolygons(prev => [...prev, newPolygon]);
    setCurrentCoords([]);
    setPolygonId(prev => prev + 1);
    setPolygonName('');
    toast.success('Polygon plotted successfully');
  };

  const deletePolygon = (id: number) => {
    saveState();
    setPolygons(prev => prev.filter(p => p.id !== id));
    if (selectedPolygon === id) setSelectedPolygon(null);
    toast.success('Polygon deleted');
  };

  const clearAll = () => {
    saveState();
    setPolygons([]);
    setCurrentCoords([]);
    setSelectedPolygon(null);
    toast.success('All polygons cleared');
  };

  const undo = () => {
    if (undoStack.length === 0) {
      toast.error('Nothing to undo');
      return;
    }
    setRedoStack(prev => [...prev, [...polygons]]);
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setPolygons(previousState);
  };

  const redo = () => {
    if (redoStack.length === 0) {
      toast.error('Nothing to redo');
      return;
    }
    setUndoStack(prev => [...prev, [...polygons]]);
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setPolygons(nextState);
  };

  // Excel handling
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
        setExcelColumns(Object.keys(jsonData[0] || {}));
        toast.success(`Loaded ${jsonData.length} rows from Excel`);
      } catch (error) {
        toast.error('Error reading Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const joinExcelData = () => {
    if (!idColumn || excelData.length === 0) {
      toast.error('Please select an ID column');
      return;
    }

    saveState();
    const updatedPolygons = polygons.map(polygon => {
      const matchingRow = excelData.find(row => String(row[idColumn]) === String(polygon.id));
      if (matchingRow) {
        return { ...polygon, excelData: matchingRow };
      }
      return polygon;
    });

    setPolygons(updatedPolygons);
    const matchCount = updatedPolygons.filter(p => p.excelData).length;
    toast.success(`Joined data for ${matchCount} polygons`);
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
    if (polygons.length === 0) {
      toast.error('No polygons to export');
      return;
    }

    let kmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    kmlContent += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
    kmlContent += '  <Document>\n';
    kmlContent += '    <name>RessComm Manual Plotter Results</name>\n';
    kmlContent += '    <Style id="polygonStyle">\n';
    kmlContent += '      <PolyStyle><color>7f52b788</color></PolyStyle>\n';
    kmlContent += '      <LineStyle><color>ff40916c</color><width>2</width></LineStyle>\n';
    kmlContent += '    </Style>\n';

    polygons.forEach(polygon => {
      const coords = polygon.coordinates.map(c => `${c.lng},${c.lat},0`);
      coords.push(coords[0]); // Close the polygon

      kmlContent += '    <Placemark>\n';
      kmlContent += `      <name>${escapeXml(polygon.name)}</name>\n`;
      kmlContent += `      <description>Area: ${polygon.area.toFixed(2)} m² | ${polygon.hectares.toFixed(4)} ha | ${polygon.sqKm.toFixed(6)} km²</description>\n`;
      kmlContent += '      <styleUrl>#polygonStyle</styleUrl>\n';
      kmlContent += '      <Polygon><outerBoundaryIs><LinearRing>\n';
      kmlContent += `        <coordinates>${coords.join(' ')}</coordinates>\n`;
      kmlContent += '      </LinearRing></outerBoundaryIs></Polygon>\n';
      kmlContent += '    </Placemark>\n';
    });

    kmlContent += '  </Document>\n</kml>';

    const zip = new JSZip();
    zip.file("doc.kml", kmlContent);
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, 'resscomm_manual_plotter.kmz');
    toast.success('KMZ exported successfully');
  };

  const exportShapefile = async () => {
    if (polygons.length === 0) {
      toast.error('No polygons to export');
      return;
    }

    const geojson = {
      type: "FeatureCollection",
      features: polygons.map(polygon => ({
        type: "Feature",
        properties: {
          id: polygon.id,
          name: polygon.name,
          category: polygon.category,
          area_m2: polygon.area,
          area_ha: polygon.hectares,
          area_sqkm: polygon.sqKm,
          ...(polygon.excelData || {})
        },
        geometry: {
          type: "Polygon",
          coordinates: [polygon.coordinates.map(c => [c.lng, c.lat])]
        }
      }))
    };

    const zip = new JSZip();
    zip.file("data.geojson", JSON.stringify(geojson, null, 2));
    zip.file("projection.prj", 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]');
    
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, 'resscomm_manual_export.zip');
    toast.success('Shapefile package exported');
  };

  const currentArea = calculateGeodesicArea(currentCoords);

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      residential: '#3498db',
      commercial: '#e74c3c',
      industrial: '#9b59b6',
      agricultural: '#27ae60',
      recreational: '#f39c12'
    };
    return colors[cat] || '#3498db';
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-forest-dark to-forest-mid text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <h1 className="text-xl font-bold">Manual Polygon Mapping</h1>
        <nav className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-sage-light hover:text-white transition-colors">
            <Home className="w-4 h-4" /> Home
          </Link>
          <Link to="/excel-plotter" className="flex items-center gap-2 text-sage-light hover:text-white transition-colors">
            <FileSpreadsheet className="w-4 h-4" /> Excel Plotter
          </Link>
          <Link to="/zulim" className="flex items-center gap-2 text-sage-light hover:text-white transition-colors">
            <Layers className="w-4 h-4" /> ZULIM
          </Link>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-[420px] bg-card overflow-y-auto p-4 space-y-4 border-r border-border">
          {/* Create Polygon Panel */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <h2 className="font-semibold text-lg border-b border-border pb-2">Create New Polygon</h2>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Polygon ID</Label>
                <Input type="number" value={polygonId} onChange={e => setPolygonId(parseInt(e.target.value) || 1)} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="agricultural">Agricultural</SelectItem>
                    <SelectItem value="recreational">Recreational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Polygon Name</Label>
              <Input value={polygonName} onChange={e => setPolygonName(e.target.value)} placeholder="Enter name" />
            </div>

            <div>
              <Label>Add Coordinate</Label>
              <div className="flex gap-2">
                <Input placeholder="Latitude" value={latInput} onChange={e => setLatInput(e.target.value)} />
                <Input placeholder="Longitude" value={lngInput} onChange={e => setLngInput(e.target.value)} />
                <Button size="icon" onClick={addCoordinate}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>

            <div>
              <Label>Bulk Coordinates (lat,lng per line)</Label>
              <Textarea 
                value={bulkCoords} 
                onChange={e => setBulkCoords(e.target.value)}
                placeholder="51.505,-0.09&#10;51.51,-0.1"
                className="font-mono text-sm"
              />
              <Button onClick={addBulkCoordinates} size="sm" className="mt-2">Add Multiple</Button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={plotPolygon} className="bg-forest-light hover:bg-forest-mid">Plot Polygon</Button>
              <Button onClick={clearAll} variant="destructive">Clear All</Button>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={undo} variant="outline" size="sm"><RotateCcw className="w-4 h-4 mr-1" /> Undo</Button>
              <Button onClick={redo} variant="outline" size="sm"><RotateCw className="w-4 h-4 mr-1" /> Redo</Button>
            </div>

            {/* Current Coordinates */}
            <div className="bg-background rounded p-3 max-h-32 overflow-y-auto font-mono text-xs">
              {currentCoords.length === 0 ? (
                <p className="text-muted-foreground">Click on map or add coordinates manually</p>
              ) : (
                currentCoords.map((c, i) => (
                  <div key={i}>{i + 1}. {c.lat.toFixed(6)}, {c.lng.toFixed(6)}</div>
                ))
              )}
            </div>

            <div className="bg-sage-light rounded p-3 font-medium text-sm">
              Area: {currentArea.toFixed(2)} m² ({(currentArea / 10000).toFixed(4)} ha)
            </div>
          </div>

          {/* Plotted Polygons */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h2 className="font-semibold text-lg border-b border-border pb-2 mb-3">Plotted Polygons ({polygons.length})</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {polygons.map(p => (
                <div 
                  key={p.id} 
                  className={`bg-background rounded p-3 cursor-pointer transition-all border-l-4 ${selectedPolygon === p.id ? 'ring-2 ring-forest-light' : ''}`}
                  style={{ borderLeftColor: getCategoryColor(p.category) }}
                  onClick={() => setSelectedPolygon(p.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.hectares.toFixed(4)} ha • {p.coordinates.length} pts</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7"><Eye className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deletePolygon(p.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Excel Data Integration */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-lg border-b border-border pb-2">Excel Data Integration</h2>
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".xlsx,.xls" 
              onChange={handleExcelUpload}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full">
              Upload Excel File
            </Button>
            
            {excelColumns.length > 0 && (
              <>
                <div>
                  <Label>Select ID Column for Joining</Label>
                  <Select value={idColumn} onValueChange={setIdColumn}>
                    <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                    <SelectContent>
                      {excelColumns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={joinExcelData} className="w-full bg-forest-light hover:bg-forest-mid">Join Data</Button>
                <p className="text-xs text-muted-foreground">Loaded {excelData.length} rows • {excelColumns.length} columns</p>
              </>
            )}
          </div>

          {/* Export Options */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-lg border-b border-border pb-2">Export Options</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={exportKMZ} variant="outline">
                <Download className="w-4 h-4 mr-2" /> KMZ
              </Button>
              <Button onClick={exportShapefile} variant="outline">
                <Download className="w-4 h-4 mr-2" /> Shapefile
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-info/10 rounded-lg p-4 text-sm">
            <h3 className="font-semibold mb-2">How to Use:</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Enter polygon details and add coordinates manually or click on the map</li>
              <li>Click "Plot Polygon" to create the shape</li>
              <li>Select any polygon from the list to highlight or delete it</li>
              <li>Upload Excel file and join data using polygon IDs</li>
              <li>Export all polygons with joined data as KMZ or Shapefile</li>
            </ul>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1">
          <MapContainer center={[9.06, 7.49]} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} />
            <FitBounds polygons={polygons} />
            
            {/* Current drawing points */}
            {currentCoords.map((coord, i) => (
              <Marker 
                key={`current-${i}`} 
                position={[coord.lat, coord.lng]}
                icon={L.divIcon({ className: 'bg-forest-light w-3 h-3 rounded-full border-2 border-white', iconSize: [12, 12] })}
              />
            ))}
            
            {/* Current polygon preview */}
            {currentCoords.length >= 3 && (
              <Polygon 
                positions={currentCoords.map(c => [c.lat, c.lng] as [number, number])}
                pathOptions={{ color: '#f39c12', fillOpacity: 0.3, dashArray: '5,5' }}
              />
            )}
            
            {/* Plotted polygons */}
            {polygons.map(polygon => (
              <Polygon
                key={polygon.id}
                positions={polygon.coordinates.map(c => [c.lat, c.lng] as [number, number])}
                pathOptions={{ 
                  color: getCategoryColor(polygon.category),
                  fillOpacity: selectedPolygon === polygon.id ? 0.6 : 0.4,
                  weight: selectedPolygon === polygon.id ? 3 : 2
                }}
              >
                <Popup>
                  <strong>{polygon.name}</strong><br/>
                  Category: {polygon.category}<br/>
                  Area: {polygon.area.toFixed(2)} m²<br/>
                  Hectares: {polygon.hectares.toFixed(4)} ha<br/>
                  Points: {polygon.coordinates.length}
                </Popup>
              </Polygon>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default ManualPlotter;
