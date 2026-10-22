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
  onDeleteMultipleClients: (clientIds: string[]) => void;
  onViewClientDrawer: (clientId: string) => void;
}

export const ClientsCrmView: React.FC<ClientsCrmViewProps> = ({
  clients,
  visits,
  salesReps: _salesReps,
  onOpenNewClientModal,
  onEditClient,
  onSelectClientAndGoToMap,
  onScheduleVisitForClient,
  onDeleteClient,
  onDeleteMultipleClients,
  onViewClientDrawer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [visitFilter, setVisitFilter] = useState<'all' | 'with_visits' | 'without_visits' | 'with_sales'>('all');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [displayMode, setDisplayMode] = useState<'cards' | 'table'>('table');

  // Categories & Countries lists
  const categories = Array.from(new Set(clients.map((c) => c.category).filter(Boolean)));
  const countries = Array.from(new Set(clients.map((c) => c.pais || 'España').filter(Boolean)));

  // Filter clients
  const filteredClients = clients.filter((c) => {
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
    if (countryFilter !== 'all' && (c.pais || 'España') !== countryFilter) return false;

    const clientVisits = visits.filter((v) => v.clientId === c.id);
    if (visitFilter === 'with_visits' && clientVisits.length === 0) return false;
    if (visitFilter === 'without_visits' && clientVisits.length > 0) return false;
    if (visitFilter === 'with_sales') {
      const hasSales = clientVisits.some((v) => (v.saleAmount || 0) > 0);
      if (!hasSales) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (c.code && c.code.toLowerCase().includes(q)) ||
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        (c.pais && c.pais.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Toggle selection
  const handleToggleSelect = (clientId: string) => {
    sound.playClick();
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
  };

  const handleSelectAll = () => {
    sound.playClick();
    if (selectedClientIds.length === filteredClients.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(filteredClients.map((c) => c.id));
    }
  };

  const handleClearSelection = () => {
    sound.playClick();
    setSelectedClientIds([]);
  };

  const handleDeleteSelected = () => {
    if (selectedClientIds.length === 0) return;
    sound.playClick();
    const count = selectedClientIds.length;
    if (window.confirm(`¿Estás seguro de que deseas eliminar ${count} cliente(s) seleccionado(s) del CRM y de Supabase?`)) {
      onDeleteMultipleClients(selectedClientIds);
      setSelectedClientIds([]);
    }
  };

  // Calculate CRM KPIs
  const totalClients = clients.length;
  const clientsWithVisitsCount = clients.filter((c) => visits.some((v) => v.clientId === c.id)).length;
  const totalRevenue = visits.reduce((acc, v) => acc + (v.saleAmount || 0), 0);
  const totalCompletedVisits = visits.filter((v) => v.status === 'completed').length;

  const exportClientsCsv = (onlySelected = false) => {
    sound.playClick();
    const targetClients = onlySelected
      ? clients.filter((c) => selectedClientIds.includes(c.id))
      : filteredClients;

    const headers = [
      'ID',
      'Código',
      'Nombre Comercial',
      'Empresa',
      'Contacto',
      'Teléfono',
      'Email',
      'Dirección',
      'Ciudad',
      'País',
      'Categoría',
      'Total Visitas',
      'Ventas Acumuladas (€)'
    ];

    const rows = targetClients.map((c) => {
      const cVisits = visits.filter((v) => v.clientId === c.id);
      const sales = cVisits.reduce((acc, v) => acc + (v.saleAmount || 0), 0);
      return [
        c.id,
        `"${c.code || ''}"`,
        `"${c.name}"`,
        `"${c.company}"`,
        `"${c.contactName}"`,
        `"${c.phone}"`,
        `"${c.email}"`,
        `"${c.address}"`,
        `"${c.city}"`,
        `"${c.pais || 'España'}"`,
        `"${c.category}"`,
        cVisits.length,
        sales,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `clientes_supabase_${onlySelected ? 'seleccionados_' : ''}${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Clientes & CRM
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
              Supabase Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestión completa de cartera de clientes, relaciones con visitas comerciales y trazabilidad en campo
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Display Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                sound.playClick();
                setDisplayMode('table');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                displayMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista en Listado / Tabla"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              <span>Listado</span>
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setDisplayMode('cards');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                displayMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista en Tarjetas"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              <span>Tarjetas</span>
            </button>
          </div>

          <button
            onClick={() => exportClientsCsv(false)}
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
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
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Clientes CRM</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">{totalClients}</span>
            <span className="text-xs text-slate-400">registros</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Clientes con Visitas</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-blue-600 font-mono tabular-nums">{clientsWithVisitsCount}</span>
            <span className="text-xs text-slate-400">({totalClients > 0 ? Math.round((clientsWithVisitsCount / totalClients) * 100) : 0}%)</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Visitas Completadas</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-600 font-mono tabular-nums">{totalCompletedVisits}</span>
            <span className="text-xs text-slate-400">en campo</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Ventas Cerradas</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">
              {totalRevenue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-5 relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por código, nombre, empresa, ciudad, país, teléfono..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Country Filter */}
          <div className="sm:col-span-2">
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los países</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Visit Relationship Filter */}
          <div className="sm:col-span-3">
            <select
              value={visitFilter}
              onChange={(e) => setVisitFilter(e.target.value as any)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Relación con Visitas (Todas)</option>
              <option value="with_visits">Con Visitas Registradas</option>
              <option value="without_visits">Sin Visitas Aún</option>
              <option value="with_sales">Con Ventas Cerradas (€)</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Strip when records are selected */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <input
                type="checkbox"
                readOnly
                checked={filteredClients.length > 0 && selectedClientIds.length === filteredClients.length}
                className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 pointer-events-none"
              />
              <span>
                {selectedClientIds.length === filteredClients.length && filteredClients.length > 0
                  ? 'Deseleccionar todos'
                  : 'Seleccionar todos los visibles'}
              </span>
            </button>

            {selectedClientIds.length > 0 && (
              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                {selectedClientIds.length} seleccionados
              </span>
            )}
          </div>

          {selectedClientIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportClientsCsv(true)}
                className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold transition-colors flex items-center gap-1"
              >
                <span>Exportar ({selectedClientIds.length})</span>
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold transition-colors flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <span>Eliminar Seleccionados</span>
              </button>
              <button
                onClick={handleClearSelection}
                className="text-slate-400 hover:text-slate-600 px-2 py-1 text-xs"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Table Mode vs Cards Mode */}
      {displayMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredClients.length > 0 && selectedClientIds.length === filteredClients.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Código</th>
                  <th className="p-3">Nombre Comercial & Empresa</th>
                  <th className="p-3">Ubicación (Ciudad / País)</th>
                  <th className="p-3">Contacto & Teléfono</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3 text-center">Visitas & Ventas</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No se encontraron clientes con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    const isSelected = selectedClientIds.includes(client.id);
                    const clientVisits = visits.filter((v) => v.clientId === client.id);
                    const completedVisits = clientVisits.filter((v) => v.status === 'completed').length;
                    const clientSales = clientVisits.reduce((acc, v) => acc + (v.saleAmount || 0), 0);
                    const cleanPhone = client.phone.replace(/[^0-9]/g, '');

                    return (
                      <tr
                        key={client.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelected ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(client.id)}
                            className="w-4 h-4 rounded text-blue-600 border-slate-300 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {client.code ? (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] border border-slate-200">
                              {client.code}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">s/c</span>
                          )}
                        </td>
                        <td className="p-3 min-w-[180px]">
                          <div
                            onClick={() => onViewClientDrawer(client.id)}
                            className="font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors flex items-center gap-1.5"
                            title="Click para ver ficha completa"
                          >
                            <span>{client.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">{client.company}</div>
                        </td>
                        <td className="p-3 min-w-[160px]">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span>{client.city}</span>
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              {client.pais || 'España'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px] mt-0.5" title={client.address}>
                            {client.address}
                          </div>
                        </td>
                        <td className="p-3 min-w-[180px]">
                          <div className="font-semibold text-slate-800">{client.contactName}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <a href={`tel:${client.phone}`} className="font-mono text-blue-600 hover:underline">
                              {client.phone}
                            </a>
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:text-emerald-700 font-bold text-xs"
                                title="Enviar WhatsApp"
                              >
                                💬 WA
                              </a>
                            )}
                          </div>
                          {client.email && (
                            <div className="mt-0.5">
                              <a
                                href={`mailto:${client.email}`}
                                className="text-[11px] text-slate-400 hover:text-slate-700 truncate max-w-[160px] inline-block"
                                title={client.email}
                              >
                                {client.email}
                              </a>
                            </div>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            {client.category}
                          </span>
                        </td>
                        <td className="p-3 text-center min-w-[140px]">
                          <div className="font-bold text-slate-900">
                            {clientVisits.length} {clientVisits.length === 1 ? 'visita' : 'visitas'}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {completedVisits} completadas {clientSales > 0 ? `· ${clientSales.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}` : ''}
                          </div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                sound.playClick();
                                onViewClientDrawer(client.id);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                              title="Ver ficha y trazabilidad"
                            >
                              Ficha
                            </button>
                            <button
                              onClick={() => {
                                sound.playClick();
                                onEditClient(client);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Editar cliente en Supabase"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => {
                                sound.playClick();
                                onScheduleVisitForClient(client.id);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                              title="Programar visita comercial"
                            >
                              + Visita
                            </button>
                            <button
                              onClick={() => {
                                sound.playClick();
                                onSelectClientAndGoToMap(client.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Ver en mapa"
                            >
                              📍
                            </button>
                            <button
                              onClick={() => {
                                sound.playClick();
                                if (window.confirm(`¿Eliminar al cliente ${client.name} del CRM y Supabase?`)) {
                                  onDeleteClient(client.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              title="Eliminar cliente"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards Mode */
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
              const isSelected = selectedClientIds.includes(client.id);
              const clientVisits = visits.filter((v) => v.clientId === client.id);
              const completedVisits = clientVisits.filter((v) => v.status === 'completed').length;
              const scheduledVisits = clientVisits.filter((v) => v.status === 'scheduled').length;
              const clientSales = clientVisits.reduce((acc, v) => acc + (v.saleAmount || 0), 0);
              const cleanPhone = client.phone.replace(/[^0-9]/g, '');

              return (
                <div
                  key={client.id}
                  className={`bg-white rounded-2xl border transition-all flex flex-col justify-between space-y-4 p-5 ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/15 shadow-sm'
                      : 'border-slate-200 shadow-2xs hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Top Row with Selector Checkbox & Badges */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(client.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 mt-1 cursor-pointer shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {client.code && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {client.code}
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50">
                              {client.category}
                            </span>
                          </div>
                          <h3
                            className="text-sm font-bold text-slate-900 mt-1 hover:text-blue-600 cursor-pointer transition-colors"
                            onClick={() => onViewClientDrawer(client.id)}
                          >
                            {client.name}
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            {client.company}
                          </p>
                        </div>
                      </div>

                      <span className="text-[11px] font-semibold text-slate-600 px-2 py-0.5 bg-slate-100 rounded-md shrink-0">
                        {client.pais || 'España'}
                      </span>
                    </div>

                    {/* Contact & Location Strip */}
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
                          {cleanPhone && (
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
                          )}
                        </div>
                      </div>

                      {client.email && (
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Email:</span>
                          <a href={`mailto:${client.email}`} className="text-slate-700 hover:underline truncate max-w-[180px]">
                            {client.email}
                          </a>
                        </div>
                      )}

                      <div className="flex items-start justify-between text-slate-600 gap-2">
                        <span className="text-slate-400 shrink-0">Ubicación:</span>
                        <span className="text-slate-700 text-right truncate max-w-[200px]" title={`${client.address}, ${client.city}, ${client.pais || 'España'}`}>
                          {client.address}, {client.city}
                        </span>
                      </div>
                    </div>

                    {/* Commercial & Visits Relationship Strip */}
                    <div className="mt-3 bg-slate-50 rounded-xl p-2.5 border border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
                      <div
                        onClick={() => onViewClientDrawer(client.id)}
                        className="cursor-pointer hover:bg-slate-100/60 p-1 rounded-lg transition-colors"
                      >
                        <span className="text-[10px] text-slate-400 block">Visitas Comerciales</span>
                        <span className="font-mono tabular-nums font-bold text-slate-800">
                          {clientVisits.length} ({completedVisits} completadas)
                        </span>
                        {scheduledVisits > 0 && (
                          <span className="text-[9px] font-bold text-blue-600 block mt-0.5">
                            {scheduledVisits} programada(s)
                          </span>
                        )}
                      </div>
                      <div className="p-1">
                        <span className="text-[10px] text-slate-400 block">Ventas Acumuladas</span>
                        <span className="font-mono tabular-nums font-bold text-slate-800">
                          {clientSales > 0 ? clientSales.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '0,00 €'}
                        </span>
                      </div>
                    </div>
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
                        title="Editar ficha de cliente en Supabase"
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

                    <button
                      onClick={() => {
                        sound.playClick();
                        if (window.confirm(`¿Eliminar la cuenta de ${client.name} de Supabase?`)) {
                          onDeleteClient(client.id);
                        }
                      }}
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Eliminar cliente individual"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
