import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BASEMAP_OPTIONS, isBasemapCorsEnabled } from '@/utils/basemapConfig';
import { Map, Check } from 'lucide-react';

interface BasemapSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  compact?: boolean;
  showCorsWarning?: boolean;
}

export function BasemapSelector({ value, onChange, label = 'Basemap', compact = false, showCorsWarning = false }: BasemapSelectorProps) {
  const currentCorsEnabled = isBasemapCorsEnabled(value);
  
  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs w-[200px] bg-background/90 backdrop-blur-sm">
            <Map className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Basemap" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1 text-[10px] text-muted-foreground border-b mb-1">
              ★ = PDF export compatible
            </div>
            {BASEMAP_OPTIONS.map((basemap) => (
              <SelectItem key={basemap.id} value={basemap.id} className="text-xs">
                <div className="flex items-center gap-1.5">
                  <span>{basemap.name}</span>
                  {basemap.corsEnabled && (
                    <Check className="w-3 h-3 text-green-600" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showCorsWarning && !currentCorsEnabled && (
          <span className="text-[10px] text-amber-600 leading-tight">
            ⚠ This basemap may not appear in PDF exports
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select basemap" />
        </SelectTrigger>
        <SelectContent>
          <div className="px-2 py-1.5 text-xs text-muted-foreground border-b mb-1">
            ★ = PDF export compatible (CORS-enabled)
          </div>
          {BASEMAP_OPTIONS.map((basemap) => (
            <SelectItem key={basemap.id} value={basemap.id}>
              <div className="flex items-center gap-2">
                <span>{basemap.name}</span>
                {basemap.corsEnabled && (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showCorsWarning && !currentCorsEnabled && (
        <p className="text-xs text-amber-600">
          ⚠ This basemap may not appear in PDF exports. Switch to a ★ basemap for reliable capture.
        </p>
      )}
    </div>
  );
}
