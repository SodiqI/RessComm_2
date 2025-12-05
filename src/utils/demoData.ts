// Demo dataset for ZULIM
import type { DataPoint } from '@/types/spatial';

export const DEMO_DATA: { points: DataPoint[]; headers: string[] } = {
  points: [
    { lat: 9.082, lng: 8.675, properties: { id: 1, yield_kg: 2500, rainfall_mm: 1200, soil_ph: 6.5, elevation_m: 350, ndvi: 0.65 } },
    { lat: 9.095, lng: 8.690, properties: { id: 2, yield_kg: 2800, rainfall_mm: 1250, soil_ph: 6.8, elevation_m: 360, ndvi: 0.72 } },
    { lat: 9.070, lng: 8.660, properties: { id: 3, yield_kg: 2200, rainfall_mm: 1180, soil_ph: 6.2, elevation_m: 340, ndvi: 0.58 } },
    { lat: 9.110, lng: 8.705, properties: { id: 4, yield_kg: 3100, rainfall_mm: 1300, soil_ph: 7.0, elevation_m: 380, ndvi: 0.78 } },
    { lat: 9.088, lng: 8.680, properties: { id: 5, yield_kg: 2650, rainfall_mm: 1220, soil_ph: 6.6, elevation_m: 355, ndvi: 0.68 } },
    { lat: 9.100, lng: 8.695, properties: { id: 6, yield_kg: 2900, rainfall_mm: 1270, soil_ph: 6.9, elevation_m: 370, ndvi: 0.74 } },
    { lat: 9.075, lng: 8.670, properties: { id: 7, yield_kg: 2400, rainfall_mm: 1190, soil_ph: 6.4, elevation_m: 345, ndvi: 0.62 } },
    { lat: 9.105, lng: 8.700, properties: { id: 8, yield_kg: 3000, rainfall_mm: 1290, soil_ph: 6.95, elevation_m: 375, ndvi: 0.76 } },
    { lat: 9.092, lng: 8.685, properties: { id: 9, yield_kg: 2750, rainfall_mm: 1240, soil_ph: 6.7, elevation_m: 362, ndvi: 0.70 } },
    { lat: 9.078, lng: 8.665, properties: { id: 10, yield_kg: 2350, rainfall_mm: 1170, soil_ph: 6.3, elevation_m: 342, ndvi: 0.60 } },
    { lat: 9.115, lng: 8.710, properties: { id: 11, yield_kg: 3200, rainfall_mm: 1320, soil_ph: 7.1, elevation_m: 385, ndvi: 0.80 } },
    { lat: 9.085, lng: 8.678, properties: { id: 12, yield_kg: 2600, rainfall_mm: 1210, soil_ph: 6.55, elevation_m: 352, ndvi: 0.66 } },
    { lat: 9.098, lng: 8.692, properties: { id: 13, yield_kg: 2850, rainfall_mm: 1260, soil_ph: 6.85, elevation_m: 368, ndvi: 0.73 } },
    { lat: 9.072, lng: 8.668, properties: { id: 14, yield_kg: 2300, rainfall_mm: 1185, soil_ph: 6.35, elevation_m: 343, ndvi: 0.59 } },
    { lat: 9.108, lng: 8.703, properties: { id: 15, yield_kg: 3050, rainfall_mm: 1295, soil_ph: 6.98, elevation_m: 378, ndvi: 0.77 } },
    { lat: 9.090, lng: 8.683, properties: { id: 16, yield_kg: 2700, rainfall_mm: 1230, soil_ph: 6.65, elevation_m: 358, ndvi: 0.69 } },
    { lat: 9.080, lng: 8.673, properties: { id: 17, yield_kg: 2450, rainfall_mm: 1195, soil_ph: 6.45, elevation_m: 348, ndvi: 0.63 } },
    { lat: 9.112, lng: 8.708, properties: { id: 18, yield_kg: 3150, rainfall_mm: 1310, soil_ph: 7.05, elevation_m: 382, ndvi: 0.79 } },
    { lat: 9.087, lng: 8.681, properties: { id: 19, yield_kg: 2620, rainfall_mm: 1215, soil_ph: 6.58, elevation_m: 354, ndvi: 0.67 } },
    { lat: 9.095, lng: 8.688, properties: { id: 20, yield_kg: 2820, rainfall_mm: 1255, soil_ph: 6.82, elevation_m: 365, ndvi: 0.71 } },
    { lat: 9.073, lng: 8.662, properties: { id: 21, yield_kg: 2250, rainfall_mm: 1175, soil_ph: 6.25, elevation_m: 338, ndvi: 0.57 } },
    { lat: 9.103, lng: 8.698, properties: { id: 22, yield_kg: 2950, rainfall_mm: 1280, soil_ph: 6.92, elevation_m: 372, ndvi: 0.75 } },
    { lat: 9.084, lng: 8.676, properties: { id: 23, yield_kg: 2550, rainfall_mm: 1205, soil_ph: 6.52, elevation_m: 350, ndvi: 0.64 } },
    { lat: 9.097, lng: 8.691, properties: { id: 24, yield_kg: 2880, rainfall_mm: 1265, soil_ph: 6.88, elevation_m: 367, ndvi: 0.72 } },
    { lat: 9.077, lng: 8.671, properties: { id: 25, yield_kg: 2380, rainfall_mm: 1188, soil_ph: 6.38, elevation_m: 346, ndvi: 0.61 } },
    { lat: 9.107, lng: 8.702, properties: { id: 26, yield_kg: 3020, rainfall_mm: 1292, soil_ph: 6.96, elevation_m: 376, ndvi: 0.76 } },
    { lat: 9.089, lng: 8.682, properties: { id: 27, yield_kg: 2680, rainfall_mm: 1225, soil_ph: 6.62, elevation_m: 356, ndvi: 0.68 } },
    { lat: 9.101, lng: 8.696, properties: { id: 28, yield_kg: 2920, rainfall_mm: 1275, soil_ph: 6.90, elevation_m: 371, ndvi: 0.74 } },
    { lat: 9.074, lng: 8.664, properties: { id: 29, yield_kg: 2280, rainfall_mm: 1178, soil_ph: 6.28, elevation_m: 341, ndvi: 0.58 } },
    { lat: 9.113, lng: 8.707, properties: { id: 30, yield_kg: 3180, rainfall_mm: 1315, soil_ph: 7.08, elevation_m: 384, ndvi: 0.79 } }
  ],
  headers: ['id', 'yield_kg', 'rainfall_mm', 'soil_ph', 'elevation_m', 'ndvi']
};
