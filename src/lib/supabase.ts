import { createClient } from '@supabase/supabase-js';
import { SalesRep, Client, Visit } from '../types';

// Strip any trailing /rest/v1 or trailing slash to get the valid base Supabase URL
const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jeuqkaidbikwbdquhkaa.supabase.co/rest/v1/';
export const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

// Publishable / anon key provided by the user
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_JiYAF-pvnRgfU0t3yAdNEg_kXiIlpVD';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
  },
});

export interface SupabaseSyncState {
  isConnected: boolean;
  isChecking: boolean;
  lastSyncTime: string | null;
  hasTables: boolean;
  error: string | null;
}

/**
 * Health check to verify connection to the Supabase endpoint
 */
export async function checkSupabaseConnection(): Promise<{ isConnected: boolean; error: string | null }> {
  try {
    const { error } = await supabase.from('vendedores').select('id', { count: 'exact', head: true });
    if (!error) {
      return { isConnected: true, error: null };
    }
    // If the table doesn't exist yet, error code PGRST204 or 42P01 means the database connection is alive
    if (error.code === 'PGRST204' || error.code === '42P01') {
      return { isConnected: true, error: null };
    }
    return { isConnected: false, error: error.message };
  } catch (err: any) {
    return { isConnected: false, error: err.message || 'Error de conexión' };
  }
}

/**
 * Transform database rows to App Types
 */
export function mapRowToRep(row: any): SalesRep {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatar: row.avatar || '',
    territory: row.territory || 'Madrid',
    roleTitle: row.role_title,
    vehicleType: row.vehicle_type,
    hireDate: row.hire_date,
    dni: row.dni,
    currentCoords: {
      lat: Number(row.current_lat),
      lng: Number(row.current_lng),
    },
    lastPing: row.last_ping || new Date().toISOString(),
    status: row.status || 'available',
    batteryLevel: Number(row.battery_level ?? 90),
    speedKmH: Number(row.speed_kmh ?? 0),
    heading: row.heading ? Number(row.heading) : undefined,
    totalDistanceKmToday: Number(row.total_distance_km_today ?? 0),
    routeHistory: Array.isArray(row.route_history) ? row.route_history : [],
  };
}

export function mapRepToRow(rep: SalesRep): any {
  return {
    id: rep.id,
    name: rep.name,
    email: rep.email,
    phone: rep.phone,
    avatar: rep.avatar,
    territory: rep.territory,
    role_title: rep.roleTitle,
    vehicle_type: rep.vehicleType,
    hire_date: rep.hireDate,
    dni: rep.dni,
    current_lat: rep.currentCoords.lat,
    current_lng: rep.currentCoords.lng,
    last_ping: rep.lastPing,
    status: rep.status,
    battery_level: rep.batteryLevel,
    speed_kmh: rep.speedKmH,
    heading: rep.heading,
    total_distance_km_today: rep.totalDistanceKmToday,
    route_history: rep.routeHistory,
  };
}

export function mapRowToClient(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    coords: {
      lat: Number(row.lat),
      lng: Number(row.lng),
    },
    geofenceRadiusMeters: Number(row.geofence_radius_meters ?? 120),
    priority: row.priority || 'media',
    category: row.category || 'Retail',
  };
}

export function mapClientToRow(c: Client): any {
  return {
    id: c.id,
    name: c.name,
    company: c.company,
    contact_name: c.contactName,
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    lat: c.coords.lat,
    lng: c.coords.lng,
    geofence_radius_meters: c.geofenceRadiusMeters,
    priority: c.priority,
    category: c.category,
  };
}

