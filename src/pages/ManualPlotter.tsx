import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, useMapEvents, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Download, RotateCcw, RotateCw, Eye, Home, FileSpreadsheet, Layers, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import JSZip from 'jszip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { exportPolygonPdf, exportMultiplePolygonsPdf, LAND_USE_CATEGORIES, type AreaUnit, type PolygonData, type PdfOrientation, type PdfExportResult } from '@/utils/polygonPdfExport';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { eastingNorthingToLatLng } from '@/utils/coordinateUtils';
import { BasemapSelector } from '@/components/BasemapSelector';
import { getBasemapById, DEFAULT_BASEMAP } from '@/utils/basemapConfig';
import 'leaflet/dist/leaflet.css';

type CoordType = 'latLng' | 'eastingNorthing';
type InputMode = 'single' | 'bulk';

interface ParsedCoordinate {
  lat: number;
  lng: number;
  lineNumber: number;
  original: string;
}

interface ParseError {
  lineNumber: number;
  line: string;
  reason: string;
}

interface BulkParseResult {
  valid: ParsedCoordinate[];
  errors: ParseError[];
}

// Parse bulk coordinates with multiple format support
function parseBulkCoordinates(
  input: string, 
  coordType: CoordType
): BulkParseResult {
  const lines = input.split('\n');
  const valid: ParsedCoordinate[] = [];
  const errors: ParseError[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Try different delimiters: comma, space, tab
    let parts: string[] = [];
    if (line.includes(',')) {
      parts = line.split(',').map(p => p.trim());
    } else if (line.includes('\t')) {
      parts = line.split('\t').map(p => p.trim());
    } else {
      parts = line.split(/\s+/).map(p => p.trim());
    }
    
    // Filter out empty parts
    parts = parts.filter(p => p !== '');
    
    if (parts.length < 2) {
      errors.push({
        lineNumber,
        line,
        reason: 'Expected 2 values (lat/lng or easting/northing)'
      });
      continue;
    }
    
    const val1 = parseFloat(parts[0]);
    const val2 = parseFloat(parts[1]);
    
    if (isNaN(val1) || isNaN(val2)) {
      errors.push({
        lineNumber,
        line,
        reason: 'Invalid number format'
      });
      continue;
    }
    
    let lat: number;
    let lng: number;
    
    if (coordType === 'eastingNorthing') {
      // Format: easting, northing
      const converted = eastingNorthingToLatLng(val1, val2);
      lat = converted.lat;
      lng = converted.lng;
    } else {
      // Format: lat, lng
      lat = val1;
      lng = val2;
    }
    
    // Validate lat/lng bounds
    if (lat < -90 || lat > 90) {
      errors.push({
        lineNumber,
        line,
        reason: `Latitude ${lat.toFixed(4)} out of range [-90, 90]`
      });
      continue;
    }
    
    if (lng < -180 || lng > 180) {
      errors.push({
        lineNumber,
        line,
        reason: `Longitude ${lng.toFixed(4)} out of range [-180, 180]`
      });
      continue;
    }
    
    valid.push({ lat, lng, lineNumber, original: line });
  }
  
  return { valid, errors };
}

interface Coordinate {
  lat: number;
  lng: number;
}

interface PlottedPolygon {
  id: number;
  name: string;
  category: string;
  landUse: string;
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
  const [landUse, setLandUse] = useState('agricultural');
  const [coordType, setCoordType] = useState<CoordType>('latLng');
  const [inputMode, setInputMode] = useState<InputMode>('single');
  const [currentCoords, setCurrentCoords] = useState<Coordinate[]>([]);
  const [polygons, setPolygons] = useState<PlottedPolygon[]>([]);
  const [selectedPolygon, setSelectedPolygon] = useState<number | null>(null);
  const [bulkCoords, setBulkCoords] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [undoStack, setUndoStack] = useState<PlottedPolygon[][]>([]);
  const [redoStack, setRedoStack] = useState<PlottedPolygon[][]>([]);
  const [lastBulkResult, setLastBulkResult] = useState<BulkParseResult | null>(null);
  
