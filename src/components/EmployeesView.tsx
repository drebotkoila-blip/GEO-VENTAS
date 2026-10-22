import React, { useState } from 'react';
import { SalesRep, Visit } from '../types';
import { sound } from '../utils/audioFeedback';

interface EmployeesViewProps {
  salesReps: SalesRep[];
  visits: Visit[];
  onOpenNewEmployeeModal: () => void;
  onEditEmployee: (rep: SalesRep) => void;
  onSelectRepAndGoToMap: (repId: string) => void;
  onSelectRepAndGoToRoute: (repId: string) => void;
  onDeleteEmployee: (repId: string) => void;
  onDeleteMultipleEmployees: (repIds: string[]) => void;
  onScheduleVisitForRep: (repId: string) => void;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  salesReps,
  visits,
  onOpenNewEmployeeModal,
  onEditEmployee,
  onSelectRepAndGoToMap,
  onSelectRepAndGoToRoute,
  onDeleteEmployee,
  onDeleteMultipleEmployees,
  onScheduleVisitForRep,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [territoryFilter, setTerritoryFilter] = useState('all');
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([]);

  // Filter territories
  const territories = Array.from(new Set(salesReps.map((r) => r.territory)));

  const filteredReps = salesReps.filter((rep) => {
    if (territoryFilter !== 'all' && rep.territory !== territoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        rep.name.toLowerCase().includes(q) ||
        rep.email.toLowerCase().includes(q) ||
        rep.territory.toLowerCase().includes(q) ||
        (rep.dni && rep.dni.toLowerCase().includes(q)) ||
        (rep.roleTitle && rep.roleTitle.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeInFieldCount = salesReps.filter((r) => r.status === 'on_route' || r.status === 'in_meeting').length;
  const totalSalesToday = visits.reduce((acc, v) => acc + (v.saleAmount || 0), 0);

  // Toggle selection
  const handleToggleSelect = (repId: string) => {
    sound.playClick();
    setSelectedRepIds((prev) =>
      prev.includes(repId) ? prev.filter((id) => id !== repId) : [...prev, repId]
    );
  };

  const handleSelectAll = () => {
    sound.playClick();
    if (selectedRepIds.length === filteredReps.length) {
      setSelectedRepIds([]);
    } else {
      setSelectedRepIds(filteredReps.map((r) => r.id));
    }
  };

  const handleClearSelection = () => {
    sound.playClick();
    setSelectedRepIds([]);
  };

  const handleDeleteSelected = () => {
    if (selectedRepIds.length === 0) return;
    sound.playClick();
    const count = selectedRepIds.length;
    if (window.confirm(`¿Dar de baja o eliminar ${count} vendedor(es) seleccionado(s)?`)) {
      onDeleteMultipleEmployees(selectedRepIds);
      setSelectedRepIds([]);
    }
  };

  const isAllSelected = filteredReps.length > 0 && selectedRepIds.length === filteredReps.length;

  const getVehicleLabel = (type?: string) => {
    switch (type) {
      case 'car':
        return 'Coche de Empresa';
      case 'motorcycle':
        return 'Motocicleta';
      case 'transit':
        return 'Transporte Público';
      case 'walking':
        return 'A pie';
      default:
        return 'Vehículo Comercial';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Directorio de Vendedores y Equipo Comercial
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión de altas, edición de datos, selección múltiple y seguimiento GPS de cada vendedor
          </p>
        </div>

        <button
          onClick={() => {
            sound.playClick();
            onOpenNewEmployeeModal();
          }}
          className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>+ Dar de Alta Vendedor</span>
        </button>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block">Total Vendedores</span>
          <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
            {salesReps.length}
          </span>
          <span className="text-[11px] text-slate-400">Vendedores registrados</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block">En Terreno Ahora</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-blue-600 font-mono tabular-nums">
              {activeInFieldCount}
            </span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">/ {salesReps.length}</span>
          </div>
          <span className="text-[11px] text-blue-600 font-medium">Transmitiendo GPS</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block">Zonas Comerciales</span>
          <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
            {territories.length}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Territorios cubiertos</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block">Facturación Equipo Hoy</span>
          <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
            {totalSalesToday.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Ventas reportadas</span>
        </div>
      </div>

      {/* Filters & Selection Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-sm">
            <div className="relative w-full">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre, correo, zona, DNI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Territorio:</span>
            <select
              value={territoryFilter}
              onChange={(e) => setTerritoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los Territorios</option>
              {territories.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Multi-Selection Control Header */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700 hover:text-slate-900">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
            />
            <span>Seleccionar todos los vendedores ({filteredReps.length})</span>
          </label>

          <span className="text-slate-400 font-mono">
            {filteredReps.length} de {salesReps.length} vendedores
          </span>
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedRepIds.length > 0 && (
        <div className="sticky top-4 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold font-mono">
              {selectedRepIds.length}
            </span>
            <span className="text-xs font-semibold">
              {selectedRepIds.length === 1 ? '1 vendedor seleccionado' : `${selectedRepIds.length} vendedores seleccionados`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteSelected}
              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              <span>Eliminar en Grupo ({selectedRepIds.length})</span>
            </button>

            <button
              onClick={handleClearSelection}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 transition-colors"
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReps.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">No se encontraron vendedores</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No hay vendedores que coincidan con la búsqueda. Puedes registrar un nuevo vendedor con el botón superior.
            </p>
          </div>
        ) : (
          filteredReps.map((rep) => {
            const isSelected = selectedRepIds.includes(rep.id);
            const repVisits = visits.filter((v) => v.repId === rep.id);
            const completedVisits = repVisits.filter((v) => v.status === 'completed').length;

            const statusConfig = {
              on_route: { label: 'En Ruta', bg: 'bg-blue-600', badgeBg: 'bg-blue-50 text-blue-800' },
              in_meeting: { label: 'En Visita', bg: 'bg-teal-600', badgeBg: 'bg-teal-50 text-teal-800' },
              available: { label: 'Disponible', bg: 'bg-emerald-600', badgeBg: 'bg-emerald-50 text-emerald-800' },
              offline: { label: 'Desconectado', bg: 'bg-slate-400', badgeBg: 'bg-slate-100 text-slate-700' },
            }[rep.status] || { label: 'Disponible', bg: 'bg-emerald-600', badgeBg: 'bg-emerald-50 text-emerald-800' };

            return (
              <div
                key={rep.id}
                className={`bg-white rounded-2xl border transition-all flex flex-col justify-between space-y-4 p-5 ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/15 shadow-sm'
                    : 'border-slate-200 shadow-xs hover:shadow-md'
                }`}
              >
                <div>
                  {/* Top info row with Selector Checkbox */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(rep.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                      />
                      <div className="relative">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                          {rep.name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusConfig.bg}`}
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{rep.name}</h3>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {rep.roleTitle || 'Comercial de Terreno'}
                        </p>
                        {rep.dni && (
                          <span className="text-[10px] text-slate-400 font-mono">DNI: {rep.dni}</span>
                        )}
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConfig.badgeBg}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Territory & Vehicle */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Territorio:</span>
                      <span className="font-semibold text-slate-800">{rep.territory}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Transporte:</span>
                      <span className="text-slate-700">{getVehicleLabel(rep.vehicleType)}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Contacto:</span>
                      <div className="flex items-center gap-2">
                        <a href={`tel:${rep.phone}`} className="text-blue-600 hover:underline font-mono">
                          {rep.phone}
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Real-time telemetry summary */}
                  <div className="mt-3 bg-slate-50 rounded-xl p-2.5 border border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Visitas</span>
                      <span className="font-mono tabular-nums font-bold text-slate-800">
                        {completedVisits}/{repVisits.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Recorrido</span>
                      <span className="font-mono tabular-nums font-bold text-slate-800">
                        {rep.totalDistanceKmToday.toFixed(1)} km
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Batería</span>
                      <span className="font-mono tabular-nums font-bold text-slate-800">
                        {rep.batteryLevel}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* EDIT VENDEDOR BUTTON */}
                    <button
                      onClick={() => {
                        sound.playClick();
                        onEditEmployee(rep);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition-colors flex items-center gap-1"
                      title="Editar ficha del vendedor"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        onSelectRepAndGoToMap(rep.id);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors flex items-center gap-1"
                      title="Ver posición en el mapa en vivo"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polygon points="12 8 8 12 12 16 12 8"/>
                      </svg>
                      <span>Mapa</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        onSelectRepAndGoToRoute(rep.id);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                      title="Ver su ruta diaria de visitas"
                    >
                      Ruta
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        onScheduleVisitForRep(rep.id);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                      title="Asignar una nueva visita a este vendedor"
                    >
                      + Visita
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      sound.playClick();
                      if (window.confirm(`¿Dar de baja o eliminar al vendedor ${rep.name}?`)) {
                        onDeleteEmployee(rep.id);
                      }
                    }}
                    className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    title="Eliminar vendedor individual"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
