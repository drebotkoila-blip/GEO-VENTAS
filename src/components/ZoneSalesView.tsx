import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Client, Sale, SalesRep, Visit } from '../types';
import { calculateDistanceMeters, formatDistance, isValidCoordinate } from '../utils/geoUtils';
import { sound } from '../utils/audioFeedback';

interface ZoneSalesViewProps {
  clients: Client[];
  sales: Sale[];
  visits: Visit[];
  activeRep: SalesRep;
  onOpenClientSales: (client: Client, visit?: Visit) => void;
  onViewClient: (clientId: string) => void;
  onOpenCheckIn: (visit: Visit) => void;
  onLocateMe: () => void;
}

const RADIUS_OPTIONS = [
  { value: 0, label: 'Toda la zona (Sin límite)' },
  { value: 1, label: '1 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
];

const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  in_progress: '#3b82f6',
  scheduled: '#f59e0b',
  cancelled: '#94a3b8',
};

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completada',
  in_progress: 'En curso',
  scheduled: 'Pendiente',
  cancelled: 'Cancelada',
};

const eur = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const norm = (s?: string) => (s || '').trim().toLowerCase();

export const ZoneSalesView: React.FC<ZoneSalesViewProps> = ({
  clients,
  sales,
  visits,
  activeRep,
  onOpenClientSales,
  onViewClient,
  onOpenCheckIn,
  onLocateMe,
}) => {
  const [zone, setZone] = useState<string>('all');
  const [radiusKm, setRadiusKm] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState<'clients' | 'route'>('clients');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);

  const repCoords = activeRep?.currentCoords;
  const today = todayStr();

  // Sales total per client (by id/code or exact name)
  const salesByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sales) {
      const amount = Number(s.importe) || 0;
      const id = norm(s.idCliente);
      const name = norm(s.cliente);
      if (id) m.set('id:' + id, (m.get('id:' + id) || 0) + amount);
      if (name) m.set('name:' + name, (m.get('name:' + name) || 0) + amount);
    }
    return m;
  }, [sales]);

  const clientSalesTotal = (c: Client) => {
    const byId = salesByKey.get('id:' + norm(c.id)) || (c.code ? salesByKey.get('id:' + norm(c.code)) : 0) || 0;
    if (byId) return byId;
    return salesByKey.get('name:' + norm(c.name)) || salesByKey.get('name:' + norm(c.company)) || 0;
  };

  // Zones = cities
  const zones = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of clients) {
      const city = (c.city || '').trim();
      if (!city) continue;
      m.set(city, (m.get(city) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [clients]);

  const todaysVisits = useMemo(
    () =>
      visits
        .filter((v) => v.repId === activeRep?.id && v.scheduledDate === today)
        .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || '')),
    [visits, activeRep, today]
  );

  const visitTodayByClient = useMemo(() => {
    const m = new Map<string, Visit>();
    for (const v of visits) if (v.scheduledDate === today) m.set(v.clientId, v);
    return m;
  }, [visits, today]);

  const enriched = useMemo(() => {
    return clients.map((c) => {
      const valid = isValidCoordinate(c.coords);
      const distance = valid && repCoords && isValidCoordinate(repCoords) ? calculateDistanceMeters(repCoords, c.coords) : null;
      return { client: c, valid, distance, total: clientSalesTotal(c), visitToday: visitTodayByClient.get(c.id) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, repCoords, salesByKey, visitTodayByClient]);

  const filtered = useMemo(() => {
    const q = norm(search);
    return enriched
      .filter((e) => {
        if (zone !== 'all' && (e.client.city || '').trim() !== zone) return false;
        if (radiusKm > 0 && (e.distance === null || e.distance > radiusKm * 1000)) return false;
        if (q) {
          const hay = `${e.client.name} ${e.client.company} ${e.client.address} ${e.client.city} ${e.client.contactName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [enriched, zone, radiusKm, search]);

  const zoneTotal = filtered.reduce((acc, e) => acc + e.total, 0);

  // ---- Map ----
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: false, center: [40.4, -3.7], zoom: 5 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    routeLayer.current = L.layerGroup().addTo(map);
    markersLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;
    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  const fitZone = () => {
    const map = mapInstance.current;
    if (!map) return;
    const pts = filtered.filter((e) => e.valid).map((e) => [e.client.coords.lat, e.client.coords.lng] as [number, number]);
    if (repCoords && isValidCoordinate(repCoords) && radiusKm > 0) pts.push([repCoords.lat, repCoords.lng]);
    if (pts.length === 0) return;
    if (pts.length === 1) map.setView(pts[0], 14);
    else map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
  };

  const fitRoute = () => {
    const map = mapInstance.current;
    if (!map) return;
    const pts: [number, number][] = [];
    if (repCoords && isValidCoordinate(repCoords)) pts.push([repCoords.lat, repCoords.lng]);
    for (const v of todaysVisits) {
      const c = clients.find((cl) => cl.id === v.clientId);
      if (c && isValidCoordinate(c.coords)) pts.push([c.coords.lat, c.coords.lng]);
    }
    if (pts.length === 0) return;
    if (pts.length === 1) map.setView(pts[0], 14);
    else map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
  };

  const centerOnMe = () => {
    sound.playClick();
    onLocateMe();
    const map = mapInstance.current;
    if (map && repCoords && isValidCoordinate(repCoords)) map.setView([repCoords.lat, repCoords.lng], 13);
  };

  // Draw markers
  useEffect(() => {
    const layer = markersLayer.current;
    const rLayer = routeLayer.current;
    if (!layer || !rLayer) return;
    layer.clearLayers();
    rLayer.clearLayers();

    for (const e of filtered) {
      if (!e.valid) continue;
      const v = e.visitToday;
      const color = v ? STATUS_COLORS[v.status] || '#7c3aed' : '#7c3aed';
      const highlighted = hoveredId === e.client.id;
      const size = highlighted ? 34 : 28;
      const icon = L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;color:white;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></svg>
        </div>`,
      });
      const m = L.marker([e.client.coords.lat, e.client.coords.lng], { icon });
      m.bindTooltip(
        `<strong>${e.client.name}</strong><br/>${e.client.city || ''} · ${eur(e.total)} en ventas`,
        { direction: 'top', offset: [0, -12] }
      );
      m.on('dblclick', () => {
        sound.playClick();
        onOpenClientSales(e.client, e.visitToday);
      });
      m.on('click', () => onViewClient(e.client.id));
      m.addTo(layer);
    }

    // Rep marker
    if (repCoords && isValidCoordinate(repCoords)) {
      const repIcon = L.divIcon({
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: `<div style="width:30px;height:30px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 0 0 6px rgba(37,99,235,.2),0 2px 6px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;color:white;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>
        </div>`,
      });
      L.marker([repCoords.lat, repCoords.lng], { icon: repIcon, zIndexOffset: 1000 })
        .bindTooltip(`<strong>${activeRep.name}</strong><br/>Posición GPS actual`, { direction: 'top', offset: [0, -14] })
        .addTo(layer);

      if (radiusKm > 0) {
        L.circle([repCoords.lat, repCoords.lng], {
          radius: radiusKm * 1000,
          color: '#2563eb',
          weight: 1.5,
          fillColor: '#2563eb',
          fillOpacity: 0.06,
          dashArray: '6 6',
        }).addTo(rLayer);
      }

      // Today's route polyline
      const routePts: [number, number][] = [[repCoords.lat, repCoords.lng]];
      for (const v of todaysVisits) {
        const c = clients.find((cl) => cl.id === v.clientId);
        if (c && isValidCoordinate(c.coords)) routePts.push([c.coords.lat, c.coords.lng]);
      }
      if (routePts.length > 1) {
        L.polyline(routePts, { color: '#2563eb', weight: 3, opacity: 0.7, dashArray: '8 8' }).addTo(rLayer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, hoveredId, repCoords, radiusKm, todaysVisits]);

  // Refit when zone / radius changes
  useEffect(() => {
    fitZone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, radiusKm]);

  const topZones = zones.slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-blue-600">
              Supervisión geográfica & comercial
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Doble clic en cliente para ver ventas
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">Ventas por Zona</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Filtra clientes por zona geográfica, visualiza su ubicación exacta y haz doble clic sobre cualquier pin o cliente
            para consultar todas sus ventas y artículos.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-slate-800">{activeRep?.name}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">
            {todaysVisits.filter((v) => v.status === 'completed').length}/{todaysVisits.length} paradas hoy
          </span>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2.5 text-xs">
        <label className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span className="text-slate-500">Zona:</span>
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="bg-transparent font-semibold text-slate-800 focus:outline-none max-w-[200px]"
          >
            <option value="all">Todas las Zonas ({clients.length})</option>
            {zones.map(([z, n]) => (
              <option key={z} value={z}>
                {z} ({n})
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setZone('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
              zone === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas ({clients.length})
          </button>
          {topZones.map(([z, n]) => (
            <button
              key={z}
              onClick={() => setZone(z)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                zone === z ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {z} ({n})
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
          <span className="text-slate-500">Radio:</span>
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="bg-transparent font-semibold text-slate-800 focus:outline-none"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <div className="relative ml-auto w-full sm:w-64">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente en zona..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col lg:h-[640px]">
          <div className="px-3 pt-3 flex items-center justify-between gap-2">
            <div className="flex items-center bg-slate-100 rounded-lg p-1 text-xs">
              <button
                onClick={() => setPanel('clients')}
                className={`px-2.5 py-1 rounded-md font-semibold ${panel === 'clients' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                Clientes en Zona ({filtered.length})
              </button>
              <button
                onClick={() => setPanel('route')}
                className={`px-2.5 py-1 rounded-md font-semibold ${panel === 'route' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                Ruta de Hoy ({todaysVisits.length})
              </button>
            </div>
            <button
              onClick={() => {
                setZone('all');
                setRadiusKm(0);
                setSearch('');
              }}
              className="text-[11px] text-slate-400 hover:text-slate-700"
            >
              Vista global
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 px-3 py-3 border-b border-slate-100 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Clientes</div>
              <div className="text-base font-bold text-slate-900">{filtered.length}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Ventas zona</div>
              <div className="text-base font-bold text-emerald-600">{eur(zoneTotal)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">En ruta hoy</div>
              <div className="text-base font-bold text-blue-600">{todaysVisits.length} clientes</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[520px] lg:max-h-none">
            {panel === 'clients' && (
              <>
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-[11px] text-emerald-800">
                  <span>🛒</span>
                  <span>
                    <strong>Tip de Ventas:</strong> haz <strong>doble clic</strong> en cualquier cliente o pin para abrir sus
                    ventas del último año y artículos comprados.
                  </span>
                </div>
                {filtered.length === 0 && (
                  <div className="text-center text-xs text-slate-400 py-10">No hay clientes con estos filtros.</div>
                )}
                {filtered.map((e) => {
                  const v = e.visitToday;
                  return (
                    <div
                      key={e.client.id}
                      onDoubleClick={() => {
                        sound.playClick();
                        onOpenClientSales(e.client, v);
                      }}
                      onMouseEnter={() => setHoveredId(e.client.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="border border-slate-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer select-none"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[13px] font-bold text-slate-900 truncate">{e.client.name}</span>
                            {e.client.category && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                {e.client.category}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {[e.client.address, e.client.city].filter(Boolean).join(', ')}
                          </div>
                          {e.client.contactName && (
                            <div className="text-[11px] text-slate-500">
                              Contacto: <span className="text-slate-700">{e.client.contactName}</span>
                            </div>
                          )}
                        </div>
                        {v ? (
                          <span
                            className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                            style={{ color: STATUS_COLORS[v.status], borderColor: STATUS_COLORS[v.status] + '55' }}
                          >
                            {v.scheduledTime} · {STATUS_LABEL[v.status]}
                          </span>
                        ) : (
                          <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] text-slate-400 border border-slate-200">
                            Sin visita hoy
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2.5">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="font-mono text-slate-500">
                            {e.distance !== null ? formatDistance(e.distance) : '—'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold ${
                              e.total > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {eur(e.total)} en ventas
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              sound.playClick();
                              onOpenClientSales(e.client, v);
                            }}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                          >
                            Ver Ventas
                          </button>
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onViewClient(e.client.id);
                            }}
                            title="Ficha del cliente"
                            className="w-6 h-6 rounded-full border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center text-[11px] font-bold"
                          >
                            i
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {panel === 'route' && (
              <>
                {todaysVisits.length === 0 && (
                  <div className="text-center text-xs text-slate-400 py-10">
                    {activeRep?.name} no tiene visitas programadas para hoy.
                  </div>
                )}
                {todaysVisits.map((v, i) => {
                  const c = clients.find((cl) => cl.id === v.clientId);
                  const dist =
                    c && isValidCoordinate(c.coords) && repCoords && isValidCoordinate(repCoords)
                      ? calculateDistanceMeters(repCoords, c.coords)
                      : null;
                  return (
                    <div
                      key={v.id}
                      onDoubleClick={() => c && onOpenClientSales(c, v)}
                      className="border border-slate-200 rounded-lg p-3 flex items-start gap-3"
                    >
                      <div className="text-center shrink-0">
                        <div className="font-mono text-xs font-bold text-slate-900">{v.scheduledTime}</div>
                        <div className="text-[10px] text-slate-400">#{i + 1}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-slate-900 truncate">{c?.name || 'Cliente'}</div>
                        <div className="text-[11px] text-slate-500 truncate">{v.objective}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                            style={{ color: STATUS_COLORS[v.status], borderColor: STATUS_COLORS[v.status] + '55' }}
                          >
                            {STATUS_LABEL[v.status]}
                          </span>
                          {dist !== null && <span className="font-mono text-[11px] text-slate-500">{formatDistance(dist)}</span>}
                        </div>
                      </div>
                      {v.status !== 'completed' && v.status !== 'cancelled' && (
                        <button
                          onClick={() => {
                            sound.playClick();
                            onOpenCheckIn(v);
                          }}
                          className="shrink-0 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold"
                        >
                          {v.status === 'in_progress' ? 'Check-out' : 'Check-in'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Map panel */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 text-xs">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              Mapa de Ruta & Clientes
            </span>
            {[
              ['Completada', STATUS_COLORS.completed],
              ['En curso', STATUS_COLORS.in_progress],
              ['Pendiente', STATUS_COLORS.scheduled],
              ['Clientes de Zona', '#7c3aed'],
            ].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1 text-slate-500">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {label}
              </span>
            ))}
            <div className="w-full flex items-center gap-2">
              <button onClick={fitZone} className="px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700">
                Encuadrar Zona
              </button>
              <button onClick={fitRoute} className="px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700">
                Ajustar Ruta
              </button>
              <button onClick={centerOnMe} className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                Mi GPS
              </button>
            </div>
          </div>
          <div className="relative">
            <div ref={mapRef} className="h-[460px] lg:h-[560px] w-full z-0" />
            <div className="absolute top-3 right-3 z-[400] bg-slate-900/85 text-white text-[11px] px-2.5 py-1.5 rounded-lg pointer-events-none">
              Haz <strong>doble clic</strong> en un cliente para ver sus ventas
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
