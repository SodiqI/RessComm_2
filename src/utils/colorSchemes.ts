// Color scheme utilities for spatial visualization
import type { ColorScheme } from '@/types/spatial';

const COLOR_SCHEMES: Record<ColorScheme, number[][]> = {
  viridis: [[68, 1, 84], [49, 104, 142], [53, 183, 121], [253, 231, 36]],
  plasma: [[13, 8, 135], [126, 3, 168], [204, 71, 120], [248, 149, 64], [240, 249, 33]],
  coolwarm: [[59, 76, 192], [144, 178, 254], [220, 220, 220], [245, 156, 125], [180, 4, 38]],
  greens: [[247, 252, 245], [199, 233, 192], [127, 188, 65], [49, 163, 84], [0, 109, 44]],
  reds: [[255, 245, 240], [252, 187, 161], [252, 146, 114], [251, 106, 74], [222, 45, 38]],
  terrain: [[0, 97, 71], [37, 138, 64], [105, 171, 99], [212, 185, 140], [165, 42, 42]],
  spectral: [[94, 79, 162], [50, 136, 189], [102, 194, 165], [254, 224, 139], [253, 174, 97], [244, 109, 67], [213, 62, 79], [158, 1, 66]]
};

const CLASS_COLORS = [
  '#d73027', '#fc8d59', '#fee090', '#e0f3f8', '#91bfdb', 
  '#4575b4', '#313695', '#a50026', '#006837', '#1a9850'
];

export function getColorForValue(
  value: number, 
  min: number, 
  max: number, 
  scheme: ColorScheme = 'viridis'
): string {
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const colors = COLOR_SCHEMES[scheme] || COLOR_SCHEMES.viridis;
  
  const scaledPos = normalized * (colors.length - 1);
  const lower = Math.floor(scaledPos);
  const upper = Math.ceil(scaledPos);
  const t = scaledPos - lower;
  
  if (lower === upper || upper >= colors.length) {
    const c = colors[Math.min(lower, colors.length - 1)];
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }
  
  const c1 = colors[lower];
  const c2 = colors[upper];
  
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  
  return `rgb(${r}, ${g}, ${b})`;
}

export function getColorForClass(classNum: number, totalClasses: number): string {
  return CLASS_COLORS[classNum % CLASS_COLORS.length];
}

export function getReliabilityColor(reliable: boolean): string {
  return reliable ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.25)';
}

export function getGradientCSS(scheme: ColorScheme): string {
  const colors = COLOR_SCHEMES[scheme] || COLOR_SCHEMES.viridis;
  const stops = colors.map((c, i) => {
    const percent = (i / (colors.length - 1)) * 100;
    return `rgb(${c[0]}, ${c[1]}, ${c[2]}) ${percent}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export function getSchemeColors(scheme: ColorScheme): string[] {
  const colors = COLOR_SCHEMES[scheme] || COLOR_SCHEMES.viridis;
  return colors.map(c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`);
}

export const RELIABILITY_COLORS = {
  high: '#4caf50',
  medium: '#ff9800',
  low: '#f44336'
};
