import React, { useMemo, useState } from 'react';
import { Sale, SalesRep, Visit } from '../types';
import { sound } from '../utils/audioFeedback';

interface ComercialesViewProps {
  salesReps: SalesRep[];
  visits: Visit[];
  sales: Sale[];
  onOpenNewEmployeeModal: () => void;
  onEditEmployee: (rep: SalesRep) => void;
  onViewVisits: (repId: string) => void;
  onDeleteEmployee: (repId: string) => void;
  onDeleteMultipleEmployees: (repIds: string[]) => void;
  onOpenSupabaseModal: () => void;
}

const MONTHLY_TARGET = 25000;

const norm = (s?: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');

const initials = (name: string) =>
  name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

const isSupervisor = (r: SalesRep) => /supervis|jefe|director|manager/i.test(r.roleTitle || '');

export const ComercialesView: React.FC<ComercialesViewProps> = ({
  salesReps,
  visits,
  sales,
  onOpenNewEmployeeModal,
  onEditEmployee,
  onViewVisits,
  onDeleteEmployee,
  onDeleteMultipleEmployees,
  onOpenSupabaseModal,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'rep' | 'sup'>('all');
  const [selected, setSelected] = useState<string[]>([]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Sales totals by normalized seller name (word order independent: "Fuller, Andrew" == "Andrew Fuller")
  const salesBySeller = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sales) {
      const k = norm(s.vendedor);
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + (Number(s.importe) || 0));
    }
    return m;
  }, [sales]);

  const rows = useMemo(
    () =>
      salesReps.map((r) => {
        const repVisits = visits.filter((v) => v.repId === r.id);
        const clientsSet = new Set(repVisits.map((v) => v.clientId));
        const visitSales = repVisits.reduce((a, v) => a + (v.saleAmount || 0), 0);
        const total = (salesBySeller.get(norm(r.name)) || 0) + visitSales;
        return {
          rep: r,
          supervisor: isSupervisor(r),
          clients: clientsSet.size,
          visits: repVisits.length,
          visitsToday: repVisits.filter((v) => v.scheduledDate === todayStr).length,
          completedToday: repVisits.filter((v) => v.scheduledDate === todayStr && v.status === 'completed').length,
          total,
        };
      }),
    [salesReps, visits, salesBySeller, todayStr]
  );

  const filtered = rows.filter((row) => {
    if (roleFilter === 'rep' && row.supervisor) return false;
    if (roleFilter === 'sup' && !row.supervisor) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${row.rep.name} ${row.rep.territory} ${row.rep.email}`.toLowerCase().includes(q);
  });

  const supCount = rows.filter((r) => r.supervisor).length;
  const totalSales = rows.reduce((a, r) => a + r.total, 0);
  const visitsToday = rows.reduce((a, r) => a + r.visitsToday, 0);
  const completedToday = rows.reduce((a, r) => a + r.completedToday, 0);
  const managedClients = new Set(visits.map((v) => v.clientId)).size;
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.includes(r.rep.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
            Fuerza de ventas & estructura comercial
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">Gestión de Comerciales</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Alta y sincronización de comerciales desde ventas, relaciones de bases de datos y asignación de rutas.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={onOpenSupabaseModal}
            className="px-3 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 bg-white"
          >
            &lt;/&gt; Código SQL Supabase
          </button>
          <button
            onClick={() => {
              sound.playClick();
              onOpenNewEmployeeModal();
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
          >
            + Dar de Alta Comercial
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi title="Equipo Comercial" value={String(rows.length)} sub={`${rows.length - supCount} comerciales · ${supCount} supervisor(es)`} />
        <Kpi title="Clientes Gestionados" value={String(managedClients)} sub="Con asignaciones comerciales" />
        <Kpi title="Visitas Programadas Hoy" value={String(visitsToday)} sub={`${completedToday} ya completadas`} />
        <Kpi
          title="Ventas Globales"
          value={totalSales.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'}
          sub="Facturación acumulada del equipo"
          valueCls="text-emerald-600"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar comercial por nombre, territorio o email..."
            className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs">
            {[
              ['all', `Todos (${rows.length})`],
              ['rep', `Comerciales (${rows.length - supCount})`],
              ['sup', `Supervisores (${supCount})`],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setRoleFilter(id as typeof roleFilter)}
                className={`px-2.5 py-1 rounded-md font-semibold ${roleFilter === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : filtered.map((r) => r.rep.id))} />
            Seleccionar todos los visibles ({filtered.length})
          </label>
          {selected.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm(`¿Dar de baja ${selected.length} comerciales?`)) {
                  onDeleteMultipleEmployees(selected);
                  setSelected([]);
                }
              }}
              className="px-2.5 py-1 rounded-md bg-red-600 text-white font-semibold"
            >
              Eliminar {selected.length}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
              <th className="px-3 py-3 w-8"></th>
              <th className="px-3 py-3 text-left font-semibold">Comercial</th>
              <th className="px-3 py-3 text-left font-semibold">Rol</th>
              <th className="px-3 py-3 text-left font-semibold">Contacto</th>
              <th className="px-3 py-3 text-center font-semibold">Clientes</th>
              <th className="px-3 py-3 text-center font-semibold">Visitas</th>
              <th className="px-3 py-3 text-right font-semibold">Ventas (€) / Meta</th>
              <th className="px-3 py-3 text-left font-semibold">Estado</th>
              <th className="px-3 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((row) => {
              const r = row.rep;
              const pct = Math.round((row.total / MONTHLY_TARGET) * 100);
              const active = r.status !== 'offline';
              return (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={() => setSelected((p) => (p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id]))}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                        {initials(r.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{r.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">ID: {r.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
                        row.supervisor ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {row.supervisor ? 'Supervisor' : 'Comercial'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <div className="text-slate-700 truncate">{r.email || '—'}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{r.phone}</div>
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold text-slate-800">{row.clients}</td>
                  <td className="px-3 py-2.5 text-center font-semibold text-slate-800">{row.visits}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-mono font-bold text-emerald-600">{row.total.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</div>
                    <div className="text-[10px] text-slate-400">
                      Meta: {MONTHLY_TARGET.toLocaleString('es-ES')} € ({pct}%)
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => onEditEmployee(r)} className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700">
                        Editar
                      </button>
                      <button onClick={() => onViewVisits(r.id)} className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700">
                        Visitas
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`¿Dar de baja a ${r.name}?`)) onDeleteEmployee(r.id);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Eliminar"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-slate-400 py-10">No hay comerciales con estos filtros.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Kpi: React.FC<{ title: string; value: string; sub: string; valueCls?: string }> = ({ title, value, sub, valueCls = 'text-slate-900' }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4">
    <div className="text-[11px] font-semibold text-slate-500">{title}</div>
    <div className={`text-2xl font-bold font-mono mt-1 ${valueCls}`}>{value}</div>
    <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
  </div>
);
