import { createClient } from '@supabase/supabase-js';
import { SalesRep, Client, Visit, Article, Sale } from '../types';
import { safeCoords, resolveClientCoords } from '../utils/geoUtils';

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

export { ARTICULOS_FULL_SQL } from '../data/articulosSql';

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
    currentCoords: safeCoords(
      row.current_lat !== undefined && row.current_lng !== undefined
        ? { lat: Number(row.current_lat), lng: Number(row.current_lng) }
        : null,
      { lat: 40.4530, lng: -3.6883 }
    ),
    lastPing: row.last_ping || new Date().toISOString(),
    status: row.status || 'available',
    batteryLevel: Number.isFinite(Number(row.battery_level)) ? Number(row.battery_level) : 90,
    speedKmH: Number.isFinite(Number(row.speed_kmh)) ? Number(row.speed_kmh) : 0,
    heading: row.heading && Number.isFinite(Number(row.heading)) ? Number(row.heading) : undefined,
    totalDistanceKmToday: Number.isFinite(Number(row.total_distance_km_today)) ? Number(row.total_distance_km_today) : 0,
    routeHistory: Array.isArray(row.route_history)
      ? row.route_history.filter((p: any) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
      : [],
  };
}

export function mapRepToRow(rep: SalesRep): any {
  const coords = safeCoords(rep.currentCoords, { lat: 40.4530, lng: -3.6883 });
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
    current_lat: coords.lat,
    current_lng: coords.lng,
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
  const city = row.city || 'Madrid';
  const pais = row['país'] || row.pais || 'España';
  const fallbackCoords = resolveClientCoords({
    id: String(row.id),
    address: row.address,
    city,
    pais,
    coords:
      row.lat !== undefined && row.lng !== undefined && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng))
        ? { lat: Number(row.lat), lng: Number(row.lng) }
        : null,
  });

  return {
    id: String(row.id),
    code: row.code || undefined,
    name: row.name || 'Cliente sin nombre',
    company: row.company || row.name || '',
    contactName: row.contact_name || 'Contacto Comercial',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    city: city,
    pais: pais,
    coords: safeCoords(fallbackCoords, { lat: 40.4200, lng: -3.7000 }),
    geofenceRadiusMeters: 120,
    priority: row.priority || 'media',
    category: row.category || 'Retail',
    status: row.status || 'active',
    notes: row.notes || undefined,
    cif: row.cif || undefined,
  };
}

export function mapClientToRow(c: Client): any {
  // Only map the exact columns that exist in the updated Supabase 'clientes' table:
  // [id, code, name, company, contact_name, phone, email, address, city, category, país]
  return {
    id: c.id,
    code: c.code || null,
    name: c.name,
    company: c.company || c.name,
    contact_name: c.contactName || '',
    phone: c.phone || '',
    email: c.email || '',
    address: c.address || '',
    city: c.city || 'Madrid',
    category: c.category || 'Retail',
    'país': c.pais || 'España',
  };
}

