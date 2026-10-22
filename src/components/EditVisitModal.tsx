import React, { useState } from 'react';
import { Visit, Client, SalesRep, VisitStatus, VisitOutcome } from '../types';
import { sound } from '../utils/audioFeedback';

interface EditVisitModalProps {
  visit: Visit;
  clients: Client[];
  salesReps: SalesRep[];
  onClose: () => void;
  onSaveVisit: (updatedVisit: Visit) => void;
}

export const EditVisitModal: React.FC<EditVisitModalProps> = ({
  visit,
  clients,
  salesReps,
  onClose,
  onSaveVisit,
}) => {
  const [repId, setRepId] = useState(visit.repId);
  const [clientId, setClientId] = useState(visit.clientId);
  const [scheduledDate, setScheduledDate] = useState(visit.scheduledDate);
  const [scheduledTime, setScheduledTime] = useState(visit.scheduledTime);
  const [status, setStatus] = useState<VisitStatus>(visit.status);
  const [objective, setObjective] = useState(visit.objective);
  const [outcome, setOutcome] = useState<VisitOutcome | ''>(visit.outcome || '');
  const [saleAmount, setSaleAmount] = useState<string>(visit.saleAmount ? String(visit.saleAmount) : '');
  const [durationMinutes, setDurationMinutes] = useState<number>(visit.durationMinutes || 30);
  const [notes, setNotes] = useState(visit.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repId || !clientId || !scheduledDate || !scheduledTime) return;

    sound.playSuccess();

    const parsedSale = saleAmount.trim() ? parseFloat(saleAmount) : undefined;

    const updated: Visit = {
      ...visit,
      repId,
      clientId,
      scheduledDate,
      scheduledTime,
      status,
      objective: objective.trim(),
      outcome: outcome ? (outcome as VisitOutcome) : undefined,
      saleAmount: parsedSale && !isNaN(parsedSale) ? parsedSale : undefined,
      durationMinutes: Number(durationMinutes) || 30,
      notes: notes.trim(),
    };

    onSaveVisit(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Editar Visita Comercial</h3>
            <p className="text-xs text-slate-500">Modificar datos, estado, horario o resultados de la visita</p>
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
          {/* Client & Rep */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cliente *</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.city})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vendedor Asignado *</label>
              <select
                value={repId}
                onChange={(e) => setRepId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {salesReps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fecha Programada *</label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Hora Programada *</label>
              <input
                type="time"
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Objective */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Objetivo de la Visita</label>
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Ej: Presentación de catálogo de temporada..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status & Outcome */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Estado de Visita</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as VisitStatus)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="scheduled">Programada</option>
                <option value="in_progress">En Curso</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Resultado Comercial</label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as VisitOutcome)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">(Sin definir)</option>
                <option value="sale_closed">Venta Cerrada</option>
                <option value="negotiation">En Negociación</option>
                <option value="rescheduled">Reprogramada</option>
                <option value="not_interested">No Interesado</option>
                <option value="contact_absent">Contacto Ausente</option>
              </select>
            </div>
          </div>

          {/* Sale Amount & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Importe de Venta (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={saleAmount}
                onChange={(e) => setSaleAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Duración (minutos)</label>
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notas Comerciales / Resumen</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles de la reunión, compromisos o seguimiento..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Actions */}
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
              Guardar Visita
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