export function mapRowToVisit(row: any): Visit {
  return {
    id: row.id,
    repId: row.rep_id,
    clientId: row.client_id,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    status: row.status,
    objective: row.objective || '',
    checkInTime: row.check_in_time,
    checkInCoords: row.check_in_lat ? { lat: Number(row.check_in_lat), lng: Number(row.check_in_lng) } : undefined,
    checkInDistanceMeters: row.check_in_distance_meters ? Number(row.check_in_distance_meters) : undefined,
    isWithinGeofence: row.is_within_geofence,
    geofenceOverrideReason: row.geofence_override_reason,
    checkOutTime: row.check_out_time,
    checkOutCoords: row.check_out_lat ? { lat: Number(row.check_out_lat), lng: Number(row.check_out_lng) } : undefined,
    durationMinutes: row.duration_minutes ? Number(row.duration_minutes) : undefined,
    outcome: row.outcome,
    saleAmount: row.sale_amount ? Number(row.sale_amount) : undefined,
    notes: row.notes,
    clientFeedbackRating: row.client_feedback_rating ? Number(row.client_feedback_rating) : undefined,
    signatureBase64: row.signature_base64,
    photoUrl: row.photo_url,
  };
}

export function mapVisitToRow(v: Visit): any {
  return {
    id: v.id,
    rep_id: v.repId,
    client_id: v.clientId,
    scheduled_date: v.scheduledDate,
    scheduled_time: v.scheduledTime,
    status: v.status,
    objective: v.objective,
    check_in_time: v.checkInTime,
    check_in_lat: v.checkInCoords?.lat,
    check_in_lng: v.checkInCoords?.lng,
    check_in_distance_meters: v.checkInDistanceMeters,
    is_within_geofence: v.isWithinGeofence,
    geofence_override_reason: v.geofenceOverrideReason,
    check_out_time: v.checkOutTime,
    check_out_lat: v.checkOutCoords?.lat,
    check_out_lng: v.checkOutCoords?.lng,
    duration_minutes: v.durationMinutes,
    outcome: v.outcome,
    sale_amount: v.saleAmount,
    notes: v.notes,
    client_feedback_rating: v.clientFeedbackRating,
    signature_base64: v.signatureBase64,
    photo_url: v.photoUrl,
  };
}

/**
 * SQL Schema for Supabase SQL Editor if user wishes to run it
 */
export const SUPABASE_SQL_SETUP = `-- Script de creación de tablas para GeoVentas en Supabase
-- Ejecutar en el SQL Editor de tu proyecto Supabase

-- 1. Tabla de Vendedores
CREATE TABLE IF NOT EXISTS public.vendedores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    territory TEXT DEFAULT '',
    role_title TEXT DEFAULT 'Ejecutivo Comercial de Campo',
    vehicle_type TEXT DEFAULT 'car',
    hire_date DATE,
    dni TEXT,
    current_lat DOUBLE PRECISION NOT NULL DEFAULT 40.4530,
    current_lng DOUBLE PRECISION NOT NULL DEFAULT -3.6883,
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'available',
    battery_level INTEGER DEFAULT 90,
    speed_kmh INTEGER DEFAULT 0,
    heading DOUBLE PRECISION DEFAULT 0,
    total_distance_km_today DOUBLE PRECISION DEFAULT 0,
    route_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT NOT NULL,
    city TEXT DEFAULT 'Madrid',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    geofence_radius_meters INTEGER DEFAULT 120,
    priority TEXT DEFAULT 'media',
    category TEXT DEFAULT 'Retail',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Visitas
CREATE TABLE IF NOT EXISTS public.visitas (
    id TEXT PRIMARY KEY,
    rep_id TEXT REFERENCES public.vendedores(id) ON DELETE SET NULL,
    client_id TEXT REFERENCES public.clientes(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    scheduled_time TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled',
    objective TEXT,
    check_in_time TIMESTAMPTZ,
    check_in_lat DOUBLE PRECISION,
    check_in_lng DOUBLE PRECISION,
    check_in_distance_meters INTEGER,
    is_within_geofence BOOLEAN,
    geofence_override_reason TEXT,
    check_out_time TIMESTAMPTZ,
    check_out_lat DOUBLE PRECISION,
    check_out_lng DOUBLE PRECISION,
    duration_minutes INTEGER,
    outcome TEXT,
    sale_amount NUMERIC,
    notes TEXT,
    client_feedback_rating INTEGER,
    signature_base64 TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar permisos de lectura y escritura para la publishable/anon key
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo a anon en vendedores" ON public.vendedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en visitas" ON public.visitas FOR ALL USING (true) WITH CHECK (true);
`;
