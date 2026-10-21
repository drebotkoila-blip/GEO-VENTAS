import React from 'react';
import { SalesRep, Client, Visit } from '../types';

interface SupervisorDashboardViewProps {
  salesReps: SalesRep[];
  clients: Client[];
  visits: Visit[];
  selectedRepId: string;
  onSelectRep: (repId: string) => void;
  onSelectClient: (clientId: string) => void;
  onOpenCheckInModal?: (visit: Visit) => void;
}

export const SupervisorDashboardView: React.FC<SupervisorDashboardViewProps> = ({
  salesReps,
  clients,
  visits,
  selectedRepId,
  onSelectRep,
  onSelectClient,
}) => {
  const totalVisits = visits.length;
  const completedVisits = visits.filter((v) => v.status === 'completed').length;
  const inProgressVisits = visits.filter((v) => v.status === 'in_progress').length;
  const scheduledVisits = visits.filter((v) => v.status === 'scheduled').length;

  const totalSalesRevenue = visits.reduce((acc, v) => acc + (v.saleAmount || 0), 0);
  const totalDistanceKm = salesReps.reduce((acc, r) => acc + r.totalDistanceKmToday, 0);

  // Geofence compliance rate
  const verifiedCheckIns = visits.filter((v) => v.checkInTime && v.isWithinGeofence).length;
  const totalCheckIns = visits.filter((v) => v.checkInTime).length;
  const geofenceCompliancePct = totalCheckIns > 0 ? Math.round((verifiedCheckIns / totalCheckIns) * 100) : 100;

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

      {/* SALES REPS FLEET STATUS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Equipo Comercial en Terreno</h3>
            <p className="text-xs text-slate-500">Monitoreo de telemetría y ubicación GPS de cada vendedor</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Territorio</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Último Ping GPS</th>
                <th className="px-4 py-3 text-right">Velocidad</th>
                <th className="px-4 py-3 text-right">Batería</th>
                <th className="px-4 py-3 text-right">Distancia</th>
                <th className="px-4 py-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesReps.map((rep) => {
                const isSelected = rep.id === selectedRepId;
                const repVisits = visits.filter((v) => v.repId === rep.id);
                const comp = repVisits.filter((v) => v.status === 'completed').length;

                return (
                  <tr
                    key={rep.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-blue-50/40 font-medium' : ''
                    }`}
                  >
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
                      <button
                        onClick={() => onSelectRep(rep.id)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? 'Seleccionado' : 'Ver en Mapa'}
                      </button>
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
