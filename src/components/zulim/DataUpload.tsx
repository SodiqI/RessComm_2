import { useState, useCallback } from 'react';
import { Upload, Database, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { DataPoint, UploadedData } from '@/types/spatial';
import { DEMO_DATA } from '@/utils/demoData';

interface DataUploadProps {
  onDataLoaded: (data: UploadedData) => void;
  uploadedData: UploadedData | null;
}

export function DataUpload({ onDataLoaded, uploadedData }: DataUploadProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  const loadDemoData = useCallback(() => {
    const data: UploadedData = {
      type: 'demo',
      headers: DEMO_DATA.headers,
      data: DEMO_DATA.points.map(p => p.properties),
      points: DEMO_DATA.points
    };
    onDataLoaded(data);
    toast({
      title: "Demo data loaded",
      description: `${DEMO_DATA.points.length} agricultural sample points with yield, rainfall, soil pH, elevation, and NDVI data.`,
    });
  }, [onDataLoaded, toast]);

  const parseCSV = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        if (results.data.length === 0) {
          toast({ title: "Error", description: "CSV file is empty", variant: "destructive" });
          return;
        }

        const headers = Object.keys(results.data[0] as object);
        const latCol = headers.find(h => h.toLowerCase().includes('lat'));
        const lngCol = headers.find(h => 
          h.toLowerCase().includes('lon') || h.toLowerCase().includes('lng')
        );

        if (!latCol || !lngCol) {
          toast({ 
            title: "Error", 
            description: "CSV must contain latitude and longitude columns", 
            variant: "destructive" 
          });
          return;
        }

        const dataPoints: DataPoint[] = (results.data as Record<string, any>[])
          .filter(row => row[latCol] && row[lngCol])
          .map(row => ({
            lat: parseFloat(row[latCol]),
            lng: parseFloat(row[lngCol]),
            properties: row
          }));

        if (dataPoints.length < 3) {
          toast({ 
            title: "Error", 
            description: "Dataset must contain at least 3 valid points", 
            variant: "destructive" 
          });
          return;
        }

        onDataLoaded({
          type: 'csv',
          headers,
          data: results.data,
          points: dataPoints
        });

        toast({
          title: "Data loaded successfully",
          description: `${dataPoints.length} points loaded from ${file.name}`,
        });
      },
      error: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    });
  }, [onDataLoaded, toast]);

  const parseGeoJSON = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string);
        
        if (geojson.type !== 'FeatureCollection' && geojson.type !== 'Feature') {
          toast({ title: "Error", description: "Invalid GeoJSON format", variant: "destructive" });
          return;
        }

        const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
        
        const dataPoints: DataPoint[] = features
          .filter((f: any) => f.geometry && f.geometry.type === 'Point')
          .map((f: any) => ({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            properties: f.properties || {}
          }));

        if (dataPoints.length < 3) {
          toast({ 
            title: "Error", 
            description: "GeoJSON must contain at least 3 point features", 
            variant: "destructive" 
          });
          return;
        }

        const headers = Object.keys(dataPoints[0].properties);
        
        onDataLoaded({
          type: 'geojson',
          headers,
          data: geojson,
          points: dataPoints
        });

        toast({
          title: "Data loaded successfully",
          description: `${dataPoints.length} points loaded from ${file.name}`,
        });
      } catch (error) {
        toast({ 
          title: "Error", 
          description: `Error parsing GeoJSON: ${(error as Error).message}`, 
          variant: "destructive" 
        });
      }
    };
    reader.readAsText(file);
  }, [onDataLoaded, toast]);

  const parseExcel = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Use the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          toast({ title: "Error", description: "Excel file is empty", variant: "destructive" });
          return;
        }

        const headers = Object.keys(jsonData[0] as object);
        const latCol = headers.find(h => h.toLowerCase().includes('lat'));
        const lngCol = headers.find(h => 
          h.toLowerCase().includes('lon') || h.toLowerCase().includes('lng')
        );

        if (!latCol || !lngCol) {
          toast({ 
            title: "Error", 
            description: "Excel must contain latitude and longitude columns", 
            variant: "destructive" 
          });
          return;
        }

        const dataPoints: DataPoint[] = (jsonData as Record<string, any>[])
          .filter(row => row[latCol] != null && row[lngCol] != null)
          .map(row => ({
            lat: parseFloat(row[latCol]),
            lng: parseFloat(row[lngCol]),
            properties: row
          }));

        if (dataPoints.length < 3) {
          toast({ 
            title: "Error", 
            description: "Dataset must contain at least 3 valid points", 
            variant: "destructive" 
          });
          return;
        }

        onDataLoaded({
          type: 'excel',
          headers,
          data: jsonData,
          points: dataPoints
        });

        toast({
          title: "Data loaded successfully",
          description: `${dataPoints.length} points loaded from ${file.name}`,
        });
      } catch (error) {
        toast({ 
          title: "Error", 
          description: `Error parsing Excel: ${(error as Error).message}`, 
          variant: "destructive" 
        });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [onDataLoaded, toast]);

  const handleFile = useCallback((file: File) => {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.csv')) {
      parseCSV(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      parseExcel(file);
    } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
      parseGeoJSON(file);
    } else if (fileName.endsWith('.zip')) {
      toast({ 
        title: "Coming soon", 
        description: "Shapefile support is coming soon. Please use CSV, Excel, or GeoJSON.", 
        variant: "default" 
      });
    } else {
      toast({ 
        title: "Unsupported format", 
        description: "Please use CSV, Excel (.xlsx/.xls), GeoJSON, or Shapefile (.zip)", 
        variant: "destructive" 
      });
    }
  }, [parseCSV, parseExcel, parseGeoJSON, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  return (
    <div className="zulim-section">
      <h3 className="zulim-section-title">
        <Upload className="w-4 h-4" />
        Upload Dataset
      </h3>

      <div
        className={`upload-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          type="file"
          id="file-input"
          className="hidden"
          accept=".csv,.xlsx,.xls,.geojson,.json,.zip"
          onChange={handleFileInput}
        />
        <Upload className="w-10 h-10 text-forest-light mx-auto mb-3" />
        <p className="font-medium text-foreground">Drag & drop files here</p>
        <p className="text-sm text-muted-foreground mt-1">
          or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Supported: CSV, Excel (.xlsx/.xls), GeoJSON, Shapefile (.zip)
        </p>
      </div>

      {uploadedData && (
        <div className="mt-4 p-3 bg-sage-light rounded-lg border border-forest-light/30">
          <div className="flex items-center gap-2 text-forest-dark font-medium">
            <CheckCircle2 className="w-4 h-4 text-success" />
            Dataset Loaded
          </div>
          <div className="mt-2 text-sm text-muted-foreground space-y-1">
            <p><span className="font-medium">Points:</span> {uploadedData.points.length}</p>
            <p><span className="font-medium">CRS:</span> EPSG:4326 (WGS84)</p>
            <p><span className="font-medium">Fields:</span> {uploadedData.headers.length}</p>
          </div>
        </div>
      )}

      <Button 
        variant="secondary" 
        className="w-full mt-3"
        onClick={loadDemoData}
      >
        <Database className="w-4 h-4 mr-2" />
        Load Demo Data
      </Button>
    </div>
  );
}
