import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BASEMAP_OPTIONS, type BasemapOption } from '@/utils/basemapConfig';
import { Map } from 'lucide-react';

interface BasemapSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  compact?: boolean;
}

export function BasemapSelector({ value, onChange, label = 'Basemap', compact = false }: BasemapSelectorProps) {
  if (compact) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs w-[180px]">
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
          {BASEMAP_OPTIONS.map((basemap) => (
            <SelectItem key={basemap.id} value={basemap.id}>
              <div className="flex flex-col items-start">
                <span>{basemap.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
