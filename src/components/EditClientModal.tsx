import React, { useState } from 'react';
import { Client, ClientCategory, Coordinates } from '../types';
import { sound } from '../utils/audioFeedback';
import { resolveClientCoords, safeCoords } from '../utils/geoUtils';

interface EditClientModalProps {
  client?: Client | null; // If provided, edit mode; if null/undefined, create mode
  initialCoords?: Coordinates | null;
  onClose: () => void;
  onSaveClient: (clientData: Client) => void;
}

export const EditClientModal: React.FC<EditClientModalProps> = ({
  client,
  initialCoords,
  onClose,
  onSaveClient,
}) => {
  const isEditing = Boolean(client);

  // Schema fields directly mapped to Supabase 'clientes':
  // [id, code, name, company, contact_name, phone, email, address, city, category, país]
  const [code, setCode] = useState(client?.code || '');
  const [name, setName] = useState(client?.name || '');
  const [company, setCompany] = useState(client?.company || '');
  const [contactName, setContactName] = useState(client?.contactName || '');
  const [phone, setPhone] = useState(client?.phone || '+34 ');
  const [email, setEmail] = useState(client?.email || '');
  const [address, setAddress] = useState(client?.address || '');
  const [city, setCity] = useState(client?.city || 'Madrid');
  const [pais, setPais] = useState(client?.pais || 'España');
  const [category, setCategory] = useState<ClientCategory | string>(client?.category || 'Retail');

  // Map position (for interactive map view)
  const initialClientCoords = client?.coords ?? initialCoords ?? { lat: 40.4200, lng: -3.7000 };
  const [lat, setLat] = useState(initialClientCoords.lat);
  const [lng, setLng] = useState(initialClientCoords.lng);
  const [showLocationDetails, setShowLocationDetails] = useState(false);

  // Helper to generate a client code if empty
  const handleGenerateCode = () => {
    sound.playClick();
    const prefix = 'CLI';
    const randNum = Math.floor(100 + Math.random() * 900);
    setCode(`${prefix}-${randNum}`);
  };

  const handleUseCurrentLocation = () => {
    sound.playClick();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(Number(pos.coords.latitude.toFixed(6)));
          setLng(Number(pos.coords.longitude.toFixed(6)));
          sound.playSuccess();
        },
        () => {
          alert('No se pudo acceder al GPS del navegador. Puedes calcular las coordenadas por ciudad o introducirlas manualmente.');
        }
      );
    }
  };

  const handleAutocalculateCoords = () => {
    sound.playClick();
    const resolved = resolveClientCoords({
      id: client?.id || `client-${Date.now()}`,
      address,
      city,
      pais,
    });
    setLat(Number(resolved.lat.toFixed(6)));
    setLng(Number(resolved.lng.toFixed(6)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !phone.trim()) return;

    sound.playSuccess();

    const finalCoords = safeCoords(
      { lat: Number(lat), lng: Number(lng) },
      resolveClientCoords({
        id: client?.id || `client-${Date.now()}`,
        address,
        city,
        pais,
      })
    );

    const clientToSave: Client = {
      id: client?.id || `client-${Date.now()}`,
      code: code.trim() || undefined,
      name: name.trim(),
      company: company.trim() || name.trim(),
      contactName: contactName.trim() || 'Contacto Comercial',
      phone: phone.trim(),
      email: email.trim() || 'contacto@cliente.com',
      address: address.trim(),
      city: city.trim() || 'Madrid',
      pais: pais.trim() || 'España',
      category: category || 'Retail',
      coords: finalCoords,
      geofenceRadiusMeters: client?.geofenceRadiusMeters || 120,
    };

    onSaveClient(clientToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
                {isEditing ? 'Edición CRM' : 'Nuevo Registro'}
              </span>
              {code && (
                <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono text-[11px] font-bold">
                  {code}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              {isEditing ? `Editar Cliente: ${client?.name}` : 'Alta de Cliente en Supabase'}
            </h3>
            <p className="text-xs text-slate-500">
              Formulario sincronizado con la tabla clientes de tu base de datos Supabase
            </p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Row 1: Code and Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">Código de Cliente</label>
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  className="text-blue-600 hover:text-blue-800 font-semibold text-[10px] underline"
                >
                  Generar
                </button>
              </div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej: CLI-101"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Nombre Comercial del Cliente *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Distribuciones Farmacéuticas del Norte"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          {/* Row 2: Company and Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Razón Social / Empresa
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ej: DFN Salud S.L."
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Categoría / Sector
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Retail">Retail / Comercio</option>
                <option value="Corporativo">Corporativo / Gran Empresa</option>
                <option value="Distribuidor">Distribuidor Mayorista</option>
                <option value="Salud">Salud / Hospitalario</option>
                <option value="Pyme">PYME / Empresa Local</option>
                <option value="Industria">Industria / Manufactura</option>
                <option value="Otro">Otro Sector</option>
              </select>
            </div>
          </div>

          {/* Row 3: Contact Person, Phone, Email */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Persona de Contacto
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ej: Dra. Elena Ruiz"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Teléfono Directo *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 914 112 233"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="elena.ruiz@dfnsalud.es"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Row 4: Address, City, Country */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block font-semibold text-slate-700 mb-1">
                País (país)
              </label>
              <input
                type="text"
                value={pais}
                onChange={(e) => setPais(e.target.value)}
                placeholder="España"
                list="paises-list"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="paises-list">
                <option value="España" />
                <option value="Portugal" />
                <option value="Francia" />
                <option value="México" />
                <option value="Colombia" />
                <option value="Chile" />
                <option value="Argentina" />
                <option value="Perú" />
              </datalist>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Ciudad / Localidad
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Madrid"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Dirección Física *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Paseo de la Castellana 140, Planta 6"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Map positioning & geocoding assistant */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 text-xs">Ubicación en Mapa para Visitas y Rutas</span>
                <p className="text-[11px] text-slate-500">
                  Coordenadas: <span className="font-mono text-slate-700">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutocalculateCoords}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg shadow-2xs transition-colors"
                >
                  📍 Autocalcular por Ciudad
                </button>
                <button
                  type="button"
                  onClick={() => setShowLocationDetails(!showLocationDetails)}
                  className="text-blue-600 hover:underline font-semibold text-[11px]"
                >
                  {showLocationDetails ? 'Ocultar GPS' : 'Ajustar GPS'}
                </button>
              </div>
            </div>

            {showLocationDetails && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 animate-in fade-in duration-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Ajuste manual de coordenadas:</span>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="text-blue-600 hover:underline font-semibold text-[11px] flex items-center gap-1"
                  >
                    <span>Capturar mi GPS</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Latitud</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={lat}
                      onChange={(e) => setLat(Number(e.target.value))}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Longitud</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={lng}
                      onChange={(e) => setLng(Number(e.target.value))}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-4 py-2 font-medium text-slate-600 hover:text-slate-900 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>{isEditing ? 'Guardar Cambios en Supabase' : 'Crear Cliente en Supabase'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
