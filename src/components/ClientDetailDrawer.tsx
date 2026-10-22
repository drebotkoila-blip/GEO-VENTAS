import React from 'react';
import { Client, Visit, SalesRep } from '../types';
import { calculateDistanceMeters, formatDistance, safeCoords } from '../utils/geoUtils';
import { sound } from '../utils/audioFeedback';

interface ClientDetailDrawerProps {
  client: Client;
  visits: Visit[];
  salesReps: SalesRep[];
  activeRep: SalesRep;
  onClose: () => void;
  onScheduleVisitForClient: (clientId: string) => void;
  onInitiateCheckIn?: (visit: Visit) => void;
  onEditClient?: (client: Client) => void;
}

export const ClientDetailDrawer: React.FC<ClientDetailDrawerProps> = ({
  client,
  visits,
  salesReps,
  activeRep,
  onClose,
  onScheduleVisitForClient,
  onInitiateCheckIn,
  onEditClient,
}) => {
  const clientVisits = visits.filter((v) => v.clientId === client.id);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayVisit = clientVisits.find((v) => v.scheduledDate === todayStr);

  const clientCoords = safeCoords(client.coords, { lat: 40.4200, lng: -3.7000 });
  const repCoords = safeCoords(activeRep.currentCoords, { lat: 40.4530, lng: -3.6883 });
  const distance = calculateDistanceMeters(repCoords, clientCoords);
  const geofenceRadius = Number.isFinite(client.geofenceRadiusMeters) ? Number(client.geofenceRadiusMeters) : 120;
  const isInsideGeofence = distance <= geofenceRadius;

  const totalSalesToClient = clientVisits.reduce((acc, v) => acc + (v.saleAmount || 0), 0);
  const completedVisits = clientVisits.filter((v) => v.status === 'completed');

  // Clean phone for WhatsApp
  const cleanPhone = client.phone.replace(/[^0-9]/g, '');

  return (
    <div className="fixed inset-y-0 right-0 z-[1000] w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {client.code && (
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                {client.code}
              </span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
              {client.category}
            </span>
            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              {client.pais || 'España'}
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-900 mt-1">{client.name}</h3>
          <p className="text-xs text-slate-500">{client.company}</p>
        </div>
        <div className="flex items-center gap-1">
          {onEditClient && (
            <button
              onClick={() => {
                sound.playClick();
                onEditClient(client);
              }}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors"
              title="Editar ficha completa de cliente"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              <span>Editar</span>
            </button>
          )}
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
        {/* Distance & Geofence Card */}
        <div
          className={`p-4 rounded-xl border ${
            isInsideGeofence
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs">
              {isInsideGeofence ? '✓ Dentro del Radio de Check-in' : 'Distancia desde vendedor activo'}
            </span>
            <span className="font-mono tabular-nums font-bold text-sm">
              {formatDistance(distance)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Vendedor activo: <strong className="text-slate-700">{activeRep.name}</strong> ({activeRep.territory})
          </p>

          {todayVisit && todayVisit.status === 'scheduled' && onInitiateCheckIn && (
            <button
              onClick={() => {
                sound.playClick();
                onInitiateCheckIn(todayVisit);
              }}
              className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all"
            >
              Registrar Check-in GPS Ahora
            </button>
          )}
        </div>

        {/* Contact & Physical Address */}
        <div className="space-y-3">
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
            Datos de Contacto & Ubicación
          </h4>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Persona de Contacto:</span>
              <span className="font-semibold text-slate-800">{client.contactName}</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-slate-500 shrink-0">Dirección:</span>
              <span className="font-medium text-slate-800 text-right">{client.address}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Ciudad & País:</span>
              <span className="font-medium text-slate-800">{client.city}, {client.pais || 'España'}</span>
            </div>
            {client.email && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Email:</span>
                <a href={`mailto:${client.email}`} className="font-medium text-blue-600 hover:underline">
                  {client.email}
                </a>
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <a
              href={`tel:${client.phone}`}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-center flex flex-col items-center gap-1 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span>Llamar</span>
            </a>

            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-emerald-700 font-semibold text-center flex flex-col items-center gap-1 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
              <span>WhatsApp</span>
            </a>

            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${clientCoords.lat},${clientCoords.lng}`}
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-blue-700 font-semibold text-center flex flex-col items-center gap-1 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              <span>Navegar GPS</span>
            </a>
          </div>
        </div>

        {/* Commercial Relationship & Visits Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Relación Comercial & Visitas
            </h4>
            <span className="font-mono tabular-nums font-bold text-slate-800">
              {totalSalesToClient > 0
                ? totalSalesToClient.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                : '0,00 €'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block">Total Visitas</span>
              <span className="font-mono tabular-nums font-bold text-slate-800 text-sm">
                {clientVisits.length}
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block">Completadas</span>
              <span className="font-mono tabular-nums font-bold text-emerald-600 text-sm">
                {completedVisits.length}
              </span>
            </div>
          </div>

          {/* Visits Timeline List */}
          <div className="space-y-2">
            {clientVisits.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-400">
                <p>No hay visitas registradas para este cliente aún.</p>
                <button
                  onClick={() => {
                    sound.playClick();
                    onScheduleVisitForClient(client.id);
                  }}
                  className="mt-2 text-blue-600 font-bold hover:underline text-xs"
                >
                  + Programar la primera visita
                </button>
              </div>
            ) : (
              clientVisits.map((v) => {
                const rep = salesReps.find((r) => r.id === v.repId);
                return (
                  <div key={v.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 font-mono">
                        {v.scheduledDate} · {v.scheduledTime}
                      </span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded-md text-[10px] ${
                          v.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : v.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {v.status === 'completed'
                          ? 'Completada'
                          : v.status === 'in_progress'
                          ? 'En Curso'
                          : 'Programada'}
                      </span>
                    </div>

                    <p className="text-slate-700 text-xs font-medium">{v.objective}</p>

                    {v.outcome && (
                      <p className="text-[11px] text-slate-500">
                        Resultado: <span className="font-semibold text-slate-700">{v.outcome}</span>
                      </p>
                    )}

                    {v.notes && (
                      <p className="text-[11px] text-slate-500 italic bg-white p-1.5 rounded border border-slate-100">
                        "{v.notes}"
                      </p>
                    )}

                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
                      <span>Vendedor: <strong>{rep?.name || 'No asignado'}</strong></span>
                      {v.saleAmount ? (
                        <span className="font-bold text-emerald-700 font-mono tabular-nums">
                          +{v.saleAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
        <button
          onClick={() => {
            sound.playClick();
            onScheduleVisitForClient(client.id);
          }}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Agendar Nueva Visita</span>
        </button>
      </div>
    </div>
  );
};
