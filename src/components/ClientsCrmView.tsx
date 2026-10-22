import React, { useState } from 'react';
import { Client, Visit, SalesRep } from '../types';
import { sound } from '../utils/audioFeedback';

interface ClientsCrmViewProps {
  clients: Client[];
  visits: Visit[];
  salesReps: SalesRep[];
  onOpenNewClientModal: () => void;
  onEditClient: (client: Client) => void;
  onSelectClientAndGoToMap: (clientId: string) => void;
  onScheduleVisitForClient: (clientId: string) => void;
  onDeleteClient: (clientId: string) => void;
  onViewClientDrawer: (clientId: string) => void;
}

export const ClientsCrmView: React.FC<ClientsCrmViewProps> = ({
  clients,
  visits,
  salesReps,
  onOpenNewClientModal,
  onEditClient,
  onSelectClientAndGoToMap,
  onScheduleVisitForClient,
  onDeleteClient,
  onViewClientDrawer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Categories list
  const categories = Array.from(new Set(clients.map((c) => c.category)));

  // Filter clients
  const filteredClients = clients.filter((c) => {
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
    if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && (c.status || 'active') !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        (c.cif && c.cif.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Calculate CRM KPIs
  const totalClients = clients.length;
  const activeCount = clients.filter((c) => (c.status || 'active') === 'active').length;
  const highPriorityCount = clients.filter((c) => c.priority === 'alta').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayVisitsCount = visits.filter((v) => v.scheduledDate === todayStr).length;

  const totalRevenue = visits.reduce((acc, v) => acc + (v.saleAmount || 0), 0);

  // Status badge config
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'prospect':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Prospecto</span>;
      case 'negotiation':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">En Negociación</span>;
      case 'inactive':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Inactivo</span>;
      case 'active':
      default:
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Cliente Activo</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'alta':
        return <span className="text-[11px] font-bold text-red-600">Alta</span>;
      case 'media':
        return <span className="text-[11px] font-semibold text-amber-600">Media</span>;
      case 'baja':
        return <span className="text-[11px] text-slate-500">Baja</span>;
      default:
        return <span>{priority}</span>;
    }
  };

  const exportClientsCsv = () => {
    sound.playClick();
    const headers = ['ID', 'Nombre Comercial', 'Empresa', 'CIF', 'Contacto', 'Teléfono', 'Email', 'Dirección', 'Ciudad', 'Latitud', 'Longitud', 'Radio Geocerca (m)', 'Categoría', 'Prioridad', 'Estado'];
    const rows = filteredClients.map((c) => [
      c.id,
      `"${c.name}"`,
      `"${c.company}"`,
      c.cif || '',
      `"${c.contactName}"`,
      `"${c.phone}"`,
      c.email,
      `"${c.address}"`,
      c.city,
      c.coords.lat,
      c.coords.lng,
      c.geofenceRadiusMeters,
      c.category,
      c.priority,
      c.status || 'active',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `clientes_crm_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            CRM de Clientes & Cuentas Comerciales
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión de clientes, geocercas de control GPS, datos de contacto y acuerdos comerciales
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={exportClientsCsv}
            className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            title="Descargar lista de clientes en formato CSV"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onOpenNewClientModal();
            }}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>+ Nuevo Cliente CRM</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block">Total Cartera CRM</span>
          <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
            {totalClients}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">{activeCount} cuentas activas</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block">Cuentas Estratégicas</span>
          <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
            {highPriorityCount}
          </span>
          <span className="text-[11px] text-red-600 font-medium">Prioridad Alta</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block">Visitas en Agenda Hoy</span>
          <span className="text-xl font-bold text-blue-600 font-mono tabular-nums block mt-1">
            {todayVisitsCount}
          </span>
          <span className="text-[11px] text-blue-600 font-medium">Paradas programadas</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block">Facturación Acumulada</span>
          <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
            {totalRevenue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          </span>
          <span className="text-[11px] text-slate-400">Ventas cerradas en visitas</span>
        </div>
      </div>

      {/* Toolbar & Filter Controls */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar cliente, empresa, contacto o ciudad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sector filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los Sectores</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas las Prioridades</option>
            <option value="alta">Prioridad Alta</option>
            <option value="media">Prioridad Media</option>
            <option value="baja">Prioridad Baja</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los Estados CRM</option>
            <option value="active">Activos</option>
            <option value="prospect">Prospectos</option>
            <option value="negotiation">En Negociación</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">No se encontraron clientes</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No hay cuentas comerciales que coincidan con los filtros aplicados. Puedes registrar un nuevo cliente con el botón superior.
            </p>
          </div>
        ) : (
          filteredClients.map((client) => {
            const clientVisits = visits.filter((v) => v.clientId === client.id);
            const completedVisits = clientVisits.filter((v) => v.status === 'completed').length;
            const clientSales = clientVisits.reduce((acc, v) => acc + (v.saleAmount || 0), 0);
            const cleanPhone = client.phone.replace(/[^0-9]/g, '');

            return (
              <div
                key={client.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top info row */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                          {client.category}
                        </span>
                        <span className="text-slate-300">·</span>
                        {getPriorityBadge(client.priority)}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1 hover:text-blue-600 cursor-pointer transition-colors" onClick={() => onViewClientDrawer(client.id)}>
                        {client.name}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {client.company} {client.cif ? `· ${client.cif}` : ''}
                      </p>
                    </div>

                    {getStatusBadge(client.status)}
                  </div>

                  {/* Contact Info & Channels */}
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Contacto:</span>
                      <span className="font-semibold text-slate-800">{client.contactName}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Teléfono:</span>
                      <div className="flex items-center gap-2">
                        <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline font-mono">
                          {client.phone}
                        </a>
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 hover:text-emerald-700"
                          title="Contactar por WhatsApp"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                          </svg>
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start justify-between text-slate-600 gap-2">
                      <span className="text-slate-400 shrink-0">Dirección:</span>
                      <span className="text-slate-700 text-right truncate max-w-[200px]" title={client.address}>
                        {client.address}, {client.city}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Geocerca GPS:</span>
                      <span className="font-mono tabular-nums text-slate-700">
                        {client.geofenceRadiusMeters} m radio
                      </span>
                    </div>
                  </div>

                  {/* Commercial Stats Strip */}
                  <div className="mt-3 bg-slate-50 rounded-xl p-2.5 border border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Visitas Realizadas</span>
                      <span className="font-mono tabular-nums font-bold text-slate-800">
                        {completedVisits} completadas
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Ventas Acumuladas</span>
                      <span className="font-mono tabular-nums font-bold text-slate-800">
                        {clientSales > 0 ? clientSales.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Notes Preview if any */}
                  {client.notes && (
                    <p className="mt-2 text-[11px] text-slate-500 italic bg-slate-50/50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                      "{client.notes}"
                    </p>
                  )}
                </div>

                {/* Card Actions Toolbar */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* EDIT CLIENT BUTTON */}
                    <button
                      onClick={() => {
                        sound.playClick();
                        onEditClient(client);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition-colors flex items-center gap-1"
                      title="Editar ficha completa de cliente"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        onSelectClientAndGoToMap(client.id);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors flex items-center gap-1"
                      title="Ver posición en el mapa"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                      </svg>
                      <span>Mapa</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        onScheduleVisitForClient(client.id);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                      title="Agendar nueva visita comercial"
                    >
                      + Visita
                    </button>
                  </div>

                  {clients.length > 1 && (
                    <button
                      onClick={() => {
                        sound.playClick();
                        if (window.confirm(`¿Eliminar la cuenta de ${client.name} del CRM?`)) {
                          onDeleteClient(client.id);
                        }
                      }}
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Eliminar cliente"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
