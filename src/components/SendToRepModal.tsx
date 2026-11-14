import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Client, SalesRep, Visit } from '../types';
import { sound } from '../utils/audioFeedback';

/**
 * Enviar visitas + Excel a un comercial/representante.
 *
 * Canales (sin backend):
 *  - "Compartir" → Web Share API con el Excel adjunto (móvil: WhatsApp, Gmail, Telegram…).
 *  - WhatsApp     → abre wa.me al teléfono del comercial con el listado de visitas en el texto
 *                   y descarga el Excel para adjuntarlo.
 *  - Email        → abre el cliente de correo (mailto) con el listado y descarga el Excel.
 *  - Descargar    → solo el Excel.
 */

interface SendToRepModalProps {
  salesReps: SalesRep[];
  clients: Client[];
  visits: Visit[];
  initialRepId?: string;
  onClose: () => void;
}

type Period = 'all' | 'upcoming' | 'today' | 'tomorrow' | 'week' | 'next_week' | 'month' | 'custom';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'upcoming', label: 'Desde hoy' },
  { id: 'today', label: 'Hoy' },
  { id: 'tomorrow', label: 'Mañana' },
  { id: 'week', label: 'Esta semana' },
  { id: 'next_week', label: 'Próxima semana' },
  { id: 'month', label: 'Este mes' },
  { id: 'custom', label: 'Personalizado' },
];

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Pendiente',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDate = (s: string) => {
  const p = (s || '').split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
};
const fmtShort = (s: string) => {
  const p = (s || '').split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}` : s;
};
const slug = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

function rangeFor(p: Period, from: string, to: string): [string, string] {
  const now = new Date();
  switch (p) {
    case 'all':
      return ['0000-01-01', '9999-12-31'];
    case 'upcoming':
      return [toYmd(now), '9999-12-31'];
    case 'today':
      return [toYmd(now), toYmd(now)];
    case 'tomorrow': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return [toYmd(d), toYmd(d)];
    }
    case 'week':
    case 'next_week': {
      const d = new Date(now);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + (p === 'next_week' ? 7 : 0));
      const end = new Date(d);
      end.setDate(d.getDate() + 6);
      return [toYmd(d), toYmd(end)];
    }
    case 'month':
      return [`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
    case 'custom':
      return [from || toYmd(now), to || from || toYmd(now)];
  }
}

/** Teléfono → formato internacional para wa.me (añade 34 si es un número español de 9 cifras). */
const waPhone = (phone?: string) => {
  let d = (phone || '').replace(/[^0-9]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9) d = '34' + d;
  return d;
};

const mapsLink = (c?: Client) => {
  if (!c) return '';
  if (c.coords && Number.isFinite(c.coords.lat) && Number.isFinite(c.coords.lng) && (c.coords.lat || c.coords.lng)) {
    return `https://maps.google.com/?q=${Number(c.coords.lat).toFixed(6)},${Number(c.coords.lng).toFixed(6)}`;
  }
  const q = [c.address, c.city].filter(Boolean).join(', ');
  return q ? `https://maps.google.com/?q=${encodeURIComponent(q)}` : '';
};

