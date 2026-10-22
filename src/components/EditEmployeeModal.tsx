import React, { useState } from 'react';
import { SalesRep, RepStatus } from '../types';
import { sound } from '../utils/audioFeedback';

interface EditEmployeeModalProps {
  rep: SalesRep;
  onClose: () => void;
  onSaveEmployee: (updatedRep: SalesRep) => void;
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  rep,
  onClose,
  onSaveEmployee,
}) => {
  const [name, setName] = useState(rep.name);
  const [email, setEmail] = useState(rep.email);
  const [phone, setPhone] = useState(rep.phone);
  const [dni, setDni] = useState(rep.dni || '');
  const [roleTitle, setRoleTitle] = useState(rep.roleTitle || 'Ejecutivo Comercial');
  const [territory, setTerritory] = useState(rep.territory);
  const [vehicleType, setVehicleType] = useState<'car' | 'motorcycle' | 'transit' | 'walking'>(
    rep.vehicleType || 'car'
  );
  const [status, setStatus] = useState<RepStatus>(rep.status);
  const [batteryLevel, setBatteryLevel] = useState(rep.batteryLevel ?? 90);
  const [lat, setLat] = useState(rep.currentCoords.lat);
  const [lng, setLng] = useState(rep.currentCoords.lng);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) return;

    sound.playSuccess();

    const updated: SalesRep = {
      ...rep,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      dni: dni.trim() || undefined,
      roleTitle: roleTitle.trim(),
      territory: territory.trim(),
      vehicleType,
      status,
      batteryLevel: Math.min(100, Math.max(0, Number(batteryLevel))),
      currentCoords: {
        lat: Number(lat),
        lng: Number(lng),
      },
    };

    onSaveEmployee(updated);
    onClose();
  };

  const handleGetCurrentGps = () => {
    sound.playClick();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(Number(pos.coords.latitude.toFixed(6)));
          setLng(Number(pos.coords.longitude.toFixed(6)));
        },
        () => {
          alert('No se pudo acceder al GPS del dispositivo.');
        }
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Editar Ficha de Vendedor</h3>
            <p className="text-xs text-slate-500">Actualizar datos de {rep.name}</p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Name & DNI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nombre Completo *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">DNI / NIF</label>
              <input
                type="text"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="12345678Z"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Correo Electrónico *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Teléfono Móvil *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Role & Territory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cargo Comercial</label>
              <input
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Territorio / Zona</label>
              <input
                type="text"
                required
                value={territory}
                onChange={(e) => setTerritory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Vehicle & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Transporte</label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="car">Coche</option>
                <option value="motorcycle">Motocicleta</option>
                <option value="transit">Transporte Público</option>
                <option value="walking">A pie</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RepStatus)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="available">Disponible</option>
                <option value="on_route">En Ruta</option>
                <option value="in_meeting">En Cliente</option>
                <option value="offline">Desconectado</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Batería (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={batteryLevel}
                onChange={(e) => setBatteryLevel(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
          </div>

          {/* GPS Coordinates */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Ubicación GPS Actual</span>
              <button
                type="button"
                onClick={handleGetCurrentGps}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polygon points="12 8 8 12 12 16 12 8"/>
                </svg>
                <span>Usar GPS actual</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500">Latitud</label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500">Longitud</label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-sm"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
