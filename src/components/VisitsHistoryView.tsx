import React, { useMemo, useState } from 'react';
import { Client, SalesRep, Visit } from '../types';
import { exportVisitsToCsv } from '../utils/geoUtils';
import { sound } from '../utils/audioFeedback';

interface VisitsHistoryViewProps {
  visits: Visit[];
  clients: Client[];
  salesReps: SalesRep[];
  onNewVisit: () => void;
  onEditVisit: (visit: Visit) => void;
  onDeleteVisit: (visitId: string) => void;
  onDeleteMultipleVisits: (visitIds: string[]) => void;
  onOpenDetail: (visit: Visit, client?: Client) => void;
  initialRepId?: string;
}

type Period = 'all' | 'today' | 'week' | 'month' | 'last30' | 'year' | 'custom';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta Semana' },
  { id: 'month', label: 'Este Mes' },
  { id: 'last30', label: 'Últimos 30 días' },
  { id: 'year', label: 'Este Año' },
  { id: 'custom', label: 'Personalizado' },
];

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Completada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  in_progress: { label: 'En curso', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  scheduled: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDate = (s: string) => {
  const p = (s || '').split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
};
const initials = (name: string) =>
  name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

function periodRange(p: Period, from: string, to: string): [string, string] | null {
  const now = new Date();
  const today = toYmd(now);
  switch (p) {
    case 'all':
      return null;
    case 'today':
      return [today, today];
    case 'week': {
      const d = new Date(now);
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);
      const end = new Date(d);
      end.setDate(d.getDate() + 6);
      return [toYmd(d), toYmd(end)];
    }
    case 'month':
      return [`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
    case 'last30': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return [toYmd(d), today];
    }
    case 'year':
      return [`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`];
    case 'custom':
      return [from || '0000-01-01', to || '9999-12-31'];
  }
}

export const VisitsHistoryView: React.FC<VisitsHistoryViewProps> = ({
  visits,
  clients,
  salesReps,
  onNewVisit,
  onEditVisit,
  onDeleteVisit,
  onDeleteMultipleVisits,
  onOpenDetail,
  initialRepId,
}) => {
  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [repFilter, setRepFilter] = useState(initialRepId || 'all');
  const [clientFilter, setClientFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<'rows' | 'cards'>('rows');
  const [selected, setSelected] = useState<string[]>([]);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const repById = useMemo(() => new Map(salesReps.map((r) => [r.id, r])), [salesReps]);

  const zones = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => c.city && s.add(c.city.trim()));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [clients]);

  const filtered = useMemo(() => {
    const range = periodRange(period, customFrom, customTo);
    const q = search.trim().toLowerCase();
    return visits
      .filter((v) => {
        if (range && (v.scheduledDate < range[0] || v.scheduledDate > range[1])) return false;
        if (repFilter !== 'all' && v.repId !== repFilter) return false;
        if (clientFilter !== 'all' && v.clientId !== clientFilter) return false;
        if (statusFilter !== 'all' && v.status !== statusFilter) return false;
        const c = clientById.get(v.clientId);
        if (zoneFilter !== 'all' && (c?.city || '').trim() !== zoneFilter) return false;
        if (q) {
          const hay = `${c?.name || ''} ${c?.company || ''} ${c?.city || ''} ${c?.address || ''} ${v.objective || ''} ${v.notes || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => `${b.scheduledDate} ${b.scheduledTime}`.localeCompare(`${a.scheduledDate} ${a.scheduledTime}`));
  }, [visits, period, customFrom, customTo, repFilter, clientFilter, zoneFilter, statusFilter, search, clientById]);

  const stats = useMemo(() => {
    const completed = filtered.filter((v) => v.status === 'completed').length;
    const pending = filtered.filter((v) => v.status === 'scheduled' || v.status === 'in_progress').length;
    const salesSum = filtered.reduce((a, v) => a + (v.saleAmount || 0), 0);
    return {
      total: filtered.length,
      completed,
      pct: filtered.length ? Math.round((completed / filtered.length) * 100) : 0,
      pending,
      salesSum,
    };
  }, [filtered]);

  const allSelected = filtered.length > 0 && filtered.every((v) => selected.includes(v.id));

  const exportCsv = () => {
    sound.playClick();
    const rows = filtered.map((v) => {
      const c = clientById.get(v.clientId);
      return {
        ...v,
        repName: repById.get(v.repId)?.name || '',
        clientContact: c?.contactName || c?.name || '',
        clientCompany: c?.company || c?.name || '',
      };
    });
    const blob = new Blob([exportVisitsToCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico_visitas_${toYmd(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const deleteSelected = () => {
    if (selected.length === 0) return;
    if (window.confirm(`¿Eliminar las ${selected.length} visitas seleccionadas?`)) {
      onDeleteMultipleVisits(selected);
      setSelected([]);
    }
  };

  const selectCls =
    'w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-blue-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Histórico de Visitas</h1>
            <p className="text-xs text-slate-500">
              Consulta y auditoría de visitas en filas, filtrado por periodo, comercial, cliente o zona con edición y bajas masivas.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setLayout('rows')}
              className={`px-2.5 py-1.5 font-semibold ${layout === 'rows' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}
            >
              Vista en Filas
            </button>
            <button
              onClick={() => setLayout('cards')}
              className={`px-2.5 py-1.5 font-semibold ${layout === 'cards' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}
            >
              Tarjetas
            </button>
          </div>
          <button onClick={exportCsv} className="px-2.5 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50">
            Exportar CSV ({filtered.length})
          </button>
          <button
            onClick={() => {
              sound.playClick();
              onNewVisit();
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
          >
            + Nueva Visita
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi title="Visitas filtradas" value={String(stats.total)} sub="Total del sistema" />
        <Kpi title="Completadas" value={String(stats.completed)} badge={`${stats.pct}%`} sub="Tasa de cumplimiento" valueCls="text-emerald-600" />
        <Kpi title="Pendientes / En curso" value={String(stats.pending)} sub="Por ejecutar" valueCls="text-amber-600" />
        <Kpi
          title="Ventas cerradas"
          value={stats.salesSum.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'}
          sub="Importe acumulado"
          valueCls="text-emerald-600"
        />
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-slate-500 mr-1">Periodo:</span>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                period === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <span className="flex items-center gap-1.5 ml-2">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="border border-slate-200 rounded-md px-2 py-0.5" />
              <span className="text-slate-400">→</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="border border-slate-200 rounded-md px-2 py-0.5" />
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Filtrar por Comercial</label>
            <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} className={selectCls}>
              <option value="all">Todos los Comerciales ({salesReps.length})</option>
              {salesReps.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Filtrar por Cliente</label>
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={selectCls}>
              <option value="all">Todos los Clientes ({clients.length})</option>
              {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Filtrar por Zona</label>
            <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className={selectCls}>
              <option value="all">Todas las Zonas ({zones.length})</option>
              {zones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Estado de Visita</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="all">Todos los Estados</option>
              <option value="scheduled">Pendiente</option>
              <option value="in_progress">En curso</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Búsqueda Rápida</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente, notas, ciudad..."
              className={selectCls}
            />
          </div>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-blue-800">{selected.length} visitas seleccionadas</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected([])} className="text-slate-500 hover:text-slate-800">Deseleccionar</button>
            <button onClick={deleteSelected} className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold">
              Eliminar seleccionadas
            </button>
          </div>
        </div>
      )}

      {/* Table / Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-sm text-slate-400">
          No hay visitas con estos filtros.
        </div>
      ) : layout === 'rows' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? [] : filtered.map((v) => v.id))}
                  />
                </th>
                <th className="px-3 py-3 text-left font-semibold">Fecha & Hora</th>
                <th className="px-3 py-3 text-left font-semibold">Cliente / Razón social</th>
                <th className="px-3 py-3 text-left font-semibold">Comercial</th>
                <th className="px-3 py-3 text-left font-semibold">Objetivo</th>
                <th className="px-3 py-3 text-center font-semibold">Estado</th>
                <th className="px-3 py-3 text-right font-semibold">Venta (€)</th>
                <th className="px-3 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((v) => {
                const c = clientById.get(v.clientId);
                const r = repById.get(v.repId);
                const st = STATUS_STYLE[v.status] || STATUS_STYLE.scheduled;
                return (
                  <tr key={v.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={selected.includes(v.id)}
                        onChange={() =>
                          setSelected((p) => (p.includes(v.id) ? p.filter((x) => x !== v.id) : [...p, v.id]))
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-800">{fmtDate(v.scheduledDate)}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {v.scheduledTime}
                        {v.durationMinutes ? ` · ${v.durationMinutes}m` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 max-w-[260px]">
                      <div className="font-semibold text-slate-900 truncate">{c?.name || 'Cliente eliminado'}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {[c?.address, c?.city].filter(Boolean).join(', ')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {initials(r?.name || '?')}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">{r?.name || '—'}</div>
                          <div className="text-[10px] text-slate-400 uppercase truncate">{r?.territory}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 max-w-[180px]">
                      <span className="inline-block max-w-full truncate px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600">
                        {v.objective || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">
                      {v.saleAmount ? v.saleAmount.toLocaleString('es-ES') + ' €' : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => onEditVisit(v)} className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700">
                          Editar
                        </button>
                        <button onClick={() => onOpenDetail(v, c)} className="px-2 py-1 rounded-md text-slate-600 hover:bg-slate-50 font-semibold">
                          Detalle
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('¿Eliminar esta visita?')) onDeleteVisit(v.id);
                          }}
                          title="Eliminar"
                          className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((v) => {
            const c = clientById.get(v.clientId);
            const r = repById.get(v.repId);
            const st = STATUS_STYLE[v.status] || STATUS_STYLE.scheduled;
            return (
              <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-700">
                    {fmtDate(v.scheduledDate)} · {v.scheduledTime}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                </div>
                <div className="font-bold text-slate-900 text-sm">{c?.name || 'Cliente eliminado'}</div>
                <div className="text-slate-500 truncate">{[c?.address, c?.city].filter(Boolean).join(', ')}</div>
                <div className="text-slate-600">{v.objective}</div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-500">{r?.name}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => onEditVisit(v)} className="px-2 py-1 rounded-md border border-slate-200 font-semibold">Editar</button>
                    <button onClick={() => onOpenDetail(v, c)} className="px-2 py-1 rounded-md font-semibold text-slate-600">Detalle</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Kpi: React.FC<{ title: string; value: string; sub: string; badge?: string; valueCls?: string }> = ({
  title,
  value,
  sub,
  badge,
  valueCls = 'text-slate-900',
}) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4">
    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">{title}</div>
    <div className="flex items-baseline gap-1.5 mt-1">
      <span className={`text-xl font-bold font-mono ${valueCls}`}>{value}</span>
      {badge && <span className="text-[11px] font-semibold text-emerald-600">{badge}</span>}
    </div>
    <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
  </div>
);
