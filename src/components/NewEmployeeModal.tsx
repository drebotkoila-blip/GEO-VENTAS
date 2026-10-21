import React, { useState } from 'react';
import { SalesRep, Coordinates } from '../types';
import { sound } from '../utils/audioFeedback';

interface NewEmployeeModalProps {
  onClose: () => void;
  onAddEmployee: (employeeData: Omit<SalesRep, 'id' | 'totalDistanceKmToday' | 'routeHistory' | 'lastPing' | 'speedKmH'>) => void;
  userCoords?: Coordinates | null;
}

export const NewEmployeeModal: React.FC<NewEmployeeModalProps> = ({
  onClose,
  onAddEmployee,
  userCoords,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+34 6');
  const [dni, setDni] = useState('');
  const [roleTitle, setRoleTitle] = useState('Ejecutivo Comercial de Campo');
  const [territory, setTerritory] = useState('Zona Norte - Madrid');
  const [customTerritory, setCustomTerritory] = useState('');
  const [vehicleType, setVehicleType] = useState<'car' | 'motorcycle' | 'transit' | 'walking'>('car');
  const [locationType, setLocationType] = useState<'office' | 'current_gps' | 'custom'>('office');
  const [customLat, setCustomLat] = useState(40.4350);
  const [customLng, setCustomLng] = useState(-3.6900);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) return;

    sound.playSuccess();

    let initialCoords: Coordinates = { lat: 40.4530, lng: -3.6883 }; // Central office
    if (locationType === 'current_gps' && userCoords) {
      initialCoords = userCoords;
    } else if (locationType === 'custom') {
      initialCoords = { lat: customLat, lng: customLng };
    }

    const assignedTerritory = territory === 'custom' && customTerritory.trim()
      ? customTerritory.trim()
      : territory;

    onAddEmployee({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      dni: dni.trim() || undefined,
      roleTitle,
      territory: assignedTerritory,
      vehicleType,
      avatar: '',
      currentCoords: initialCoords,
      status: 'available',
      batteryLevel: 98,
      hireDate: new Date().toISOString().split('T')[0],
    });

    onClose();
  };

  const handleUseCurrentLocation = () => {
    sound.playClick();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCustomLat(Number(pos.coords.latitude.toFixed(6)));
          setCustomLng(Number(pos.coords.longitude.toFixed(6)));
          setLocationType('custom');
        },
        () => {
          alert('No se pudo acceder al GPS del navegador. Introduce las coordenadas manualmente.');
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
            <h3 className="text-base font-bold text-slate-900">Alta de Nuevo Vendedor</h3>
            <p className="text-xs text-slate-500">Registrar un nuevo vendedor con asignación de territorio y seguimiento GPS</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre y Apellidos *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Marcos Delgado"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                DNI / NIE (Opcional)
              </label>
              <input
                type="text"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="Ej: 53891244R"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Correo Electrónico Corporativo *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="m.delgado@empresa.com"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono Móvil (GPS / WhatsApp) *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 612 999 888"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cargo / Perfil
              </label>
              <select
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Ejecutivo Comercial de Campo">Ejecutivo Comercial de Campo</option>
                <option value="Key Account Manager (KAM)">Key Account Manager (KAM)</option>
                <option value="Representante de Ventas Senior">Representante de Ventas Senior</option>
                <option value="Asesor Comercial Junior">Asesor Comercial Junior</option>
                <option value="Especialista de Cuentas Retail">Especialista de Cuentas Retail</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Medio de Desplazamiento
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as any)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="car">Coche de Empresa</option>
                <option value="motorcycle">Motocicleta</option>
                <option value="transit">Transporte Público</option>
                <option value="walking">A pie / Comercial Urbano</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Zona / Territorio Asignado
            </label>
            <select
              value={territory}
              onChange={(e) => setTerritory(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Zona Norte - Madrid">Zona Norte - Madrid</option>
              <option value="Zona Centro / Salamanca">Zona Centro / Salamanca</option>
              <option value="Zona Oeste - Pozuelo / Las Rozas">Zona Oeste - Pozuelo / Las Rozas</option>
              <option value="Zona Sur / Polígonos Getafe">Zona Sur / Polígonos Getafe</option>
              <option value="Corredor del Henares - Alcalá">Corredor del Henares - Alcalá</option>
              <option value="custom">+ Otra Zona Personalizada</option>
            </select>
            {territory === 'custom' && (
              <input
                type="text"
                placeholder="Escribe el nombre de la zona (ej: Valencia Centro)"
                value={customTerritory}
                onChange={(e) => setCustomTerritory(e.target.value)}
                className="mt-2 w-full text-xs p-2 rounded-lg border border-slate-300"
              />
            )}
          </div>

          {/* Initial GPS location */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Punto de Partida / Base GPS Inicial
              </label>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Usar mi GPS</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5">Latitud</span>
                <input
                  type="number"
                  step="0.0001"
                  value={customLat}
                  onChange={(e) => {
                    setCustomLat(Number(e.target.value));
                    setLocationType('custom');
                  }}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5">Longitud</span>
                <input
                  type="number"
                  step="0.0001"
                  value={customLng}
                  onChange={(e) => {
                    setCustomLng(Number(e.target.value));
                    setLocationType('custom');
                  }}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Coordenadas de referencia para el cálculo de distancias y primera ruta del día.
            </p>
          </div>

          {/* Footer buttons */}
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
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>Dar de Alta Vendedor</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
