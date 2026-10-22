import React, { useState } from 'react';
import { Visit, Client, SalesRep } from '../types';
import { exportVisitsToCsv, formatDistance, formatDuration } from '../utils/geoUtils';
import { sound } from '../utils/audioFeedback';

interface VisitsHistoryModalProps {
  visits: Visit[];
  clients: Client[];
  salesReps: SalesRep[];
  onClose: () => void;
  onEditVisit?: (visit: Visit) => void;
  onDeleteVisit?: (visitId: string) => void;
  onDeleteMultipleVisits?: (visitIds: string[]) => void;
}

export const VisitsHistoryModal: React.FC<VisitsHistoryModalProps> = ({
  visits,
  clients,
  salesReps,
  onClose,
  onEditVisit,
  onDeleteVisit,
  onDeleteMultipleVisits,
}) => {
  const [filterRep, setFilterRep] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVisitIds, setSelectedVisitIds] = useState<string[]>([]);

  const enrichedVisits = visits.map((v) => {
    const rep = salesReps.find((r) => r.id === v.repId);
    const client = clients.find((c) => c.id === v.clientId);
    return {
      ...v,
      repName: rep?.name || 'Vendedor',
      clientCode: client?.code || '',
      clientCompany: client?.company || 'Empresa',
      clientName: client?.name || 'Cliente',
      clientContact: client?.contactName || '',
      clientAddress: client?.address || '',
      clientCity: client?.city || '',
      clientPais: client?.pais || 'España',
    };
  });

  const filteredVisits = enrichedVisits.filter((v) => {
    if (filterRep !== 'all' && v.repId !== filterRep) return false;
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        v.clientName.toLowerCase().includes(q) ||
        v.clientCompany.toLowerCase().includes(q) ||
        v.repName.toLowerCase().includes(q) ||
        (v.objective && v.objective.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Toggle selection
  const handleToggleSelect = (visitId: string) => {
    sound.playClick();
    setSelectedVisitIds((prev) =>
      prev.includes(visitId) ? prev.filter((id) => id !== visitId) : [...prev, visitId]
    );
  };

  const handleSelectAll = () => {
    sound.playClick();
    if (selectedVisitIds.length === filteredVisits.length) {
      setSelectedVisitIds([]);
    } else {
      setSelectedVisitIds(filteredVisits.map((v) => v.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedVisitIds.length === 0 || !onDeleteMultipleVisits) return;
    sound.playClick();
    const count = selectedVisitIds.length;
    if (window.confirm(`¿Eliminar los ${count} registros de visitas seleccionados?`)) {
      onDeleteMultipleVisits(selectedVisitIds);
      setSelectedVisitIds([]);
    }
  };

  const handleDownloadCsv = (onlySelected = false) => {
    sound.playClick();
    const target = onlySelected
      ? enrichedVisits.filter((v) => selectedVisitIds.includes(v.id))
      : filteredVisits;

    const csvContent = exportVisitsToCsv(target);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `auditoria_visitas_${onlySelected ? 'seleccionadas_' : ''}${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isAllSelected = filteredVisits.length > 0 && selectedVisitIds.length === filteredVisits.length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="text-emerald-700 font-semibold">Completada</span>;
      case 'in_progress':
        return <span className="text-blue-700 font-semibold">En Curso</span>;
      case 'scheduled':
        return <span className="text-amber-700 font-semibold">Programada</span>;
      case 'cancelled':
        return <span className="text-red-700 font-semibold">Cancelada</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <img 
              src="/assets/aistudio/geo-logo-design-inspiration-for-a-unique-identity-modern-elegance-and-creative-design-watermark-your-success-with-the-striking-this-logo-vector_47d08a1d.jpg" 
              alt="GEO Logo" 
              className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shadow-xs shrink-0"
            />
            <div>
              <h3 className="text-base font-semibold text-slate-900">Auditoría y Registro Histórico de Visitas</h3>
              <p className="text-xs text-slate-500">Historial completo con selección de registros, edición y auditoría GPS</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDownloadCsv(false)}
              className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Exportar Todo CSV</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center gap-3 shrink-0 text-xs">
          <input
            type="text"
            placeholder="Buscar por cliente, empresa, vendedor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={filterRep}
            onChange={(e) => setFilterRep(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="all">Todos los Vendedores</option>
            {salesReps.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="all">Todos los Estados</option>
            <option value="completed">Completada</option>
            <option value="in_progress">En Curso</option>
            <option value="scheduled">Programada</option>
            <option value="cancelled">Cancelada</option>
          </select>

          <span className="text-slate-400 text-xs ml-auto font-mono tabular-nums">
            {filteredVisits.length} registros
          </span>
        </div>

        {/* Bulk Action Strip when selected */}
        {selectedVisitIds.length > 0 && (
          <div className="bg-slate-900 text-white px-6 py-2.5 flex items-center justify-between text-xs shrink-0 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center font-mono font-bold text-[11px]">
                {selectedVisitIds.length}
              </span>
              <span className="font-semibold">
                {selectedVisitIds.length === 1 ? '1 visita seleccionada' : `${selectedVisitIds.length} visitas seleccionadas`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadCsv(true)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
              >
                Exportar Selección CSV
              </button>

              {onDeleteMultipleVisits && (
                <button
                  onClick={handleDeleteSelected}
                  className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-bold transition-colors flex items-center gap-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  <span>Eliminar en Grupo ({selectedVisitIds.length})</span>
                </button>
              )}

              <button
                onClick={() => setSelectedVisitIds([])}
                className="text-slate-400 hover:text-white px-2 py-1 transition-colors"
              >
                Deseleccionar
              </button>
            </div>
          </div>
        )}

        {/* Audit Table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Cliente / Empresa</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Horario</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Auditoría GPS Check-in</th>
                <th className="px-4 py-3">Duración</th>
                <th className="px-4 py-3 text-right">Resultado / Venta</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    No se encontraron visitas con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredVisits.map((v) => {
                  const isSelected = selectedVisitIds.includes(v.id);

                  return (
                    <tr
                      key={v.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(v.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {v.clientCode && (
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {v.clientCode}
                            </span>
                          )}
                          <span className="font-semibold text-slate-900">{v.clientName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{v.clientCompany} · {v.clientCity || v.clientAddress} ({v.clientPais})</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {v.repName}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-600">
                        <div>{v.scheduledDate}</div>
                        <div className="text-[11px] text-slate-400">{v.scheduledTime}</div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(v.status)}
                      </td>
                      <td className="px-4 py-3">
                        {v.checkInTime ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[11px] font-semibold ${v.isWithinGeofence ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {v.isWithinGeofence ? '✓ Geocerca Válida' : '⚠ Remoto'}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="font-mono tabular-nums text-slate-600 text-[11px]">
                                {formatDistance(v.checkInDistanceMeters ?? 0)}
                              </span>
                            </div>
                            <div className="font-mono tabular-nums text-[10px] text-slate-400">
                              {v.checkInCoords?.lat.toFixed(5)}, {v.checkInCoords?.lng.toFixed(5)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pendiente de llegada</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-mono tabular-nums">
                        {v.durationMinutes ? formatDuration(v.durationMinutes) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {v.saleAmount ? (
                          <div className="font-mono tabular-nums font-bold text-slate-900">
                            {v.saleAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                        {v.outcome && (
                          <div className="text-[10px] text-slate-500 capitalize">
                            {v.outcome.replace('_', ' ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {onEditVisit && (
                            <button
                              onClick={() => {
                                sound.playClick();
                                const origVisit = visits.find((item) => item.id === v.id);
                                if (origVisit) onEditVisit(origVisit);
                              }}
                              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Editar visita"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9"/>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                              </svg>
                            </button>
                          )}

                          {onDeleteVisit && (
                            <button
                              onClick={() => {
                                sound.playClick();
                                if (window.confirm(`¿Eliminar la visita de ${v.clientName}?`)) {
                                  onDeleteVisit(v.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar visita individual"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Total visitas registradas: <strong className="text-slate-800">{enrichedVisits.length}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
