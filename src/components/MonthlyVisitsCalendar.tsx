import React, { useState, useMemo, useEffect } from 'react';
import { Visit, Client, SalesRep, Sale, Article } from '../types';
import { sound } from '../utils/audioFeedback';

interface MonthlyVisitsCalendarProps {
  visits: Visit[];
  clients: Client[];
  salesReps: SalesRep[];
  sales?: Sale[];
  articles?: Article[];
  onOpenDayVisits: (dateString: string, dayVisits: Visit[]) => void;
  onNewVisitForDate: (dateString: string) => void;
  onMoveVisit: (visitId: string, newDateString: string) => void;
  onEditVisit: (visit: Visit) => void;
  onOpenCheckInModal: (visit: Visit) => void;
  onSelectClientAndGoToMap: (clientId: string) => void;
  onOpenClientSales?: (client: Client, visit?: Visit) => void;
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
  sales: _sales,
  articles: _articles,
  onOpenDayVisits,
  onNewVisitForDate,
  onMoveVisit,
  onEditVisit: _onEditVisit,
  onOpenCheckInModal: _onOpenCheckInModal,
  onSelectClientAndGoToMap: _onSelectClientAndGoToMap,
  onOpenClientSales,
}) => {
  // Calendar viewed month & year (defaults to today)
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());

  // View mode: monthly grid or weekly columns
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
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
    if (viewMode === 'week') {
      setWeekStart((w) => {
        const d = new Date(w);
        d.setDate(d.getDate() - 7);
        return d;
      });
      return;
    }
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    sound.playClick();
    if (viewMode === 'week') {
      setWeekStart((w) => {
        const d = new Date(w);
        d.setDate(d.getDate() + 7);
        return d;
      });
      return;
    }
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
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    setWeekStart(d);
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

  // Week days (Mon..Sun) for weekly view
  const weekDays = useMemo(() => {
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        dateString: ymd,
        label: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][i],
        display: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
        isToday: ymd === todayYmd,
      };
    });
  }, [weekStart, today]);

  const yearOptions = useMemo(() => {
    const base = today.getFullYear();
    return [base - 2, base - 1, base, base + 1, base + 2];
  }, [today]);

  const statusChipClass = (status: string) =>
    status === 'completed'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
      : status === 'in_progress'
      ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
      : status === 'cancelled'
      ? 'bg-slate-50 text-slate-500 border-slate-200 line-through'
      : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100';

  const renderChip = (visit: Visit, dateString: string, dayVisits: Visit[], compact: boolean) => {
    const client = clients.find((c) => c.id === visit.clientId);
    const isBeingDragged = draggedVisit?.id === visit.id;
    const rep = salesReps.find((r) => r.id === visit.repId);
    return (
      <div
        key={visit.id}
        draggable
        onDragStart={(e) => handleDragStart(e, visit)}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          e.stopPropagation();
          sound.playClick();
          onOpenDayVisits(dateString, dayVisits);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          sound.playClick();
          if (client && onOpenClientSales) onOpenClientSales(client, visit);
          else onOpenDayVisits(dateString, dayVisits);
        }}
        title={`${visit.scheduledTime || '09:00'} · ${client ? client.name : 'Cliente'}${rep ? ' · ' + rep.name : ''}\nDoble clic: ver compras del cliente. Arrastra para mover.`}
        className={`group/chip border rounded-[4px] cursor-grab active:cursor-grabbing select-none transition-colors ${
          isBeingDragged ? 'opacity-40 border-dashed border-blue-500' : statusChipClass(visit.status)
        } ${compact ? 'text-[9.5px] leading-tight px-1 py-[3px] flex items-center gap-1' : 'text-[11px] px-2 py-1.5'}`}
      >
        {compact ? (
          <>
            <span className="font-mono opacity-70 shrink-0">{visit.scheduledTime || '09:00'}</span>
            <span className="truncate flex-1 font-semibold">{client ? client.name : 'Cliente'}</span>
            <svg className="shrink-0 opacity-50" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono font-bold">{visit.scheduledTime || '09:00'}</span>
              {rep && <span className="text-[9px] opacity-60 truncate">{rep.name.split(' ')[0]}</span>}
            </div>
            <div className="font-semibold truncate mt-0.5">{client ? client.name : 'Cliente'}</div>
            {visit.objective && <div className="text-[10px] opacity-70 truncate">{visit.objective}</div>}
          </>
        )}
      </div>
    );
  };

  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      {toastNotification && (
        <div className="fixed top-20 right-6 z-50">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold ${
              toastNotification.type === 'success' ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200'
            }`}
          >
            <span>{toastNotification.message}</span>
            <button onClick={() => setToastNotification(null)} className="text-slate-400 hover:text-white ml-2 text-sm leading-none">
              ×
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs border border-slate-200">
              {(['month', 'week'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    sound.playClick();
                    setViewMode(m);
                  }}
                  className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 ${
                    viewMode === m ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  {m === 'month' ? 'Mensual' : 'Semanal'}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs border border-slate-200">
              <button onClick={handlePrevMonth} className="px-1.5 py-1 rounded-md hover:bg-white text-slate-600" title="Anterior">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button onClick={handleGoToToday} className="px-2.5 py-1 rounded-md hover:bg-white text-slate-700 font-medium">
                Hoy
              </button>
              <button onClick={handleNextMonth} className="px-1.5 py-1 rounded-md hover:bg-white text-slate-600" title="Siguiente">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {viewMode === 'month' ? (
              <div className="flex items-center gap-1">
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(Number(e.target.value))}
                  className="text-base font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                >
                  {MONTH_NAMES_ES.map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>
                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(Number(e.target.value))}
                  className="text-base font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer font-mono"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-slate-700">Semana:</span>
                <span className="font-mono px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                  {weekDays[0].display} al {weekDays[6].display}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <label className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-1 bg-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 16 0v1"/></svg>
              <select
                value={selectedRepFilter}
                onChange={(e) => setSelectedRepFilter(e.target.value)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none"
              >
                <option value="all">Todos los Comerciales</option>
                {salesReps.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-1 bg-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><path d="M3 6h18M7 12h10M10 18h4"/></svg>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none"
              >
                <option value="all">Todos los Estados</option>
                <option value="scheduled">Pendientes</option>
                <option value="in_progress">En curso</option>
                <option value="completed">Completadas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </label>
            <button
              onClick={() => {
                sound.playClick();
                onNewVisitForDate(todayYmd);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Programar Visita
            </button>
          </div>
        </div>

        {viewMode === 'month' ? (
          <>
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center">
              {WEEKDAYS_ES.map((dayName, idx) => (
                <div key={dayName} className={`py-2 text-xs font-medium ${idx >= 5 ? 'text-slate-400 bg-slate-100/60' : 'text-slate-700'}`}>
                  {dayName}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((cell, idx) => {
                const dayVisits = visitsByDate.get(cell.dateString) || [];
                const count = dayVisits.length;
                const isDropTarget = dragOverDateString === cell.dateString;
                const isWeekend = idx % 7 >= 5;
                return (
                  <div
                    key={cell.dateString}
                    onDoubleClick={() => handleDayDoubleClick(cell.dateString)}
                    onDragOver={(e) => handleDragOver(e, cell.dateString)}
                    onDragLeave={(e) => handleDragLeave(e, cell.dateString)}
                    onDrop={(e) => handleDrop(e, cell.dateString)}
                    className={`relative min-h-[88px] p-1.5 border-b border-r border-slate-200 select-none transition-colors group ${
                      idx % 7 === 6 ? 'border-r-0' : ''
                    } ${
                      isDropTarget
                        ? 'bg-blue-100 ring-2 ring-inset ring-blue-500'
                        : cell.isToday
                        ? 'bg-blue-50/60 ring-2 ring-inset ring-blue-600'
                        : isWeekend
                        ? 'bg-slate-50/60 hover:bg-slate-50'
                        : 'bg-white hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs font-medium ${
                            cell.isToday
                              ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold'
                              : cell.isCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {cell.dayNumber}
                        </span>
                        {cell.isToday && <span className="text-[10px] font-medium text-blue-700">Hoy</span>}
                      </div>
                      {count > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sound.playClick();
                            onOpenDayVisits(cell.dateString, dayVisits);
                          }}
                          className="min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center"
                          title={`${count} visita(s)`}
                        >
                          {count}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sound.playClick();
                            onNewVisitForDate(cell.dateString);
                          }}
                          className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded text-blue-600 hover:bg-blue-100 text-xs font-bold leading-none"
                          title="Programar visita"
                        >
                          +
                        </button>
                      )}
                    </div>
                    <div className="space-y-[3px]">
                      {dayVisits.slice(0, 3).map((v) => renderChip(v, cell.dateString, dayVisits, true))}
                      {count > 3 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDayVisits(cell.dateString, dayVisits);
                          }}
                          className="text-[9.5px] font-semibold text-blue-600 hover:underline"
                        >
                          +{count - 3} más
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-7 min-h-[420px]">
            {weekDays.map((day, idx) => {
              const dayVisits = [...(visitsByDate.get(day.dateString) || [])].sort((a, b) =>
                (a.scheduledTime || '').localeCompare(b.scheduledTime || '')
              );
              const isDropTarget = dragOverDateString === day.dateString;
              return (
                <div
                  key={day.dateString}
                  onDoubleClick={() => handleDayDoubleClick(day.dateString)}
                  onDragOver={(e) => handleDragOver(e, day.dateString)}
                  onDragLeave={(e) => handleDragLeave(e, day.dateString)}
                  onDrop={(e) => handleDrop(e, day.dateString)}
                  className={`flex flex-col ${idx < 6 ? 'border-r border-slate-200' : ''} ${
                    day.isToday ? 'ring-2 ring-inset ring-blue-600' : ''
                  } ${isDropTarget ? 'bg-blue-50' : ''}`}
                >
                  <div
                    className={`px-2 py-2 flex items-center justify-between border-b ${
                      day.isToday ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold uppercase tracking-wide">{day.label}</span>
                        {day.isToday && <span className="text-[8px] font-bold bg-white text-blue-700 rounded px-1">HOY</span>}
                      </div>
                      <div className={`text-[10px] font-mono ${day.isToday ? 'text-blue-100' : 'text-slate-400'}`}>{day.display}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`min-w-4 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                          day.isToday ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {dayVisits.length}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sound.playClick();
                          onNewVisitForDate(day.dateString);
                        }}
                        className={`w-4 h-4 text-sm leading-none font-bold ${day.isToday ? 'text-white' : 'text-slate-400 hover:text-blue-600'}`}
                        title="Programar visita"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 p-1.5 space-y-1.5">
                    {dayVisits.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-10">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300 mb-1"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        <span className="text-[11px] font-medium text-slate-500">Sin visitas</span>
                        <span className="text-[10px]">Doble clic para programar</span>
                      </div>
                    ) : (
                      dayVisits.map((v) => renderChip(v, day.dateString, dayVisits, false))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {draggedVisit && (
        <div className="text-center text-xs text-blue-700">
          Suelta la visita sobre otro día para reprogramarla.
        </div>
      )}

      {monthStats.monthTotalVisits > 0 && viewMode === 'month' && (
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 px-1">
          <span>
            <strong className="text-slate-700">{monthStats.monthTotalVisits}</strong> visitas en {MONTH_NAMES_ES[currentMonth]}
          </span>
          <span>
            <strong className="text-emerald-700">{monthStats.monthCompletedVisits}</strong> completadas
          </span>
          <span>
            <strong className="text-slate-700">{monthStats.daysWithVisits}</strong> días con actividad
          </span>
          <span className="ml-auto">Doble clic en un día para ver o programar · Arrastra una visita para moverla</span>
        </div>
      )}
    </div>
  );

};
