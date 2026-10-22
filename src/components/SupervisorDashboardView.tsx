import React, { useState } from 'react';
import { SalesRep, Client, Visit } from '../types';
import { sound } from '../utils/audioFeedback';

interface SupervisorDashboardViewProps {
  salesReps: SalesRep[];
  clients: Client[];
  visits: Visit[];
  selectedRepId: string;
  onSelectRep: (repId: string) => void;
  onSelectClient: (clientId: string) => void;
  onOpenCheckInModal?: (visit: Visit) => void;
  onEditEmployee?: (rep: SalesRep) => void;
  onDeleteEmployee?: (repId: string) => void;
  onDeleteMultipleEmployees?: (repIds: string[]) => void;
}

export const SupervisorDashboardView: React.FC<SupervisorDashboardViewProps> = ({
  salesReps,
  clients,
  visits,
  selectedRepId,
  onSelectRep,
  onSelectClient,
  onOpenCheckInModal,
  onEditEmployee,
  onDeleteEmployee,
  onDeleteMultipleEmployees,
}) => {
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([]);

  const totalVisits = visits.length;
  const completedVisits = visits.filter((v) => v.status === 'completed').length;
  const inProgressVisits = visits.filter((v) => v.status === 'in_progress').length;

  const totalSalesRevenue = visits.reduce((acc, v) => acc + (v.saleAmount || 0), 0);
  const totalDistanceKm = salesReps.reduce((acc, r) => acc + r.totalDistanceKmToday, 0);

  // Geofence compliance rate
  const verifiedCheckIns = visits.filter((v) => v.checkInTime && v.isWithinGeofence).length;
  const totalCheckIns = visits.filter((v) => v.checkInTime).length;
  const geofenceCompliancePct = totalCheckIns > 0 ? Math.round((verifiedCheckIns / totalCheckIns) * 100) : 100;

  // Multi selection
  const handleToggleSelect = (repId: string) => {
    sound.playClick();
    setSelectedRepIds((prev) =>
      prev.includes(repId) ? prev.filter((id) => id !== repId) : [...prev, repId]
    );
  };

  const handleSelectAll = () => {
    sound.playClick();
    if (selectedRepIds.length === salesReps.length) {
      setSelectedRepIds([]);
    } else {
      setSelectedRepIds(salesReps.map((r) => r.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedRepIds.length === 0 || !onDeleteMultipleEmployees) return;
    sound.playClick();
    const count = selectedRepIds.length;
    if (window.confirm(`¿Eliminar o dar de baja a los ${count} vendedores seleccionados?`)) {
      onDeleteMultipleEmployees(selectedRepIds);
      setSelectedRepIds([]);
    }
  };

  const isAllSelected = salesReps.length > 0 && selectedRepIds.length === salesReps.length;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Efectividad de Rutas</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">{completedVisits}</span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">/ {totalVisits} visitas</span>
          </div>
          <span className="text-[11px] text-blue-600 font-medium">
            {inProgressVisits} en curso ahora
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Ventas Totales Hoy</span>
          <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
            {totalSalesRevenue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Cierre comercial equipo</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Cumplimiento Geocercas</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">{geofenceCompliancePct}%</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">
            Check-ins validados por GPS
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Kilómetros Flota</span>
          <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
            {totalDistanceKm.toFixed(1)} <span className="text-xs font-normal text-slate-500">km</span>
          </span>
          <span className="text-[11px] text-slate-500">{salesReps.length} vendedores activos</span>
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedRepIds.length > 0 && onDeleteMultipleEmployees && (
        <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
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
              <span>Eliminar Selección ({selectedRepIds.length})</span>
            </button>

            <button
              onClick={() => setSelectedRepIds([])}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 transition-colors"
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* SALES REPS FLEET STATUS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Equipo Comercial en Terreno</h3>
            <p className="text-xs text-slate-500">Monitoreo de telemetría, edición de datos y selección de registros</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {salesReps.length} vendedores
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Territorio</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Último Ping GPS</th>
                <th className="px-4 py-3 text-right">Velocidad</th>
                <th className="px-4 py-3 text-right">Batería</th>
                <th className="px-4 py-3 text-right">Distancia</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesReps.map((rep) => {
                const isCurrentActive = rep.id === selectedRepId;
                const isSelected = selectedRepIds.includes(rep.id);

                return (
                  <tr
                    key={rep.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isSelected
                        ? 'bg-blue-50/50'
                        : isCurrentActive
                        ? 'bg-slate-50/70 font-medium'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(rep.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-[11px]">
                          {rep.name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 block">{rep.name}</span>
                          <span className="text-[11px] text-slate-500">{rep.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{rep.territory}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            rep.status === 'in_meeting'
                              ? 'bg-teal-500'
                              : rep.status === 'on_route'
                              ? 'bg-blue-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span className="text-slate-700">
                          {rep.status === 'in_meeting'
                            ? 'En Cliente'
                            : rep.status === 'on_route'
                            ? 'En Ruta'
                            : 'Disponible'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-500">
                      Hace {Math.max(1, Math.round((Date.now() - new Date(rep.lastPing).getTime()) / 1000))}s
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {rep.speedKmH} km/h
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {rep.batteryLevel}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {rep.totalDistanceKmToday.toFixed(1)} km
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {onEditEmployee && (
                          <button
                            onClick={() => {
                              sound.playClick();
                              onEditEmployee(rep);
                            }}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar vendedor"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"/>
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                            </svg>
                          </button>
                        )}

                        <button
                          onClick={() => onSelectRep(rep.id)}
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            isCurrentActive
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {isCurrentActive ? 'En Foco' : 'Ver Mapa'}
                        </button>

                        {onDeleteEmployee && (
                          <button
                            onClick={() => {
                              sound.playClick();
                              if (window.confirm(`¿Eliminar al vendedor ${rep.name}?`)) {
                                onDeleteEmployee(rep.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar vendedor"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
