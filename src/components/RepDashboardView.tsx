import React from 'react';
import { SalesRep, Client, Visit } from '../types';
import { calculateDistanceMeters, formatDistance } from '../utils/geoUtils';

interface RepDashboardViewProps {
  rep: SalesRep;
  clients: Client[];
  visits: Visit[];
  onOpenCheckInModal: (visit: Visit) => void;
  onSelectClient: (clientId: string) => void;
}

export const RepDashboardView: React.FC<RepDashboardViewProps> = ({
  rep,
  clients,
  visits,
  onOpenCheckInModal,
  onSelectClient,
}) => {
  // Filter today's visits for this rep
  const repVisits = visits.filter((v) => v.repId === rep.id);
  const sortedVisits = [...repVisits].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  const completedCount = repVisits.filter((v) => v.status === 'completed').length;
  const inProgressVisit = repVisits.find((v) => v.status === 'in_progress');
  const nextScheduledVisit = repVisits.find((v) => v.status === 'scheduled');
  const totalSales = repVisits.reduce((acc, v) => acc + (v.saleAmount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Daily Progress strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Visitas de Hoy</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">{completedCount}</span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">/ {repVisits.length}</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all"
              style={{ width: `${repVisits.length ? (completedCount / repVisits.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Ventas Cerradas</span>
          <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
            {totalSales.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Facturación generada</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Recorrido en Ruta</span>
          <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
            {rep.totalDistanceKmToday.toFixed(1)} <span className="text-xs font-normal text-slate-500">km</span>
          </span>
          <span className="text-[11px] text-slate-500">GPS verificado</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Estado Actual</span>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                rep.status === 'in_meeting'
                  ? 'bg-teal-500'
                  : rep.status === 'on_route'
                  ? 'bg-blue-500'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="text-sm font-semibold text-slate-800">
              {rep.status === 'in_meeting'
                ? 'En Cliente'
                : rep.status === 'on_route'
                ? 'En Tránsito'
                : 'Disponible'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Bat: {rep.batteryLevel}%</span>
        </div>
      </div>

      {/* ACTIVE VISIT CALLOUT (IF ANY) */}
      {inProgressVisit && (() => {
        const client = clients.find((c) => c.id === inProgressVisit.clientId);
        if (!client) return null;
        return (
          <div className="bg-blue-50/90 border-2 border-blue-500 rounded-xl p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Visita en Curso Ahora</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{client.name}</h3>
                <p className="text-xs text-slate-600">{client.address} · {client.contactName}</p>
              </div>

              <button
                onClick={() => onOpenCheckInModal(inProgressVisit)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <span>Finalizar Visita (Check-out)</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            </div>
          </div>
        );
      })()}

      {/* TODAY'S ITINERARY LIST */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Itinerario y Ruta de Visitas</h3>
            <p className="text-xs text-slate-500">Secuencia de clientes programados para hoy</p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {sortedVisits.length} paradas
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {sortedVisits.map((visit, index) => {
            const client = clients.find((c) => c.id === visit.clientId);
            if (!client) return null;

            const distance = calculateDistanceMeters(rep.currentCoords, client.coords);
            const isInsideGeofence = distance <= client.geofenceRadiusMeters;

            return (
              <div
                key={visit.id}
                className={`p-4 transition-colors hover:bg-slate-50/80 ${
                  visit.status === 'in_progress' ? 'bg-blue-50/30' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Time & Client Info */}
                  <div className="flex items-start gap-3.5">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-mono font-bold text-slate-700 tabular-nums">
                        {visit.scheduledTime}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => onSelectClient(client.id)}
                          className="text-sm font-semibold text-slate-900 hover:text-blue-600 text-left transition-colors"
                        >
                          {client.name}
                        </button>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">{client.category}</span>
                      </div>

                      <p className="text-xs text-slate-600">{client.address}</p>

                      <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                        <span>Contacto: <strong>{client.contactName}</strong></span>
                        <a
                          href={`tel:${client.phone}`}
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                          </svg>
                          {client.phone}
                        </a>
                      </div>

                      {/* Distance status badge */}
                      {visit.status === 'scheduled' && (
                        <div className="text-[11px] pt-1 flex items-center gap-2">
                          <span className="text-slate-500">
                            Distancia GPS actual: <strong className="font-mono tabular-nums text-slate-800">{formatDistance(distance)}</strong>
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className={isInsideGeofence ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                            {isInsideGeofence ? '✓ Dentro de radio de check-in' : 'Fuera de radio (acércate)'}
                          </span>
                        </div>
                      )}

                      {/* Completed summary */}
                      {visit.status === 'completed' && (
                        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 mt-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-700 font-semibold">Visita Completada</span>
                            <span className="text-slate-400">·</span>
                            <span>Duración: {visit.durationMinutes} min</span>
                            {visit.saleAmount ? (
                              <>
                                <span className="text-slate-400">·</span>
                                <span className="font-semibold text-slate-900 font-mono tabular-nums">
                                  Venta: {visit.saleAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </span>
                              </>
                            ) : null}
                          </div>
                          {visit.notes && <p className="italic text-slate-500 text-[11px]">"{visit.notes}"</p>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Navigation Link (Google Maps) */}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${client.coords.lat},${client.coords.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1"
                      title="Navegar con GPS"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                      </svg>
                      <span>Ruta GPS</span>
                    </a>

                    {/* Check In Action */}
                    {visit.status === 'scheduled' && (
                      <button
                        onClick={() => onOpenCheckInModal(visit)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                          isInsideGeofence
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>Check-in Llegada</span>
                      </button>
                    )}

                    {/* Check Out Action */}
                    {visit.status === 'in_progress' && (
                      <button
                        onClick={() => onOpenCheckInModal(visit)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <span>Finalizar Visita</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
