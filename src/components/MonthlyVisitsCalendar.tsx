import React, { useState, useMemo, useEffect } from 'react';
import { Visit, Client, SalesRep } from '../types';
import { sound } from '../utils/audioFeedback';

interface MonthlyVisitsCalendarProps {
  visits: Visit[];
  clients: Client[];
  salesReps: SalesRep[];
  onOpenDayVisits: (dateString: string, dayVisits: Visit[]) => void;
  onNewVisitForDate: (dateString: string) => void;
  onMoveVisit: (visitId: string, newDateString: string) => void;
  onEditVisit: (visit: Visit) => void;
  onOpenCheckInModal: (visit: Visit) => void;
  onSelectClientAndGoToMap: (clientId: string) => void;
}

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const MonthlyVisitsCalendar: React.FC<MonthlyVisitsCalendarProps> = ({
  visits,
  clients,
  salesReps,
  onOpenDayVisits,
  onNewVisitForDate,
  onMoveVisit,
  onEditVisit: _onEditVisit,
  onOpenCheckInModal: _onOpenCheckInModal,
  onSelectClientAndGoToMap: _onSelectClientAndGoToMap,
}) => {
  // Calendar viewed month & year
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(() => {
    if (visits.length > 0) {
      const parts = visits[0].scheduledDate.split('-');
      if (parts[0]) return Number(parts[0]);
    }
    return today.getFullYear();
  });

  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    if (visits.length > 0) {
      const parts = visits[0].scheduledDate.split('-');
      if (parts[1]) return Number(parts[1]) - 1;
    }
    return today.getMonth();
  });

  // Filters
  const [selectedRepFilter, setSelectedRepFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Drag and Drop States
  const [draggedVisit, setDraggedVisit] = useState<Visit | null>(null);
  const [dragOverDateString, setDragOverDateString] = useState<string | null>(null);
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    type: 'success' | 'info';
  } | null>(null);

  // Auto-dismiss toast after 3.5s
  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => {
      setToastNotification(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  // Month navigation
  const handlePrevMonth = () => {
    sound.playClick();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    sound.playClick();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToToday = () => {
    sound.playClick();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Filtered visits
  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      if (selectedRepFilter !== 'all' && v.repId !== selectedRepFilter) return false;
      if (selectedStatusFilter !== 'all' && v.status !== selectedStatusFilter) return false;
      return true;
    });
  }, [visits, selectedRepFilter, selectedStatusFilter]);

  // Visits map by date: "YYYY-MM-DD" -> Visit[]
  const visitsByDate = useMemo(() => {
    const map = new Map<string, Visit[]>();
    for (const v of filteredVisits) {
      if (!v.scheduledDate) continue;
      const list = map.get(v.scheduledDate) || [];
      list.push(v);
      map.set(v.scheduledDate, list);
    }
    return map;
  }, [filteredVisits]);

  // Month calculation (Monday-first: Monday=0, Sunday=6)
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    // JS Sunday is 0, Monday is 1 -> Monday-first offset:
    const startingOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: Array<{
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;

    // Previous month leading days
    for (let i = startingOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({
        dateString: dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({
        dateString: dateStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month trailing days to complete full grid (multiples of 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({
        dateString: dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [currentYear, currentMonth, today]);

  // Stats for the viewed month
  const monthStats = useMemo(() => {
    let monthTotalVisits = 0;
    let monthCompletedVisits = 0;
    let monthSales = 0;
    const activeDaysSet = new Set<string>();

    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    for (const v of filteredVisits) {
      if (v.scheduledDate && v.scheduledDate.startsWith(monthPrefix)) {
        monthTotalVisits++;
        if (v.status === 'completed') monthCompletedVisits++;
        monthSales += v.saleAmount || 0;
        activeDaysSet.add(v.scheduledDate);
      }
    }

    return {
      monthTotalVisits,
      monthCompletedVisits,
      monthSales,
      daysWithVisits: activeDaysSet.size,
    };
  }, [currentYear, currentMonth, filteredVisits]);

  // Handle Double Click on a day
  const handleDayDoubleClick = (dateString: string) => {
    sound.playClick();
    const dayVisits = visitsByDate.get(dateString) || [];
    if (dayVisits.length > 0) {
      onOpenDayVisits(dateString, dayVisits);
    } else {
      onNewVisitForDate(dateString);
    }
  };

  // DRAG & DROP HANDLERS
  const handleDragStart = (e: React.DragEvent, visit: Visit) => {
    e.stopPropagation();
    setDraggedVisit(visit);
    e.dataTransfer.setData('text/plain', visit.id);
    e.dataTransfer.setData('application/geoventas-visit', JSON.stringify({ id: visit.id, fromDate: visit.scheduledDate }));
    e.dataTransfer.effectAllowed = 'move';
    sound.playClick();
  };

  const handleDragEnd = () => {
    setDraggedVisit(null);
    setDragOverDateString(null);
  };

  const handleDragOver = (e: React.DragEvent, cellDateString: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDateString !== cellDateString) {
      setDragOverDateString(cellDateString);
    }
  };

  const handleDragLeave = (e: React.DragEvent, cellDateString: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    if (dragOverDateString === cellDateString) {
      setDragOverDateString(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetDateString: string) => {
    e.preventDefault();
    e.stopPropagation();

    const visitId = e.dataTransfer.getData('text/plain') || draggedVisit?.id;
    setDragOverDateString(null);
    setDraggedVisit(null);

    if (!visitId) return;

    const targetVisit = visits.find((v) => v.id === visitId);
    if (!targetVisit) return;

    if (targetVisit.scheduledDate === targetDateString) {
      setToastNotification({
        message: 'La visita ya está programada para esta fecha.',
        type: 'info',
      });
      return;
    }

    const client = clients.find((c) => c.id === targetVisit.clientId);
    const clientName = client ? client.name : 'Cliente';

    // Format new date nicely for feedback (e.g. "24/10/2026")
    const dateParts = targetDateString.split('-');
    const formattedTarget = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : targetDateString;

    // Trigger update
    onMoveVisit(visitId, targetDateString);
    sound.playSuccess();

    setToastNotification({
      message: `✅ Visita de ${clientName} movida al ${formattedTarget} con éxito.`,
      type: 'success',
    });
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification for Drag & Drop feedback */}
      {toastNotification && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold ${
              toastNotification.type === 'success'
                ? 'bg-slate-900 text-white border-emerald-500 shadow-emerald-500/10'
                : 'bg-white text-slate-800 border-slate-200 shadow-slate-900/10'
            }`}
          >
            <span>{toastNotification.message}</span>
            <button
              onClick={() => setToastNotification(null)}
              className="text-slate-400 hover:text-white ml-2 text-sm leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Dragging Active Helper Banner */}
      {draggedVisit && (
        <div className="bg-blue-600 text-white px-4 py-2.5 rounded-2xl shadow-lg flex items-center justify-between gap-3 text-xs animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-base">🖐️</span>
            <span>
              <strong>Arrastrando visita:</strong> Suelta la visita sobre cualquier día del calendario para moverla y reprogramarla.
            </span>
          </div>
          <span className="text-[11px] bg-blue-700/80 px-2 py-0.5 rounded-lg border border-blue-400/40 font-mono">
            {draggedVisit.scheduledTime || '09:00'} · {clients.find((c) => c.id === draggedVisit.clientId)?.name || 'Cliente'}
          </span>
        </div>
      )}

      {/* Top Header & Context */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                📅
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Calendario Mensual de Visitas
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Interactivo · Arrastrar y Soltar
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Visualiza el recuento diario de visitas. <strong>Arrastra cualquier visita</strong> de un día a otro para moverla libremente. Haz <strong>doble clic</strong> en un día con visitas para verlas en otra ventana, o en un día vacío para crear una nueva.
            </p>
          </div>

          {/* Month Controls & Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 transition-colors"
                title="Mes anterior"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>

              <span className="px-3 text-xs font-black text-slate-900 tracking-wide min-w-[140px] text-center select-none">
                {MONTH_NAMES_ES[currentMonth]} {currentYear}
              </span>

              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 transition-colors"
                title="Mes siguiente"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>

            <button
              onClick={handleGoToToday}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors"
            >
              Hoy
            </button>

            <button
              onClick={() => {
                sound.playClick();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
                  today.getDate()
                ).padStart(2, '0')}`;
                onNewVisitForDate(todayStr);
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>+ Programar Visita</span>
            </button>
          </div>
        </div>

        {/* Filters & Month KPIs Strip */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Rep filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Filtrar por Vendedor:</label>
            <select
              value={selectedRepFilter}
              onChange={(e) => setSelectedRepFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los vendedores ({salesReps.length})</option>
              {salesReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.territory})
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Estado de Visita:</label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="scheduled">Programadas</option>
              <option value="completed">Completadas</option>
              <option value="in_progress">En curso</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </div>

          {/* Month KPI 1 */}
          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total en el Mes</span>
              <span className="text-base font-black text-slate-900 font-mono">
                {monthStats.monthTotalVisits} visitas
              </span>
            </div>
            <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md">
              {monthStats.daysWithVisits} días activos
            </span>
          </div>

          {/* Month KPI 2 */}
          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Ventas Cerradas</span>
              <span className="text-base font-black text-emerald-600 font-mono">
                {monthStats.monthSales.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </span>
            </div>
            <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
              {monthStats.monthCompletedVisits} completadas
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100/70 text-center">
          {WEEKDAYS_ES.map((dayName, idx) => (
            <div
              key={dayName}
              className={`py-2.5 text-xs font-bold tracking-wider uppercase ${
                idx >= 5 ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* 7-Column Days Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {calendarDays.map((cell) => {
            const dayVisits = visitsByDate.get(cell.dateString) || [];
            const count = dayVisits.length;
            const completedCount = dayVisits.filter((v) => v.status === 'completed').length;
            const hasSales = dayVisits.some((v) => (v.saleAmount || 0) > 0);
            const isDropTarget = dragOverDateString === cell.dateString;

            return (
              <div
                key={cell.dateString}
                onDoubleClick={() => handleDayDoubleClick(cell.dateString)}
                onDragOver={(e) => handleDragOver(e, cell.dateString)}
                onDragLeave={(e) => handleDragLeave(e, cell.dateString)}
                onDrop={(e) => handleDrop(e, cell.dateString)}
                className={`min-h-[115px] sm:min-h-[130px] p-2 flex flex-col justify-between transition-all select-none relative group ${
                  isDropTarget
                    ? 'ring-2 ring-blue-500 bg-blue-100/90 z-20 scale-[1.01] shadow-md'
                    : !cell.isCurrentMonth
                    ? 'bg-slate-50/50 opacity-40 hover:opacity-80'
                    : cell.isToday
                    ? 'bg-blue-50/30'
                    : 'bg-white hover:bg-slate-50/80'
                } ${count > 0 && !isDropTarget ? 'hover:ring-1 hover:ring-blue-400/50' : ''}`}
                title={`Fecha: ${cell.dateString}. ${
                  count > 0
                    ? `Tiene ${count} visita(s). Arrastra una visita para moverla o haz doble clic para abrir ventana.`
                    : 'Sin visitas. Arrastra aquí una visita para moverla a este día, o haz doble clic para crear nueva.'
                }`}
              >
                {/* Visual Drop Target Overlay */}
                {isDropTarget && (
                  <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[1px] border-2 border-dashed border-blue-500 rounded-xl flex flex-col items-center justify-center p-2 text-center pointer-events-none z-30 animate-pulse">
                    <span className="text-xl">📥</span>
                    <span className="text-[11px] font-black text-blue-900 leading-tight">Soltar aquí</span>
                    <span className="text-[9px] font-bold text-blue-700 mt-0.5">Mover al {cell.dayNumber} {MONTH_NAMES_ES[currentMonth]}</span>
                  </div>
                )}

                {/* Top Row: Day Number + Visit Count Badge ("un 3 en ese dia del calendario") + Quick Add Button */}
                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    {/* Day number */}
                    <span
                      className={`text-xs font-bold flex items-center justify-center rounded-full ${
                        cell.isToday
                          ? 'w-6 h-6 bg-blue-600 text-white shadow-xs'
                          : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* PROMINENT COUNT BADGE: Exactly as requested ("un 3 en ese dia del calendario") */}
                    {count > 0 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          sound.playClick();
                          onOpenDayVisits(cell.dateString, dayVisits);
                        }}
                        className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-black rounded-full shadow-2xs border transition-transform hover:scale-110 cursor-pointer ${
                          completedCount === count
                            ? 'bg-emerald-500 text-white border-emerald-600'
                            : completedCount > 0
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-blue-500 text-white border-blue-600'
                        }`}
                        title={`${count} ${count === 1 ? 'visita' : 'visitas'} el ${cell.dateString}. Click o doble clic para abrir ventana.`}
                      >
                        {count}
                      </span>
                    )}
                  </div>

                  {/* Add (+) quick button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playClick();
                      onNewVisitForDate(cell.dateString);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-md bg-blue-100 hover:bg-blue-600 hover:text-white text-blue-700 flex items-center justify-center text-xs font-black shadow-2xs"
                    title={`Meter visita nueva para el ${cell.dateString}`}
                  >
                    +
                  </button>
                </div>

                {/* Middle Content: Mini Visit Chips preview with DRAGGABLE support */}
                <div className="my-1.5 space-y-1 overflow-hidden flex-1">
                  {count > 0 ? (
                    dayVisits.slice(0, 3).map((visit) => {
                      const client = clients.find((c) => c.id === visit.clientId);
                      const isCompleted = visit.status === 'completed';
                      const isBeingDragged = draggedVisit?.id === visit.id;

                      return (
                        <div
                          key={visit.id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, visit)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            sound.playClick();
                            onOpenDayVisits(cell.dateString, dayVisits);
                          }}
                          className={`text-[10px] leading-tight px-1.5 py-1 rounded-md font-medium border flex items-center gap-1.5 cursor-grab active:cursor-grabbing transition-all select-none group/chip ${
                            isBeingDragged
                              ? 'opacity-40 border-dashed border-blue-500 bg-blue-50 scale-95'
                              : isCompleted
                              ? 'bg-emerald-50/90 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 shadow-2xs'
                              : 'bg-blue-50/90 text-blue-800 border-blue-200 hover:bg-blue-100 hover:border-blue-300 shadow-2xs'
                          }`}
                          title={`🖐️ Arrastra para mover esta visita a otro día. Doble clic para abrir ventana.`}
                        >
                          {/* Drag handle icon */}
                          <span
                            className="text-slate-400 group-hover/chip:text-blue-600 font-mono text-[9px] shrink-0 cursor-grab"
                            title="Arrastra para mover"
                          >
                            ⋮⋮
                          </span>
                          <span className="font-mono font-bold shrink-0">{visit.scheduledTime || '09:00'}</span>
                          <span className="truncate flex-1 font-semibold">{client ? client.name : 'Cliente'}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Doble clic para crear</span>
                    </div>
                  )}

                  {count > 3 && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        sound.playClick();
                        onOpenDayVisits(cell.dateString, dayVisits);
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:underline pl-0.5 cursor-pointer"
                    >
                      +{count - 3} más (ver todas)...
                    </div>
                  )}
                </div>

                {/* Bottom Row: Day indicator badges */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100/60">
                  {count > 0 ? (
                    <span className="text-[10px] font-semibold text-slate-500">
                      {count === 1 ? '1 visita' : `${count} visitas`}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-300">Vacío</span>
                  )}

                  {hasSales && (
                    <span className="font-bold text-emerald-600 text-[10px]" title="Venta cerrada">
                      €
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend & Instructions helper */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px]">
              3
            </span>
            <span className="font-medium text-slate-700">Número de visitas en ese día</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[11px]">
              ✓
            </span>
            <span>Todas completadas</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded text-[10px] font-bold flex items-center gap-1">
              <span>⋮⋮</span>
              <span>Arrastrable</span>
            </span>
          </div>
        </div>

        <div className="text-slate-500 text-right text-[11px]">
          <span>💡 <strong>Arrastrar y Soltar:</strong> Arrastra cualquier cajita de visita con el ratón hacia otro día para reprogramarla al instante.</span>
        </div>
      </div>
    </div>
  );
};
