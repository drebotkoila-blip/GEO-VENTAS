import { Coordinates } from '../types';

/**
 * Validates if a coordinate object has finite, valid numerical lat and lng
 */
export function isValidCoordinate(coord?: Coordinates | null): boolean {
  if (!coord) return false;
  const lat = Number(coord.lat);
  const lng = Number(coord.lng);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/**
 * Returns safe finite coordinates, falling back to Madrid center if invalid/NaN/null
 */
export function safeCoords(coord?: Coordinates | null, fallback = { lat: 40.4168, lng: -3.7038 }): Coordinates {
  if (isValidCoordinate(coord)) {
    return {
      lat: Number(coord!.lat),
      lng: Number(coord!.lng),
    };
  }
  return fallback;
}

// Major cities reference centers
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  madrid: { lat: 40.4168, lng: -3.7038 },
  barcelona: { lat: 41.3851, lng: 2.1734 },
  valencia: { lat: 39.4699, lng: -0.3763 },
  sevilla: { lat: 37.3891, lng: -5.9845 },
  zaragoza: { lat: 41.6488, lng: -0.8891 },
  málaga: { lat: 36.7213, lng: -4.4214 },
  malaga: { lat: 36.7213, lng: -4.4214 },
  murcia: { lat: 37.9922, lng: -1.1307 },
  bilbao: { lat: 43.2630, lng: -2.9350 },
  'san sebastián': { lat: 43.3183, lng: -1.9812 },
  'san sebastian': { lat: 43.3183, lng: -1.9812 },
  donostia: { lat: 43.3183, lng: -1.9812 },
  alicante: { lat: 38.3452, lng: -0.4810 },
  córdoba: { lat: 37.8882, lng: -4.7794 },
  cordoba: { lat: 37.8882, lng: -4.7794 },
  valladolid: { lat: 41.6523, lng: -4.7245 },
  vigo: { lat: 42.2406, lng: -8.7207 },
  gijón: { lat: 43.5322, lng: -5.6611 },
  gijon: { lat: 43.5322, lng: -5.6611 },
  'a coruña': { lat: 43.3623, lng: -8.4115 },
  coruña: { lat: 43.3623, lng: -8.4115 },
  vitoria: { lat: 42.8467, lng: -2.6716 },
  granada: { lat: 37.1773, lng: -3.5986 },
  santander: { lat: 43.4623, lng: -3.8099 },
  pamplona: { lat: 42.8125, lng: -1.6458 },
  toledo: { lat: 39.8628, lng: -4.0273 },
  lisboa: { lat: 38.7223, lng: -9.1393 },
  porto: { lat: 41.1579, lng: -8.6291 },
};

/**
 * Deterministically resolves coordinates for a client based on their city and address,
 * ensuring valid, non-overlapping coordinates without NaN.
 */
export function resolveClientCoords(client: {
  id: string;
  address?: string;
  city?: string;
  pais?: string;
  coords?: Coordinates | null;
}): Coordinates {
  if (isValidCoordinate(client.coords)) {
    return safeCoords(client.coords);
  }

  const rawCity = (client.city || 'madrid').trim().toLowerCase();
  const base = CITY_COORDS[rawCity] || CITY_COORDS['madrid'];

  // Hash string into a deterministic micro-offset between -0.015 and +0.015
  const seed = (client.address || '') + (client.id || '');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const offsetLat = ((Math.abs(hash) % 300) - 150) / 10000;
  const offsetLng = ((Math.abs(hash >> 3) % 300) - 150) / 10000;

  return safeCoords({
    lat: base.lat + offsetLat,
    lng: base.lng + offsetLng,
  });
}

/**
 * Calculates the great circle distance between two points on the earth in meters
 * using the Haversine formula.
 */
export function calculateDistanceMeters(coord1: Coordinates, coord2: Coordinates): number {
  if (!isValidCoordinate(coord1) || !isValidCoordinate(coord2)) {
    return 0;
  }
  const R = 6371e3; // Earth radius in meters
  const phi1 = (Number(coord1.lat) * Math.PI) / 180;
  const phi2 = (Number(coord2.lat) * Math.PI) / 180;
  const deltaPhi = ((Number(coord2.lat) - Number(coord1.lat)) * Math.PI) / 180;
  const deltaLambda = ((Number(coord2.lng) - Number(coord1.lng)) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = Math.round(R * c);
  return Number.isFinite(distance) ? distance : 0;
}

/**
 * Format meters to human-readable distance (m or km)
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} km`;
}

/**
 * Format duration minutes into "Xh Ym" or "Xm"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Calculate compass bearing between two points in degrees (0 - 360)
 */
export function calculateBearing(start: Coordinates, end: Coordinates): number {
  if (!isValidCoordinate(start) || !isValidCoordinate(end)) {
    return 0;
  }
  const lat1 = (Number(start.lat) * Math.PI) / 180;
  const lat2 = (Number(end.lat) * Math.PI) / 180;
  const deltaLng = ((Number(end.lng) - Number(start.lng)) * Math.PI) / 180;

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  const theta = Math.atan2(y, x);

  const bearing = (Math.round((theta * 180) / Math.PI) + 360) % 360;
  return Number.isFinite(bearing) ? bearing : 0;
}

/**
 * Interpolate a point between two coordinates given a progress fraction [0, 1]
 */
export function interpolateCoords(start: Coordinates, end: Coordinates, fraction: number): Coordinates {
  if (!isValidCoordinate(start) || !isValidCoordinate(end)) {
    return isValidCoordinate(start) ? start : (isValidCoordinate(end) ? end : { lat: 40.4168, lng: -3.7038 });
  }
  return {
    lat: Number(start.lat) + (Number(end.lat) - Number(start.lat)) * fraction,
    lng: Number(start.lng) + (Number(end.lng) - Number(start.lng)) * fraction,
  };
}

/**
 * Convert visit data into CSV format for export
 */
export function exportVisitsToCsv(visits: Array<any>): string {
  const headers = [
    'ID Visita',
    'Vendedor',
    'Cliente',
    'Empresa',
    'Fecha Programada',
    'Hora',
    'Estado',
    'Objetivo',
    'Check-in Hora',
    'Check-in Lat',
    'Check-in Lng',
    'Distancia al Cliente (m)',
    'Dentro de Geocerca',
    'Check-out Hora',
    'Duración (min)',
    'Resultado',
    'Venta ($)',
    'Notas'
  ];

  const rows = visits.map((v) => [
    v.id,
    `"${v.repName || ''}"`,
    `"${v.clientContact || ''}"`,
    `"${v.clientCompany || ''}"`,
    v.scheduledDate,
    v.scheduledTime,
    v.status,
    `"${(v.objective || '').replace(/"/g, '""')}"`,
    v.checkInTime || '',
    v.checkInCoords?.lat?.toFixed(6) || '',
    v.checkInCoords?.lng?.toFixed(6) || '',
    v.checkInDistanceMeters ?? '',
    v.isWithinGeofence ? 'SÍ' : (v.checkInTime ? 'NO' : ''),
    v.checkOutTime || '',
    v.durationMinutes ?? '',
    v.outcome || '',
    v.saleAmount ?? '',
    `"${(v.notes || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
