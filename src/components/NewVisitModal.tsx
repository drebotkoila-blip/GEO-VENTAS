import React, { useState } from 'react';
import { SalesRep, Client, Visit, Coordinates } from '../types';
import { sound } from '../utils/audioFeedback';

interface NewVisitModalProps {
  salesReps: SalesRep[];
  clients: Client[];
  initialClientId?: string;
  initialCoords?: Coordinates | null;
  onClose: () => void;
  onCreateVisit: (visitData: Omit<Visit, 'id'>) => void;
  onCreateClientAndVisit?: (clientData: Omit<Client, 'id'>, visitData: Omit<Visit, 'id' | 'clientId'>) => void;
}

export const NewVisitModal: React.FC<NewVisitModalProps> = ({
  salesReps,
  clients,
  initialClientId,
  initialCoords,
  onClose,
  onCreateVisit,
  onCreateClientAndVisit,
}) => {
  const [mode, setMode] = useState<'existing_client' | 'new_client'>(
    initialCoords ? 'new_client' : 'existing_client'
  );

  const [repId, setRepId] = useState(salesReps[0]?.id || '');
  const [clientId, setClientId] = useState(initialClientId || clients[0]?.id || '');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('14:30');
  const [objective, setObjective] = useState('');

  // New client fields
  const [newClientName, setNewClientName] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientContact, setNewClientContact] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('+34 912 ');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientLat, setNewClientLat] = useState<number>(initialCoords?.lat || 40.4300);
  const [newClientLng, setNewClientLng] = useState<number>(initialCoords?.lng || -3.6800);
  const [geofenceRadius, setGeofenceRadius] = useState<number>(120);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playSuccess();

    if (mode === 'existing_client') {
      if (!repId || !clientId || !scheduledTime) return;
      onCreateVisit({
        repId,
        clientId,
        scheduledDate,
        scheduledTime,
        status: 'scheduled',
        objective: objective.trim() || 'Visita comercial de rutina',
      });
    } else {
      if (!newClientName || !newClientAddress || !onCreateClientAndVisit) return;
      onCreateClientAndVisit(
        {
          name: newClientName,
          company: newClientCompany || newClientName,
          contactName: newClientContact || 'Responsable de Compras',
          phone: newClientPhone,
          email: 'contacto@cliente.com',
          address: newClientAddress,
          city: 'Madrid',
          coords: { lat: newClientLat, lng: newClientLng },
          geofenceRadiusMeters: geofenceRadius,
          priority: 'media',
          category: 'Retail',
        },
        {
          repId,
          scheduledDate,
          scheduledTime,
          status: 'scheduled',
          objective: objective.trim() || 'Presentación inicial de catálogo',
        }
      );
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Programar Nueva Visita</h3>
            <p className="text-xs text-slate-500">Asignar parada comercial a la ruta del vendedor</p>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Client mode toggle */}
        <div className="px-6 pt-4">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setMode('existing_client');
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === 'existing_client' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Cliente Existente
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setMode('new_client');
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === 'new_client' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              + Nuevo Cliente / Punto GPS
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'existing_client' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cliente a Visitar
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.address}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Nombre Comercial del Cliente
                </label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ej: Clínica Dental Central"
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Dirección
                </label>
                <input
                  type="text"
                  required
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  placeholder="Calle Mayor 45, Madrid"
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                    Latitud GPS
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newClientLat}
                    onChange={(e) => setNewClientLat(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                    Longitud GPS
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newClientLng}
                    onChange={(e) => setNewClientLng(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Radio de Geocerca Permitido ({geofenceRadius} metros)
                </label>
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="10"
                  value={geofenceRadius}
                  onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vendedor Asignado
            </label>
            <select
              value={repId}
              onChange={(e) => setRepId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {salesReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.territory})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hora Estimada
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Objetivo Comercial de la Visita
            </label>
            <textarea
              rows={2}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Presentar catálogo, revisión de garantías, firma de contrato..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
            >
              Guardar y Asignar a Ruta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