const Icon = {
  phone: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>,
  mail: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16"/></svg>,
  file: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>,
  wa: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.6-4-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z"/></svg>,
};

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const SendToRepModal: React.FC<SendToRepModalProps> = ({ salesReps, clients, visits, initialRepId, onClose }) => {
  const [repId, setRepId] = useState(initialRepId || salesReps[0]?.id || '');
  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [onlyPending, setOnlyPending] = useState(true);
  const [includeVisitsExcel, setIncludeVisitsExcel] = useState(true);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'warn'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const rep = salesReps.find((r) => r.id === repId);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const [from, to] = rangeFor(period, customFrom, customTo);

  const countFor = (p: Period) => {
    const [f, t] = rangeFor(p, customFrom, customTo);
    return visits.filter(
      (v) =>
        v.repId === repId &&
        v.scheduledDate >= f &&
        v.scheduledDate <= t &&
        (!onlyPending || v.status === 'scheduled' || v.status === 'in_progress')
    ).length;
  };
  const totalRepVisits = visits.filter((v) => v.repId === repId).length;
  const lastRepDate = visits.filter((v) => v.repId === repId).reduce((m, v) => (v.scheduledDate > m ? v.scheduledDate : m), '');

  const repVisits = useMemo(
    () =>
      visits
        .filter((v) => v.repId === repId)
        .filter((v) => v.scheduledDate >= from && v.scheduledDate <= to)
        .filter((v) => !onlyPending || v.status === 'scheduled' || v.status === 'in_progress')
        .sort((a, b) => `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(`${b.scheduledDate} ${b.scheduledTime}`)),
    [visits, repId, from, to, onlyPending]
  );

  const phoneOk = waPhone(rep?.phone).length >= 11;
  const firstName = (rep?.name || '').split(/[\s,]+/).filter(Boolean)[0] || '';
  const rangeLabel =
    period === 'all' ? 'pendientes' : period === 'upcoming' ? 'próximas' : from === to ? `del ${fmtDate(from)}` : `del ${fmtDate(from)} al ${fmtDate(to)}`;
  const excelName = `Visitas_${slug(rep?.name || 'comercial')}_${period === 'all' ? (onlyPending ? 'pendientes_' : 'todas_') + toYmd(new Date()) : period === 'upcoming' ? 'proximas_' + from : from + (from !== to ? '_a_' + to : '')}.xlsx`;

  // ---------- Mensaje de texto ----------
  const todayYmd = toYmd(new Date());
  const isOverdue = (v: Visit) => v.scheduledDate < todayYmd && (v.status === 'scheduled' || v.status === 'in_progress');
  const MAX_LINES = 40;
  const message = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Hola ${firstName}, te envío tus ${period === 'all' ? (onlyPending ? 'visitas pendientes' : 'visitas') : period === 'upcoming' ? 'próximas visitas' : 'visitas ' + rangeLabel} (${repVisits.length}):`);
    lines.push('');
    repVisits.slice(0, MAX_LINES).forEach((v, i) => {
      const c = clientById.get(v.clientId);
      lines.push(`${i + 1}. ${fmtShort(v.scheduledDate)} ${v.scheduledTime} — ${c?.name || 'Cliente'}${c?.city ? ` (${c.city})` : ''}${isOverdue(v) ? ' ⚠️ ATRASADA' : ''}`);
      if (v.objective) lines.push(`   Objetivo: ${v.objective}`);
      const contact = [c?.contactName, c?.phone].filter(Boolean).join(' · ');
      if (contact) lines.push(`   Contacto: ${contact}`);
      const m = mapsLink(c);
      if (m) lines.push(`   📍 ${m}`);
    });
    if (repVisits.length > MAX_LINES) lines.push(`… y ${repVisits.length - MAX_LINES} más (ver Excel adjunto).`);
    if (repVisits.length === 0) lines.push('No tienes visitas programadas en este periodo.');
    if (note.trim()) {
      lines.push('');
      lines.push(note.trim());
    }
    if (includeVisitsExcel || extraFiles.length) {
      lines.push('');
      lines.push(`📎 Adjunto: ${[includeVisitsExcel ? excelName : null, ...extraFiles.map((f) => f.name)].filter(Boolean).join(', ')}`);
    }
    lines.push('');
    lines.push('— GeoVentas');
    return lines.join('\n');
  }, [period, onlyPending, todayYmd, repVisits, clientById, firstName, rangeLabel, note, includeVisitsExcel, extraFiles, excelName]);

  // ---------- Excel ----------
  const buildExcel = (): File => {
    const rows = repVisits.map((v) => {
      const c = clientById.get(v.clientId);
      return {
        Fecha: fmtDate(v.scheduledDate),
        Hora: v.scheduledTime,
        'Cód. Cliente': c?.code || '',
        Cliente: c?.name || '',
        Empresa: c?.company || '',
        Contacto: c?.contactName || '',
        Teléfono: c?.phone || '',
        Email: c?.email || '',
        Dirección: c?.address || '',
        Ciudad: c?.city || '',
        Objetivo: v.objective || '',
        Estado: isOverdue(v) ? 'Atrasada' : STATUS_LABEL[v.status] || v.status,
        Notas: v.notes || '',
        'Google Maps': mapsLink(c),
      };
    });
    const ws = XLSX.utils.json_to_sheet(
      rows.length
        ? rows
        : [{ Fecha: '', Hora: '', Cliente: 'Sin visitas en el periodo', Objetivo: '', Estado: '' }]
    );
    ws['!cols'] = [10, 7, 12, 28, 24, 20, 14, 24, 32, 16, 30, 12, 30, 40].map((wch) => ({ wch }));
    // Enlaces de Maps clicables
    rows.forEach((r, i) => {
      if (!r['Google Maps']) return;
      const ref = XLSX.utils.encode_cell({ r: i + 1, c: 13 });
      if (ws[ref]) ws[ref].l = { Target: r['Google Maps'] };
    });

    const resumen = XLSX.utils.aoa_to_sheet([
      ['Comercial', rep?.name || ''],
      ['Territorio', rep?.territory || ''],
      ['Periodo', period === 'all' ? 'Todas las fechas' : period === 'upcoming' ? `Desde ${fmtDate(from)}` : from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`],
      ['Visitas', repVisits.length],
      ['Filtro', onlyPending ? 'Solo pendientes / en curso' : 'Todas'],
      ['Generado', new Date().toLocaleString('es-ES')],
    ]);
    resumen['!cols'] = [{ wch: 14 }, { wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visitas');
    XLSX.utils.book_append_sheet(wb, resumen, 'Resumen');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new File([buf], excelName, { type: XLSX_MIME });
  };

  const filesToSend = (): File[] => [...(includeVisitsExcel ? [buildExcel()] : []), ...extraFiles];

  // ---------- Acciones ----------
  const shareNative = async () => {
    sound.playClick();
    const files = filesToSend();
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (!nav.share) {
      setFeedback({ type: 'warn', text: 'Este navegador no permite compartir archivos. Usa WhatsApp o Email (el Excel se descargará para adjuntarlo).' });
      return;
    }
    try {
      if (files.length && nav.canShare && nav.canShare({ files })) {
        await nav.share({ title: `Visitas ${rep?.name || ''}`, text: message, files });
        setFeedback({ type: 'ok', text: 'Enviado desde el menú de compartir.' });
        return;
      }
      // El navegador no acepta .xlsx como adjunto (p. ej. Chrome Android): compartimos texto y descargamos los archivos.
      files.forEach(downloadFile);
      await nav.share({ title: `Visitas ${rep?.name || ''}`, text: message });
      setFeedback({
        type: 'warn',
        text: files.length
          ? 'Tu navegador no deja adjuntar Excel al compartir: se ha enviado el texto y el Excel se ha descargado para que lo adjuntes.'
          : 'Enviado desde el menú de compartir.',
      });
    } catch (e: any) {
      if (e?.name !== 'AbortError') setFeedback({ type: 'warn', text: 'No se pudo compartir: ' + (e?.message || e) });
    }
  };

  const sendWhatsApp = () => {
    sound.playClick();
    filesToSend().forEach(downloadFile);
    const phone = waPhone(rep?.phone);
    const url = `https://wa.me/${phoneOk ? phone : ''}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener');
    setFeedback({
      type: phoneOk ? 'ok' : 'warn',
      text: phoneOk
        ? 'WhatsApp abierto con el listado. Arrastra el Excel descargado al chat para adjuntarlo.'
        : 'El teléfono del comercial falta o está incompleto: elige el contacto en WhatsApp y adjunta el Excel descargado.',
    });
  };

  const emailSubject = `Tus visitas ${rangeLabel} — GeoVentas`;

  /** Abre Gmail web con destinatario, asunto y cuerpo ya rellenos (no depende de tener Outlook/Thunderbird). */
  const sendEmail = () => {
    sound.playClick();
    filesToSend().forEach(downloadFile);
    const url =
      'https://mail.google.com/mail/?view=cm&fs=1' +
      `&to=${encodeURIComponent(rep?.email || '')}` +
      `&su=${encodeURIComponent(emailSubject)}` +
      `&body=${encodeURIComponent(message)}`;
    const w = window.open(url, '_blank', 'noopener');
    setFeedback({
      type: 'ok',
      text: rep?.email
        ? `Gmail abierto en otra pestaña con el correo para ${rep.email}. Adjunta el Excel descargado (clip 📎) y pulsa Enviar.`
        : 'Gmail abierto. El comercial no tiene email: escribe el destinatario y adjunta el Excel descargado.',
    });
    if (w === null) setFeedback({ type: 'warn', text: 'El navegador bloqueó la ventana emergente. Permite ventanas emergentes para geo-ventas.vercel.app.' });
  };

  /** Alternativa: programa de correo del ordenador (Outlook, Mail, Thunderbird…). */
  const sendEmailApp = () => {
    sound.playClick();
    filesToSend().forEach(downloadFile);
    window.location.href = `mailto:${encodeURIComponent(rep?.email || '')}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(message)}`;
    setFeedback({ type: 'warn', text: 'Si no se abre nada es que no hay un programa de correo configurado: usa el botón Email (Gmail).' });
  };

  const downloadOnly = () => {
    sound.playClick();
    downloadFile(buildExcel());
    setFeedback({ type: 'ok', text: 'Excel descargado.' });
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setFeedback({ type: 'ok', text: 'Texto copiado al portapapeles.' });
    } catch {
      setFeedback({ type: 'warn', text: 'No se pudo copiar el texto.' });
    }
  };

  const fieldCls =
    'w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Enviar visitas y Excel</h2>
              <p className="text-[11px] text-slate-500">Manda la agenda de visitas y archivos Excel a un comercial por WhatsApp o email.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-0">
          {/* Configuración */}
          <div className="p-5 space-y-4 border-b md:border-b-0 md:border-r border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Comercial / representante</label>
              <select value={repId} onChange={(e) => setRepId(e.target.value)} className={fieldCls}>
                {salesReps.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {rep && (
                <div className="mt-1.5 text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                  <span className={`inline-flex items-center gap-1 ${phoneOk ? '' : 'text-amber-600 font-semibold'}`}>
                    {Icon.phone} {rep.phone || 'sin teléfono'}{rep.phone && !phoneOk ? ' (incompleto)' : ''}
                  </span>
                  <span className={`inline-flex items-center gap-1 ${rep.email ? '' : 'text-amber-600 font-semibold'}`}>
                    {Icon.mail} {rep.email || 'sin email'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Periodo de visitas</label>
              <div className="flex flex-wrap gap-1.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                      period === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                    {p.id !== 'custom' && <span className="ml-1 opacity-70 font-mono">{countFor(p.id)}</span>}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="flex items-center gap-1.5 mt-2 text-xs">
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={fieldCls} />
                  <span className="text-slate-400">→</span>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={fieldCls} />
                </div>
              )}
              {repVisits.length === 0 && (
                <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                  {totalRepVisits === 0
                    ? `${rep?.name || 'Este comercial'} no tiene ninguna visita asignada. Créala desde "+ Nueva Visita" y vuelve aquí.`
                    : `No hay visitas en este periodo. Tiene ${totalRepVisits} visita(s); la última el ${fmtDate(lastRepDate)}. Pulsa "Todas".`}
                </div>
              )}
              <label className="flex items-center gap-2 mt-2 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
                Solo visitas pendientes / en curso
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Archivos Excel</label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input type="checkbox" checked={includeVisitsExcel} onChange={(e) => setIncludeVisitsExcel(e.target.checked)} />
                Generar Excel de visitas <span className="text-slate-400 font-mono truncate">({repVisits.length} filas)</span>
              </label>
              <div className="mt-2 space-y-1.5">
                {extraFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                    <span className="truncate text-emerald-800 font-medium inline-flex items-center gap-1.5">{Icon.file} {f.name}</span>
                    <button onClick={() => setExtraFiles((p) => p.filter((_, j) => j !== i))} className="text-emerald-700 hover:text-red-600 font-bold">✕</button>
                  </div>
                ))}
                <button
                  onClick={() => fileInput.current?.click()}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  + Adjuntar otro Excel (tarifas, rutas, pedidos…)
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const list = Array.from(e.target.files || []);
                    if (list.length) setExtraFiles((p) => [...p, ...list]);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nota para el comercial (opcional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Ej: Prioriza las visitas de la mañana…"
                className={fieldCls + ' resize-none'}
              />
            </div>
          </div>

          {/* Vista previa */}
          <div className="p-5 bg-slate-50/60 flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Vista previa del mensaje</span>
              <button onClick={copyText} className="text-[11px] font-semibold text-blue-600 hover:underline">Copiar texto</button>
            </div>
            <pre className="flex-1 min-h-[220px] max-h-[340px] overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed font-sans text-slate-700 bg-white border border-slate-200 rounded-xl p-3">
              {message}
            </pre>
          </div>
        </div>

        {feedback && (
          <div
            className={`mx-5 mb-0 mt-0 px-3 py-2 rounded-lg text-xs font-medium border ${
              feedback.type === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Acciones */}
        <div className="px-5 py-4 border-t border-slate-200 mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <button onClick={downloadOnly} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5">
            {Icon.download} Descargar Excel
          </button>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={sendEmail} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5">
              {Icon.mail} Email (Gmail)
            </button>
            <button onClick={sendEmailApp} title="Abrir con Outlook / programa de correo del ordenador" className="px-2 py-2 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-slate-50">
              Outlook / otro
            </button>
            <button onClick={sendWhatsApp} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5">
              {Icon.wa} WhatsApp
            </button>
            <button onClick={shareNative} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">
              Compartir con Excel adjunto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
