import { Coordinates } from '../types';

/**
 * Calculates the great circle distance between two points on the earth in meters
 * using the Haversine formula.
 */
export function calculateDistanceMeters(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (coord1.lat * Math.PI) / 180;
  const phi2 = (coord2.lat * Math.PI) / 180;
  const deltaPhi = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const deltaLambda = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
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
  const lat1 = (start.lat * Math.PI) / 180;
  const lat2 = (end.lat * Math.PI) / 180;
  const deltaLng = ((end.lng - start.lng) * Math.PI) / 180;

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  const theta = Math.atan2(y, x);

  return (Math.round((theta * 180) / Math.PI) + 360) % 360;
}

/**
 * Interpolate a point between two coordinates given a progress fraction [0, 1]
 */
export function interpolateCoords(start: Coordinates, end: Coordinates, fraction: number): Coordinates {
  return {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lng: start.lng + (end.lng - start.lng) * fraction,
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