export function mapRowToVisit(row: any): Visit {
  const checkInCoords =
    row.check_in_lat !== undefined &&
    row.check_in_lng !== undefined &&
    Number.isFinite(Number(row.check_in_lat)) &&
    Number.isFinite(Number(row.check_in_lng))
      ? { lat: Number(row.check_in_lat), lng: Number(row.check_in_lng) }
      : undefined;

  const checkOutCoords =
    row.check_out_lat !== undefined &&
    row.check_out_lng !== undefined &&
    Number.isFinite(Number(row.check_out_lat)) &&
    Number.isFinite(Number(row.check_out_lng))
      ? { lat: Number(row.check_out_lat), lng: Number(row.check_out_lng) }
      : undefined;

  return {
    id: row.id,
    repId: row.rep_id,
    clientId: row.client_id,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    status: row.status,
    objective: row.objective || '',
    checkInTime: row.check_in_time,
    checkInCoords,
    checkInDistanceMeters: row.check_in_distance_meters && Number.isFinite(Number(row.check_in_distance_meters)) ? Number(row.check_in_distance_meters) : undefined,
    isWithinGeofence: Boolean(row.is_within_geofence),
    geofenceOverrideReason: row.geofence_override_reason,
    checkOutTime: row.check_out_time,
    checkOutCoords,
    durationMinutes: row.duration_minutes && Number.isFinite(Number(row.duration_minutes)) ? Number(row.duration_minutes) : undefined,
    outcome: row.outcome,
    saleAmount: row.sale_amount && Number.isFinite(Number(row.sale_amount)) ? Number(row.sale_amount) : undefined,
    notes: row.notes,
    clientFeedbackRating: row.client_feedback_rating && Number.isFinite(Number(row.client_feedback_rating)) ? Number(row.client_feedback_rating) : undefined,
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
 * Mapping functions for Artículos
 */
export function mapRowToArticle(row: any): Article {
  return {
    referencia: Number(row.referencia),
    proveedor: row.proveedor || '',
    producto: row.producto || '',
    familia: row.familia || '',
    stock: Number(row.stock) || 0,
    precioCoste: Number(row.precio_coste) || 0,
    stockMin: Number(row.stock_min) || 0,
    fechaInvent: row.fecha_invent || '31/12/2025',
  };
}

export function mapArticleToRow(a: Article): any {
  return {
    referencia: a.referencia,
    proveedor: a.proveedor,
    producto: a.producto,
    familia: a.familia,
    stock: a.stock,
    precio_coste: a.precioCoste,
    stock_min: a.stockMin,
    fecha_invent: a.fechaInvent,
  };
}

/**
 * Upload all articles to Supabase in batches of 50
 */
export async function uploadArticlesToSupabase(articles: Article[]): Promise<{ count: number; error: any }> {
  try {
    const rows = articles.map(mapArticleToRow);
    const { data, error } = await supabase.from('articulos').upsert(rows, { onConflict: 'referencia' });
    if (error) {
      return { count: 0, error };
    }
    return { count: rows.length, error: null };
  } catch (err: any) {
    return { count: 0, error: err };
  }
}

/**
 * Mapping functions for Ventas
 */
export function mapRowToSale(row: any, index: number = 0): Sale {
  return {
    id: row.id ? String(row.id) : `sale-${row.id_cliente || 'c'}-${row.referencia || 'r'}-${row.Fecha || 'f'}-${index}`,
    cliente: row.cliente || row.Cliente || '',
    idCliente: String(row.id_cliente || row.IdCliente || row.cliente_id || ''),
    referencia: Number(row.referencia || row.Referencia) || 0,
    vendedor: row.Vendedor || row.vendedor || '',
    fecha: row.Fecha || row.fecha || new Date().toISOString().split('T')[0],
    cantidad: Number(row.Cantidad || row.cantidad) || 0,
    importe: Number(row.Importe || row.importe) || 0,
  };
}

export function mapSaleToRow(s: Sale): any {
  return {
    cliente: s.cliente,
    id_cliente: s.idCliente,
    referencia: s.referencia,
    Vendedor: s.vendedor,
    Fecha: s.fecha,
    Cantidad: s.cantidad,
    Importe: s.importe,
  };
}

/**
 * Upload sales to Supabase table VENTAS
 */
export async function uploadSalesToSupabase(sales: Sale[]): Promise<{ count: number; error: any }> {
  try {
    const rows = sales.map(mapSaleToRow);
    // Try uppercase 'VENTAS' first
    const { error: err1 } = await supabase.from('VENTAS').insert(rows);
    if (!err1) {
      return { count: rows.length, error: null };
    }
    // Fallback to lowercase 'ventas'
    const { error: err2 } = await supabase.from('ventas').insert(rows);
    if (!err2) {
      return { count: rows.length, error: null };
    }
    return { count: 0, error: err1 || err2 };
  } catch (err: any) {
    return { count: 0, error: err };
  }
}

/**
 * SQL Schema for Supabase SQL Editor if user wishes to run it
 */
export const SUPABASE_SQL_SETUP = `-- Script de creación de tablas para GeoVentas en Supabase
-- Ejecutar en el SQL Editor de tu proyecto Supabase: https://supabase.com/dashboard/project/jeuqkaidbikwbdquhkaa/sql

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
    code TEXT,
    name TEXT NOT NULL,
    company TEXT,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT NOT NULL,
    city TEXT DEFAULT 'Madrid',
    category TEXT DEFAULT 'Retail',
    "país" TEXT DEFAULT 'España'
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

-- 4. Tabla de Artículos (Catálogo de Productos)
CREATE TABLE IF NOT EXISTS public.articulos (
    referencia INTEGER PRIMARY KEY,
    proveedor TEXT NOT NULL,
    producto TEXT NOT NULL,
    familia TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    precio_coste NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    stock_min INTEGER NOT NULL DEFAULT 0,
    fecha_invent TEXT DEFAULT '31/12/2025',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar permisos de lectura y escritura para la publishable/anon key
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo a anon en vendedores" ON public.vendedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en visitas" ON public.visitas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en articulos" ON public.articulos FOR ALL USING (true) WITH CHECK (true);
`;

