// Coordinate detection and conversion utilities

export interface CoordinateColumns {
  xCol: string;
  yCol: string;
  type: 'latLng' | 'eastingNorthing';
}

/**
 * Detect coordinate columns from headers
 * Supports both Lat/Lng and Easting/Northing
 */
export function detectCoordinateColumns(headers: string[]): CoordinateColumns | null {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  // Check for Lat/Lng first
  const latCol = headers.find((h, i) => 
    lowerHeaders[i].includes('lat') || 
    lowerHeaders[i] === 'y' ||
    lowerHeaders[i] === 'latitude'
  );
  const lngCol = headers.find((h, i) => 
    lowerHeaders[i].includes('lon') || 
    lowerHeaders[i].includes('lng') ||
    lowerHeaders[i] === 'x' ||
    lowerHeaders[i] === 'longitude'
  );
  
  if (latCol && lngCol) {
    return { xCol: lngCol, yCol: latCol, type: 'latLng' };
  }
  
  // Check for Easting/Northing
  const eastingCol = headers.find((h, i) => 
    lowerHeaders[i].includes('easting') || 
    lowerHeaders[i] === 'e' ||
    lowerHeaders[i] === 'east'
  );
  const northingCol = headers.find((h, i) => 
    lowerHeaders[i].includes('northing') || 
    lowerHeaders[i] === 'n' ||
    lowerHeaders[i] === 'north'
  );
  
  if (eastingCol && northingCol) {
    return { xCol: eastingCol, yCol: northingCol, type: 'eastingNorthing' };
  }
  
  return null;
}

/**
 * Check if coordinates appear to be in UTM/projected format
 * UTM coordinates are typically large numbers (6-7 digits)
 */
export function isProjectedCoordinate(x: number, y: number): boolean {
  // UTM Easting typically 100,000 - 900,000
  // UTM Northing typically 0 - 10,000,000
  const xAbs = Math.abs(x);
  const yAbs = Math.abs(y);
  
  return (xAbs > 1000 && xAbs < 1000000) || (yAbs > 10000 && yAbs < 10000000);
}

/**
 * Approximate conversion from UTM to WGS84 (simplified)
 * For accurate conversion, the UTM zone would be needed
 * This uses an approximate inverse projection assuming common zones
 */
export function utmToLatLng(easting: number, northing: number, zone: number = 36, isNorthern: boolean = true): { lat: number; lng: number } {
  // WGS84 ellipsoid constants
  const a = 6378137; // semi-major axis
  const f = 1 / 298.257223563; // flattening
  const k0 = 0.9996; // scale factor
  const e = Math.sqrt(2 * f - f * f); // eccentricity
  const e1sq = e * e / (1 - e * e);
  
  // Remove false easting and northing
  const x = easting - 500000;
  const y = isNorthern ? northing : northing - 10000000;
  
  // Calculate footprint latitude
  const M = y / k0;
  const mu = M / (a * (1 - e * e / 4 - 3 * e * e * e * e / 64));
  
  const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
  
  const phi1 = mu + 
    (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu) +
    (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu) +
    (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu);
  
  const N1 = a / Math.sqrt(1 - e * e * Math.sin(phi1) * Math.sin(phi1));
  const T1 = Math.tan(phi1) * Math.tan(phi1);
  const C1 = e1sq * Math.cos(phi1) * Math.cos(phi1);
  const R1 = a * (1 - e * e) / Math.pow(1 - e * e * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const D = x / (N1 * k0);
  
  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
    D * D / 2 -
    (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e1sq) * Math.pow(D, 4) / 24 +
    (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e1sq - 3 * C1 * C1) * Math.pow(D, 6) / 720
  );
  
  const lng0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180; // Central meridian
  
  const lng = lng0 + (
    D -
    (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 +
    (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e1sq + 24 * T1 * T1) * Math.pow(D, 5) / 120
  ) / Math.cos(phi1);
  
  return {
    lat: lat * 180 / Math.PI,
    lng: lng * 180 / Math.PI
  };
}

/**
 * Detect UTM zone from coordinates (approximate)
 * This is a heuristic based on common African UTM zones
 */
export function detectUtmZone(easting: number, northing: number): { zone: number; isNorthern: boolean } {
  // Default to zone 36N (common for East Africa including parts of Nigeria, Kenya, etc.)
  // For more accurate detection, the user should specify the zone
  return {
    zone: 36,
    isNorthern: northing > 0
  };
}

/**
 * Convert Easting/Northing to Lat/Lng
 * Uses approximate UTM conversion
 */
export function eastingNorthingToLatLng(easting: number, northing: number): { lat: number; lng: number } {
  const { zone, isNorthern } = detectUtmZone(easting, northing);
  return utmToLatLng(easting, northing, zone, isNorthern);
}

/**
 * Get coordinate column labels based on type
 */
export function getCoordinateLabels(type: 'latLng' | 'eastingNorthing'): { xLabel: string; yLabel: string } {
  if (type === 'eastingNorthing') {
    return { xLabel: 'Easting', yLabel: 'Northing' };
  }
  return { xLabel: 'Longitude', yLabel: 'Latitude' };
}
