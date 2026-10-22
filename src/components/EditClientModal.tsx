import React, { useState, useEffect } from 'react';
import { Client, ClientCategory, ClientCrmStatus, Coordinates } from '../types';
import { sound } from '../utils/audioFeedback';

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

  const [name, setName] = useState(client?.name || '');
  const [company, setCompany] = useState(client?.company || '');
  const [cif, setCif] = useState(client?.cif || '');
  const [contactName, setContactName] = useState(client?.contactName || '');
  const [phone, setPhone] = useState(client?.phone || '+34 91');
  const [email, setEmail] = useState(client?.email || '');
  const [address, setAddress] = useState(client?.address || '');
  const [city, setCity] = useState(client?.city || 'Madrid');
  const [lat, setLat] = useState(client?.coords.lat ?? initialCoords?.lat ?? 40.4200);
  const [lng, setLng] = useState(client?.coords.lng ?? initialCoords?.lng ?? -3.7000);
  const [geofenceRadius, setGeofenceRadius] = useState(client?.geofenceRadiusMeters ?? 120);
  const [priority, setPriority] = useState<'alta' | 'media' | 'baja'>(client?.priority || 'media');
  const [category, setCategory] = useState<ClientCategory>(client?.category || 'Retail');
  const [status, setStatus] = useState<ClientCrmStatus>(client?.status || 'active');
  const [notes, setNotes] = useState(client?.notes || '');

  const handleUseCurrentLocation = () => {
    sound.playClick();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(Number(pos.coords.latitude.toFixed(6)));
          setLng(Number(pos.coords.longitude.toFixed(6)));
        },
        () => {
          alert('No se pudo acceder al GPS del navegador. Introduce las coordenadas manualmente.');
        }
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !phone.trim()) return;

    sound.playSuccess();

    const clientToSave: Client = {
      id: client?.id || `client-${Date.now()}`,
      name: name.trim(),
      company: company.trim() || name.trim(),
      cif: cif.trim() || undefined,
      contactName: contactName.trim() || 'Contacto Comercial',
      phone: phone.trim(),
      email: email.trim() || 'info@cliente.com',
      address: address.trim(),
      city: city.trim() || 'Madrid',
      coords: {
        lat: Number.isFinite(Number(lat)) ? Number(lat) : (client?.coords?.lat || 40.4200),
        lng: Number.isFinite(Number(lng)) ? Number(lng) : (client?.coords?.lng || -3.7000),
      },
      geofenceRadiusMeters: Number.isFinite(Number(geofenceRadius)) ? Number(geofenceRadius) : 120,
      priority,
      category,
      status,
      notes: notes.trim() || undefined,
    };

    onSaveClient(clientToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isEditing ? `Editar Ficha CRM: ${client?.name}` : 'Alta de Nuevo Cliente en CRM'}
            </h3>
            <p className="text-xs text-slate-500">
              Información comercial, datos de contacto y perímetro de geocerca GPS
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
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Estado CRM
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientCrmStatus)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Activo (Cliente Regular)</option>
                <option value="prospect">Prospecto (Lead)</option>
                <option value="negotiation">En Negociación</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>

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
                CIF / NIF / Registro Fiscal
              </label>
              <input
                type="text"
                value={cif}
                onChange={(e) => setCif(e.target.value)}
                placeholder="Ej: B-82910492"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Persona de Contacto *
              </label>
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ej: Dra. Elena Ruiz"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Teléfono (Llamadas / WhatsApp) *
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

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sector / Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ClientCategory)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Retail">Retail / Comercio</option>
                <option value="Distribuidor">Distribuidor Mayorista</option>
                <option value="Corporativo">Corporativo / Gran Cuenta</option>
                <option value="Pyme">PYME / Empresa Mediana</option>
                <option value="Salud">Salud / Hospitalario</option>
                <option value="Industria">Industria / Manufactura</option>
                <option value="Otro">Otro Sector</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Prioridad Comercial
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="alta">Alta (Cuenta Estratégica)</option>
                <option value="media">Media (Visita Periódica)</option>
                <option value="baja">Baja (Mantenimiento)</option>
              </select>
            </div>
          </div>

          {/* Location & GPS Geofence */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Dirección Física de la Sucursal *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Paseo de la Castellana 140, Planta 6"
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Madrid"
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="font-semibold text-slate-700">
                Coordenadas Geográficas GPS
              </label>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="text-blue-600 hover:underline font-semibold flex items-center gap-1 text-[11px]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="22" y1="12" x2="18" y2="12"/>
                  <line x1="6" y1="12" x2="2" y2="12"/>
                  <line x1="12" y1="6" x2="12" y2="2"/>
                  <line x1="12" y1="22" x2="12" y2="18"/>
                </svg>
                <span>Capturar mi GPS actual</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5">Latitud</span>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={lat}
                  onChange={(e) => setLat(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5">Longitud</span>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={lng}
                  onChange={(e) => setLng(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-700">
                  Radio de Geocerca de Check-in
                </span>
                <span className="font-mono tabular-nums font-bold text-blue-600">
                  {geofenceRadius} metros
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="350"
                step="10"
                value={geofenceRadius}
                onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Los vendedores deberán registrar su llegada dentro de este perímetro para validar el check-in sin advertencia.
              </p>
            </div>
          </div>

          {/* CRM Commercial Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Notas Comerciales & Requerimientos del Cliente
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preferencias de horario de visita, condiciones de pago a 30/60 días, productos de mayor demanda..."
              className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              <span>{isEditing ? 'Guardar Cambios' : 'Crear Cliente en CRM'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