  // Excel joining state
  const [excelData, setExcelData] = useState<Record<string, unknown>[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [idColumn, setIdColumn] = useState('');
  
  // PDF Export state
  const [pdfExportOpen, setPdfExportOpen] = useState(false);
  const [pdfAreaUnit, setPdfAreaUnit] = useState<AreaUnit>('hectares');
  const [pdfExportType, setPdfExportType] = useState<'single' | 'all'>('single');
  const [pdfSelectedPolygon, setPdfSelectedPolygon] = useState<number | null>(null);
  const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>('auto');
  const [pdfIncludeBasemap, setPdfIncludeBasemap] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // Basemap state
  const [basemapId, setBasemapId] = useState(DEFAULT_BASEMAP);
  const currentBasemap = getBasemapById(basemapId);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLElement | null>(null);
  
  // Preview bulk parsing result (debounced effect via useMemo)
  const bulkPreview = useMemo(() => {
    if (!bulkCoords.trim()) return null;
    return parseBulkCoordinates(bulkCoords, coordType);
  }, [bulkCoords, coordType]);

  const saveState = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), [...polygons]]);
    setRedoStack([]);
  }, [polygons]);

  const handleMapClick = useCallback((latlng: L.LatLng) => {
    setCurrentCoords(prev => [...prev, { lat: latlng.lat, lng: latlng.lng }]);
  }, []);

  const addCoordinate = () => {
    const rawX = parseFloat(lngInput);
    const rawY = parseFloat(latInput);
    if (!isNaN(rawX) && !isNaN(rawY)) {
      if (coordType === 'eastingNorthing') {
        const { lat, lng } = eastingNorthingToLatLng(rawX, rawY);
        setCurrentCoords(prev => [...prev, { lat, lng }]);
      } else {
        setCurrentCoords(prev => [...prev, { lat: rawY, lng: rawX }]);
      }
      setLatInput('');
      setLngInput('');
    } else {
      toast.error('Please enter valid coordinates');
    }
  };

  const addBulkCoordinates = useCallback(() => {
    if (!bulkCoords.trim()) {
      toast.error('Please enter coordinates');
      return;
    }

    const result = parseBulkCoordinates(bulkCoords, coordType);
    setLastBulkResult(result);
    
    if (result.valid.length === 0) {
      toast.error(`No valid coordinates found. ${result.errors.length} errors.`);
      return;
    }
    
    const newCoords: Coordinate[] = result.valid.map(c => ({ lat: c.lat, lng: c.lng }));
    setCurrentCoords(prev => [...prev, ...newCoords]);
    setBulkCoords('');
    
    if (result.errors.length > 0) {
      toast.warning(
        `Added ${result.valid.length} coordinates. ${result.errors.length} rows skipped.`
      );
    } else {
      toast.success(`Added ${result.valid.length} coordinates successfully`);
    }
  }, [bulkCoords, coordType]);

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
      landUse,
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

  // PDF Export handler
  const handlePdfExport = async () => {
    if (pdfExportType === 'single') {
      const polygon = polygons.find(p => p.id === pdfSelectedPolygon);
      if (!polygon) {
        toast.error('Please select a polygon to export');
        return;
      }
      
      setIsExporting(true);
      try {
        const polygonData: PolygonData = {
          id: polygon.id,
          name: polygon.name,
          landUse: polygon.landUse,
          coordinates: polygon.coordinates,
          area: polygon.area,
          hectares: polygon.hectares,
          sqKm: polygon.sqKm,
        };
        
        const result: PdfExportResult = await exportPolygonPdf(polygonData, {
          areaUnit: pdfAreaUnit,
          polygons: [polygonData],
          dataSource: 'Manual Plotter',
          mapElement: mapRef.current,
          orientation: pdfOrientation,
          basemapId: basemapId,
          includeBasemap: pdfIncludeBasemap,
        });
        
        if (result.basemapCaptured) {
          toast.success(result.message);
        } else if (pdfIncludeBasemap) {
          toast.warning('PDF exported. ' + result.message);
        } else {
          toast.success('PDF exported successfully (basemap excluded)');
        }
        setPdfExportOpen(false);
      } catch (error) {
        toast.error('Failed to export PDF');
        console.error(error);
      } finally {
        setIsExporting(false);
      }
    } else {
      if (polygons.length === 0) {
        toast.error('No polygons to export');
        return;
      }
      
      setIsExporting(true);
      try {
        const polygonDataList: PolygonData[] = polygons.map(p => ({
          id: p.id,
          name: p.name,
          landUse: p.landUse,
          coordinates: p.coordinates,
          area: p.area,
          hectares: p.hectares,
          sqKm: p.sqKm,
        }));
        
        await exportMultiplePolygonsPdf(polygonDataList, {
          areaUnit: pdfAreaUnit,
          polygons: polygonDataList,
          dataSource: 'Manual Plotter',
          orientation: pdfOrientation,
          basemapId: basemapId,
          includeBasemap: pdfIncludeBasemap,
        });
        
        toast.success('PDF report exported successfully');
        setPdfExportOpen(false);
      } catch (error) {
        toast.error('Failed to export PDF');
        console.error(error);
      } finally {
        setIsExporting(false);
      }
    }
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
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Polygon Name</Label>
                <Input value={polygonName} onChange={e => setPolygonName(e.target.value)} placeholder="Enter name" />
              </div>
              <div>
                <Label>Land Use Purpose</Label>
                <Select value={landUse} onValueChange={setLandUse}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LAND_USE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Coordinate System Selection */}
            <div className="bg-background/50 rounded-lg p-3">
              <Label className="text-sm font-medium">Coordinate System</Label>
              <RadioGroup 
                value={coordType} 
                onValueChange={(v) => setCoordType(v as CoordType)} 
                className="mt-2 flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="latLng" id="manual-latLng" />
                  <Label htmlFor="manual-latLng" className="text-sm font-normal cursor-pointer">Lat/Lng (WGS84)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="eastingNorthing" id="manual-eastingNorthing" />
                  <Label htmlFor="manual-eastingNorthing" className="text-sm font-normal cursor-pointer">Easting/Northing (UTM)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Input Mode Tabs */}
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as InputMode)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">Single Point</TabsTrigger>
                <TabsTrigger value="bulk">Bulk Input</TabsTrigger>
              </TabsList>
              
              <TabsContent value="single" className="space-y-3 mt-3">
                <div>
                  <Label>Add Single Coordinate</Label>
                  <div className="flex gap-2 mt-1">
                    <Input 
                      placeholder={coordType === 'eastingNorthing' ? 'Northing' : 'Latitude'} 
                      value={latInput} 
                      onChange={e => setLatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCoordinate()}
                    />
                    <Input 
                      placeholder={coordType === 'eastingNorthing' ? 'Easting' : 'Longitude'} 
                      value={lngInput} 
                      onChange={e => setLngInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCoordinate()}
                    />
                    <Button size="icon" onClick={addCoordinate}><Plus className="w-4 h-4" /></Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Or click directly on the map to add points
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="bulk" className="space-y-3 mt-3">
                <div>
                  <Label>Paste Multiple Coordinates</Label>
                  <Textarea 
                    value={bulkCoords} 
                    onChange={e => setBulkCoords(e.target.value)}
                    placeholder={
                      coordType === 'eastingNorthing' 
                        ? '500000, 6000000\n500100 6000100\n500200,6000200' 
                        : '7.4321, 3.9123\n7.4410 3.9201\n7.4502,3.9350'
                    }
                    className="font-mono text-sm h-28"
                  />
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <p>Supported formats: <code>lat, lng</code> • <code>lat lng</code> • <code>lat,lng</code></p>
                    <p>One coordinate pair per line</p>
                  </div>
                </div>
                
                {/* Bulk Preview & Validation */}
                {bulkPreview && (
                  <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Parse Preview</span>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>{bulkPreview.valid.length} valid</span>
                      </div>
                      {bulkPreview.errors.length > 0 && (
                        <div className="flex items-center gap-1.5 text-amber-600">
                          <AlertCircle className="w-4 h-4" />
                          <span>{bulkPreview.errors.length} errors</span>
                        </div>
                      )}
                    </div>
                    
                    {bulkPreview.errors.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded p-2 text-xs max-h-24 overflow-y-auto">
                        <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">Errors (will be skipped):</p>
                        {bulkPreview.errors.slice(0, 5).map((err, i) => (
                          <div key={i} className="text-amber-600 dark:text-amber-500">
                            Line {err.lineNumber}: {err.reason}
                          </div>
                        ))}
                        {bulkPreview.errors.length > 5 && (
                          <div className="text-amber-500">...and {bulkPreview.errors.length - 5} more</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                <Button 
                  onClick={addBulkCoordinates} 
                  className="w-full bg-forest-light hover:bg-forest-mid"
                  disabled={!bulkPreview || bulkPreview.valid.length === 0}
                >
                  Add {bulkPreview?.valid.length || 0} Coordinates
                </Button>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={plotPolygon} className="bg-forest-light hover:bg-forest-mid" disabled={currentCoords.length < 3}>
                Plot Polygon ({currentCoords.length} pts)
              </Button>
              <Button onClick={() => setCurrentCoords([])} variant="outline" disabled={currentCoords.length === 0}>
                Clear Points
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={undo} variant="outline" size="sm"><RotateCcw className="w-4 h-4 mr-1" /> Undo</Button>
              <Button onClick={redo} variant="outline" size="sm"><RotateCw className="w-4 h-4 mr-1" /> Redo</Button>
              <Button onClick={clearAll} variant="destructive" size="sm" className="ml-auto">Clear All</Button>
            </div>

            {/* Current Coordinates */}
            <div className="bg-background rounded p-3 max-h-40 overflow-y-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Current Points ({currentCoords.length})</span>
              </div>
              {currentCoords.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {inputMode === 'single' ? 'Click on map or enter coordinates above' : 'Paste coordinates above and click Add'}
                </p>
              ) : (
                <div className="font-mono text-xs space-y-0.5">
                  {currentCoords.map((c, i) => (
                    <div key={i} className="flex justify-between items-center hover:bg-muted/50 rounded px-1">
                      <span>{i + 1}. {c.lat.toFixed(6)}, {c.lng.toFixed(6)}</span>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => setCurrentCoords(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
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
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={exportKMZ} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" /> KMZ
              </Button>
              <Button onClick={exportShapefile} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" /> SHP
              </Button>
              <Dialog open={pdfExportOpen} onOpenChange={setPdfExportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={polygons.length === 0}>
                    <FileText className="w-4 h-4 mr-1" /> PDF
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Export PDF Report</DialogTitle>
                    <DialogDescription>Generate a detailed polygon analysis report</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Export Type</Label>
                      <RadioGroup value={pdfExportType} onValueChange={(v) => setPdfExportType(v as 'single' | 'all')} className="mt-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="single" id="pdf-single" />
                          <Label htmlFor="pdf-single">Single Polygon</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="all" id="pdf-all" />
                          <Label htmlFor="pdf-all">All Polygons Summary</Label>
                        </div>
                      </RadioGroup>
                    </div>
                    {pdfExportType === 'single' && (
                      <div>
                        <Label>Select Polygon</Label>
                        <Select value={pdfSelectedPolygon?.toString() || ''} onValueChange={(v) => setPdfSelectedPolygon(parseInt(v))}>
                          <SelectTrigger><SelectValue placeholder="Choose polygon" /></SelectTrigger>
                          <SelectContent>
                            {polygons.map(p => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label>Area Unit</Label>
                      <Select value={pdfAreaUnit} onValueChange={(v) => setPdfAreaUnit(v as AreaUnit)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hectares">Hectares (ha)</SelectItem>
                          <SelectItem value="acres">Acres</SelectItem>
                          <SelectItem value="sqMeters">Square Meters (m²)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Page Orientation</Label>
                      <Select value={pdfOrientation} onValueChange={(v) => setPdfOrientation(v as PdfOrientation)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (based on shape)</SelectItem>
                          <SelectItem value="portrait">Portrait</SelectItem>
                          <SelectItem value="landscape">Landscape</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {pdfExportType === 'single' && (
                      <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="include-basemap" className="text-sm font-medium">Include basemap in PDF</Label>
                          <p className="text-xs text-muted-foreground">
                            Captures the visible map tiles exactly as shown
                          </p>
                        </div>
                        <Switch
                          id="include-basemap"
                          checked={pdfIncludeBasemap}
                          onCheckedChange={setPdfIncludeBasemap}
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPdfExportOpen(false)}>Cancel</Button>
                    <Button onClick={handlePdfExport} disabled={isExporting} className="bg-forest-light hover:bg-forest-mid">
                      {isExporting ? 'Exporting...' : 'Export PDF'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
