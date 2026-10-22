import React from 'react';
import { Visit, Client, SalesRep } from '../types';
import { sound } from '../utils/audioFeedback';

interface DayVisitsModalProps {
  dateString: string; // YYYY-MM-DD
  visits: Visit[];
  clients: Client[];
  salesReps: SalesRep[];
  onClose: () => void;
  onNewVisitForDate: (dateString: string) => void;
  onEditVisit: (visit: Visit) => void;
  onDeleteVisit: (visitId: string) => void;
  onOpenCheckInModal: (visit: Visit) => void;
  onSelectClientAndGoToMap: (clientId: string) => void;
}

export const DayVisitsModal: React.FC<DayVisitsModalProps> = ({
  dateString,
  visits,
  clients,
  salesReps,
  onClose,
  onNewVisitForDate,
  onEditVisit,
  onDeleteVisit,
  onOpenCheckInModal,
  onSelectClientAndGoToMap,
}) => {
  // Format Date in Spanish: e.g. "Jueves, 22 de Octubre de 2026"
  const formattedDate = (() => {
    try {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const text = d.toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        return text.charAt(0).toUpperCase() + text.slice(1);
      }
    } catch {
      // fallback
    }
    return dateString;
  })();

  const sortedVisits = [...visits].sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
  const totalSales = visits.reduce((acc, v) => acc + (v.saleAmount || 0), 0);
  const completedCount = visits.filter((v) => v.status === 'completed').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{formattedDate}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                  {visits.length} {visits.length === 1 ? 'visita' : 'visitas'}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {completedCount} completadas {totalSales > 0 ? `· ${totalSales.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} en ventas` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playClick();
                onNewVisitForDate(dateString);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>+ Nueva Visita</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              title="Cerrar ventana"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
          {sortedVisits.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">No hay visitas programadas para este día</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Puedes registrar una visita comercial para el {formattedDate} con el botón inferior.
                </p>
              </div>
              <button
                onClick={() => {
                  sound.playClick();
                  onNewVisitForDate(dateString);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                <span>+ Programar Visita para {dateString}</span>
              </button>
            </div>
          ) : (
            sortedVisits.map((visit) => {
              const client = clients.find((c) => c.id === visit.clientId);
              const rep = salesReps.find((r) => r.id === visit.repId);
              const cleanPhone = client?.phone?.replace(/[^0-9]/g, '');

              const statusBadge = (() => {
                switch (visit.status) {
                  case 'completed':
                    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Completada</span>;
                  case 'in_progress':
                    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">En curso</span>;
                  case 'cancelled':
                    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">Cancelada</span>;
                  default:
                    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Programada</span>;
                }
              })();

              return (
                <div
                  key={visit.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-sm transition-all"
                >
                  {/* Top line: Time, Rep, Status */}
                  <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-black px-2 py-0.5 bg-slate-900 text-white rounded-md tracking-wider">
                        {visit.scheduledTime || '09:00'}
                      </span>
                      {statusBadge}
                      {client?.code && (
                        <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {client.code}
                        </span>
                      )}
                    </div>

                    {rep && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                        <img
                          src={rep.avatar}
                          alt={rep.name}
                          className="w-5 h-5 rounded-full object-cover border border-slate-200"
                        />
                        <span>{rep.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Client Info & Objective */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {client ? client.name : 'Cliente no encontrado'}
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        {client ? `${client.company} · ${client.category}` : ''}
                      </div>
                      {client && (
                        <div className="text-slate-600 text-[11px] mt-1 flex items-start gap-1">
                          <span className="text-slate-400">📍</span>
                          <span className="truncate max-w-[240px]" title={`${client.address}, ${client.city}`}>
                            {client.address}, {client.city}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">Objetivo: </span>
                        <span>{visit.objective || 'Visita comercial de rutina'}</span>
                      </div>

                      {client && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                          <span className="text-slate-400">Contacto:</span>
                          <span className="font-semibold">{client.contactName}</span>
                          <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline font-mono">
                            {client.phone}
                          </a>
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 font-bold"
                              title="WhatsApp"
                            >
                              💬
                            </a>
                          )}
                        </div>
                      )}

                      {visit.status === 'completed' && (
                        <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100 text-[11px] text-emerald-900 mt-1">
                          <div className="flex items-center justify-between font-bold">
                            <span>Venta cerrada:</span>
                            <span>{visit.saleAmount ? visit.saleAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '0,00 €'}</span>
                          </div>
                          {visit.notes && (
                            <p className="text-[10px] text-emerald-800 italic mt-0.5 truncate">
                              "{visit.notes}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions bar */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          sound.playClick();
                          onClose();
                          onOpenCheckInModal(visit);
                        }}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors"
                      >
                        {visit.status === 'completed' ? 'Ver Check-In' : 'Iniciar Check-In'}
                      </button>

                      <button
                        onClick={() => {
                          sound.playClick();
                          onClose();
                          onEditVisit(visit);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Editar
                      </button>

                      {client && (
                        <button
                          onClick={() => {
                            sound.playClick();
                            onClose();
                            onSelectClientAndGoToMap(client.id);
                          }}
                          className="px-2 py-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 text-xs transition-colors flex items-center gap-1"
                          title="Ver en mapa"
                        >
                          <span>📍 Mapa</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        sound.playClick();
                        if (window.confirm('¿Estás seguro de que deseas eliminar esta visita?')) {
                          onDeleteVisit(visit.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 text-xs transition-colors"
                      title="Eliminar visita"
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Consejo: Haz doble clic en cualquier día del calendario para abrir sus visitas o crear una nueva.</span>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
