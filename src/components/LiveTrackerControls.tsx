import React, { useState, useEffect } from 'react';
import { SalesRep, Client, Visit } from '../types';
import { calculateDistanceMeters, formatDistance } from '../utils/geoUtils';
import { sound } from '../utils/audioFeedback';

interface LiveTrackerControlsProps {
  activeRep: SalesRep;
  clients: Client[];
  visits: Visit[];
  onUpdateRepCoords: (coords: { lat: number; lng: number }, speedKmH?: number) => void;
  isRealGpsActive: boolean;
  onToggleRealGps: () => void;
  onStepSimulation: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  simulationSpeed: number;
  onChangeSimulationSpeed: (speed: number) => void;
  gpsAccuracy: number | null;
  gpsError: string | null;
  onInitiateCheckIn?: (visit: Visit) => void;
}

export const LiveTrackerControls: React.FC<LiveTrackerControlsProps> = ({
  activeRep,
  clients,
  visits,
  onUpdateRepCoords,
  isRealGpsActive,
  onToggleRealGps,
  onStepSimulation,
  isSimulating,
  onToggleSimulation,
  simulationSpeed,
  onChangeSimulationSpeed,
  gpsAccuracy,
  gpsError,
  onInitiateCheckIn,
}) => {
  // Find the next closest pending visit for this rep
  const repScheduledVisits = visits.filter(
    (v) => v.repId === activeRep.id && (v.status === 'scheduled' || v.status === 'in_progress')
  );

  let closestClient: Client | null = null;
  let closestVisit: Visit | null = null;
  let minDistance = Infinity;

  repScheduledVisits.forEach((visit) => {
    const client = clients.find((c) => c.id === visit.clientId);
    if (client) {
      const dist = calculateDistanceMeters(activeRep.currentCoords, client.coords);
      if (dist < minDistance) {
        minDistance = dist;
        closestClient = client;
        closestVisit = visit;
      }
    }
  });

  const isInsideClosestGeofence = closestClient ? minDistance <= (closestClient as Client).geofenceRadiusMeters : false;

  // Sound alert when entering geofence
  useEffect(() => {
    if (isInsideClosestGeofence && closestVisit?.status === 'scheduled') {
      sound.playSuccess();
    }
  }, [isInsideClosestGeofence]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      {/* Top rep row & main action toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
              {activeRep.name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                activeRep.status === 'on_route'
                  ? 'bg-blue-600'
                  : activeRep.status === 'in_meeting'
                  ? 'bg-teal-600'
                  : activeRep.status === 'available'
                  ? 'bg-emerald-600'
                  : 'bg-slate-400'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">{activeRep.name}</h4>
              <span className="text-xs text-slate-500 font-medium">· {activeRep.territory}</span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 font-mono tabular-nums">
              <span>GPS: {activeRep.currentCoords.lat.toFixed(5)}, {activeRep.currentCoords.lng.toFixed(5)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Real GPS Toggle */}
          <button
            onClick={() => {
              sound.playClick();
              onToggleRealGps();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isRealGpsActive
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Activa el sensor GPS del dispositivo"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>{isRealGpsActive ? 'GPS Real Conectado' : 'Usar GPS Real'}</span>
          </button>

          {/* Simulation Toggle */}
          <button
            onClick={() => {
              sound.playClick();
              onToggleSimulation();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isSimulating
                ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Simula el vehículo avanzando por la ruta comercial"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isSimulating ? (
                <>
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </>
              ) : (
                <polygon points="5 3 19 12 5 21 5 3" />
              )}
            </svg>
            <span>{isSimulating ? 'Pausar Simulación' : 'Simular Ruta'}</span>
          </button>

          {/* Speed multiplier selector */}
          {isSimulating && (
            <div className="flex items-center bg-amber-50 border border-amber-200 rounded-lg p-0.5 text-xs font-mono">
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => {
                    sound.playClick();
                    onChangeSimulationSpeed(spd);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    simulationSpeed === spd
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          )}

          {/* Step button */}
          <button
            onClick={() => {
              sound.playClick();
              onStepSimulation();
            }}
            disabled={isSimulating}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 transition-colors"
            title="Avanzar manualmente al siguiente punto"
          >
            +1 Paso
          </button>
        </div>
      </div>

      {/* Real-time Proximity Radar Alert */}
      {closestClient && closestVisit && (() => {
        const cClient = closestClient as Client;
        const cVisit = closestVisit as Visit;
        return (
          <div
            className={`rounded-xl p-3 border transition-all ${
              isInsideClosestGeofence
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    isInsideClosestGeofence ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                  }`}
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900">
                    Próxima parada: {cClient.name}
                  </span>
                  <span className="text-slate-500 block text-[11px]">
                    A <strong className="font-mono tabular-nums text-slate-900">{formatDistance(minDistance)}</strong> de distancia (Radio permitido: {cClient.geofenceRadiusMeters}m)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isInsideClosestGeofence
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isInsideClosestGeofence ? '✓ Dentro de Geocerca' : 'En Aproximación'}
                </span>

                {isInsideClosestGeofence && cVisit.status === 'scheduled' && onInitiateCheckIn && (
                  <button
                    onClick={() => {
                      sound.playClick();
                      onInitiateCheckIn(cVisit);
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all animate-bounce"
                  >
                    Check-in Ahora
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Telemetry Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
          <span className="text-[11px] text-slate-500 block">Velocidad</span>
          <span className="font-mono tabular-nums font-bold text-slate-900 text-base">
            {activeRep.speedKmH} <span className="text-xs font-normal text-slate-500">km/h</span>
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
          <span className="text-[11px] text-slate-500 block">Precisión Señal GPS</span>
          <span className="font-mono tabular-nums font-bold text-slate-900 text-base">
            {gpsAccuracy ? `±${Math.round(gpsAccuracy)}m` : '±6m (Satélite)'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
          <span className="text-[11px] text-slate-500 block">Odómetro Hoy</span>
          <span className="font-mono tabular-nums font-bold text-slate-900 text-base">
            {activeRep.totalDistanceKmToday.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-500">km</span>
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
          <span className="text-[11px] text-slate-500 block">Batería Móvil</span>
          <span className="font-mono tabular-nums font-bold text-slate-900 text-base">
            {activeRep.batteryLevel}%
          </span>
        </div>
      </div>

      {gpsError && (
        <div className="text-xs p-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200">
          Aviso de Geolocalización: {gpsError}
        </div>
      )}
    </div>
  );
};
