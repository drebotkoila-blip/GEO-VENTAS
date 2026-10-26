import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Sale, Article } from '../types';
import { parseSpanishNumber, normalizeDate, supabase } from '../lib/supabase';
import { sound } from '../utils/audioFeedback';

interface ImportSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSalesImported: (importedSales: Sale[]) => void;
  articles: Article[];
  isSupabaseConnected: boolean;
}

export const ImportSalesModal: React.FC<ImportSalesModalProps> = ({
  isOpen,
  onClose,
  onSalesImported,
  articles,
  isSupabaseConnected,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Sale[]>([]);
  const [rawPreviewRows, setRawPreviewRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingToSupabase, setIsUploadingToSupabase] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncToSupabase, setSyncToSupabase] = useState<boolean>(true);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Article dictionary for fast lookup
  const articleMap = new Map<number, Article>();
  articles.forEach((a) => articleMap.set(a.referencia, a));

  // Parse excel serial date or string date
  const parseExcelDate = (val: any): { isoDate: string; displayDate: string } => {
    if (!val) {
      const today = new Date();
      return {
        isoDate: today.toISOString().split('T')[0],
        displayDate: today.toLocaleDateString('es-ES'),
      };
    }

    if (val instanceof Date) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return {
        isoDate: `${y}-${m}-${d}`,
        displayDate: `${d}/${m}/${y}`,
      };
    }

    // Number (Excel serial date number, e.g. 46300)
    if (typeof val === 'number' && val > 30000 && val < 60000) {
      try {
        const utcDays = Math.floor(val - 25569);
        const utcValue = utcDays * 86400;
        const dateInfo = new Date(utcValue * 1000);
        const y = dateInfo.getFullYear();
        const m = String(dateInfo.getMonth() + 1).padStart(2, '0');
        const d = String(dateInfo.getDate()).padStart(2, '0');
        return {
          isoDate: `${y}-${m}-${d}`,
          displayDate: `${d}/${m}/${y}`,
        };
      } catch {
        // fallback
      }
    }

    const str = String(val).trim();
    const iso = normalizeDate(str);
    const parts = iso.split('-');
    const display = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : str;
    return { isoDate: iso, displayDate: display };
  };

  // Find column value loosely matching expected names
  const findValue = (row: any, candidates: string[]): any => {
    const keys = Object.keys(row);
    for (const c of candidates) {
      const cNorm = c.toLowerCase().trim();
      const matchKey = keys.find((k) => k.toLowerCase().trim() === cNorm);
      if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null) {
        return row[matchKey];
      }
    }
    // Partial substring match
    for (const c of candidates) {
      const cNorm = c.toLowerCase().trim();
      const matchKey = keys.find((k) => k.toLowerCase().trim().includes(cNorm));
      if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null) {
        return row[matchKey];
      }
    }
    return undefined;
  };

  const processFile = async (selectedFile: File) => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        cellDates: true,
        cellNF: false,
        cellText: false,
      });

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('El archivo Excel no contiene hojas de cálculo.');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: '',
      }) as any[];

      if (!rawJson || rawJson.length === 0) {
        throw new Error('No se encontraron filas con datos en la primera hoja del Excel.');
      }

      setRawPreviewRows(rawJson.slice(0, 5));

      // Parse each row according to the user's Excel schema
      const mappedSales: Sale[] = rawJson.map((row, idx) => {
        const rawDate = findValue(row, ['Fecha', 'fecha', 'date', 'F. Venta']);
        const { isoDate } = parseExcelDate(rawDate);

        const numPedido = findValue(row, ['nº peddo', 'nº pedido', 'pedido', 'num_pedido', 'n peddo', 'order']);
        const cliente = findValue(row, ['cliente', 'Cliente', 'Nombre Cliente', 'customer']) || 'Cliente Sin Nombre';
        const idCliente = String(findValue(row, ['id_cliente', 'IdCliente', 'idCliente', 'ID Cliente', 'código']) || '').trim();
        const vendedor = findValue(row, ['Vendedor', 'vendedor', 'comercial', 'rep']) || '';
        const rawRef = findValue(row, ['referencia', 'Referencia', 'ref', 'código artículo', 'artículo']);
        const referencia = Number(rawRef) || 0;
        const rawPvp = findValue(row, ['PVP', 'pvp', 'Precio', 'precio', 'precio ud', 'precio_unidad']);
        const rawCantidad = findValue(row, ['Cantidad', 'cantidad', 'uds', 'unidades', 'qty']);
        const rawEnvio = findValue(row, ['Cía Envío', 'Cia Envio', 'envío', 'envio', 'transportista']);
        const rawImporte = findValue(row, ['Importe', 'importe', 'Total', 'total', 'monto']);

        const parsedCantidad = parseSpanishNumber(rawCantidad) || 1;
        const parsedPvp = parseSpanishNumber(rawPvp);
        let parsedImporte = parseSpanishNumber(rawImporte);

        if (parsedImporte === 0 && parsedPvp > 0 && parsedCantidad > 0) {
          parsedImporte = Math.round(parsedPvp * parsedCantidad * 100) / 100;
        }

        const effectivePvp =
          parsedPvp > 0 ? parsedPvp : parsedCantidad > 0 ? Math.round((parsedImporte / parsedCantidad) * 100) / 100 : 0;

        return {
          id: `imp-${Date.now()}-${idx}`,
          fecha: isoDate,
          numPedido: numPedido !== undefined ? numPedido : '',
          cliente: String(cliente).trim(),
          idCliente: idCliente || `c-${idx}`,
          vendedor: String(vendedor).trim(),
          referencia: referencia,
          pvp: effectivePvp,
          cantidad: parsedCantidad,
          envio: rawEnvio ? String(rawEnvio).trim() : '',
          importe: parsedImporte,
        };
      });

      setFile(selectedFile);
      setParsedRows(mappedSales);
      sound.playSuccess();
    } catch (err: any) {
      console.error('Excel processing error:', err);
      setErrorMsg(err.message || 'Error al procesar el archivo Excel. Verifica el formato.');
      sound.playWarning();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Confirm import and optionally upload to Supabase
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    if (syncToSupabase && isSupabaseConnected) {
      setIsUploadingToSupabase(true);
      setUploadProgress(0);

      try {
        // Prepare rows matching Supabase table VENTAS
        const supabaseRows = parsedRows.map((s) => {
          // Format date as DD/MM/YYYY for Supabase
          const parts = s.fecha.split('-');
          const fechaSupabase = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : s.fecha;

          return {
            Fecha: fechaSupabase,
            'nº peddo': s.numPedido || null,
            cliente: s.cliente,
            id_cliente: s.idCliente,
            Vendedor: s.vendedor,
            referencia: s.referencia,
            PVP: s.pvp ? s.pvp.toFixed(2).replace('.', ',') : '0,00',
            Cantidad: s.cantidad,
            'Cía Envío': s.envio || '',
            Importe: s.importe.toFixed(2).replace('.', ','),
          };
        });

        // Insert in batches of 100 to avoid payload limits
        const batchSize = 100;
        const total = supabaseRows.length;
        for (let i = 0; i < total; i += batchSize) {
          const chunk = supabaseRows.slice(i, i + batchSize);
          const { error } = await supabase.from('VENTAS').insert(chunk);
          if (error) {
            // Try lowercase 'ventas' table as fallback
            const { error: err2 } = await supabase.from('ventas').insert(chunk);
            if (err2) {
              console.warn('Supabase batch insert warning:', error || err2);
            }
          }
          setUploadProgress(Math.min(100, Math.round(((i + chunk.length) / total) * 100)));
        }
      } catch (err) {
        console.warn('Error uploading imported sales to Supabase:', err);
      } finally {
        setIsUploadingToSupabase(false);
      }
    }

    onSalesImported(parsedRows);
    sound.playSuccess();
    onClose();
  };

  // Download template Excel matching user's exact screenshot
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Fecha: '01/10/2026',
        'nº peddo': '3.959',
        cliente: 'Hanari Carnes',
        id_cliente: 'c35',
        Vendedor: 'Leverling, Janet',
        referencia: 25,
        PVP: '7,02',
        Cantidad: 30,
        'Cía Envío': 'Federal Shipping',
        Importe: '210,60',
      },
      {
        Fecha: '02/10/2026',
        'nº peddo': '3.960',
        cliente: 'Hanari Carnes',
        id_cliente: 'c35',
        Vendedor: 'Leverling, Janet',
        referencia: 38,
        PVP: '15,79',
        Cantidad: 20,
        'Cía Envío': 'Federal Shipping',
        Importe: '315,80',
      },
      {
        Fecha: '03/10/2026',
        'nº peddo': '3.961',
        cliente: 'White Clover Markets',
        id_cliente: 'c89',
        Vendedor: 'Leverling, Janet',
        referencia: 68,
        PVP: '15,50',
        Cantidad: 25,
        'Cía Envío': 'Federal Shipping',
        Importe: '387,50',
      },
      {
        Fecha: '04/10/2026',
        'nº peddo': '3.962',
        cliente: 'Wellington Importadora',
        id_cliente: 'c88',
        Vendedor: 'Dodsworth, Anne',
        referencia: 29,
        PVP: '21,90',
        Cantidad: 20,
        'Cía Envío': 'United Package',
        Importe: '438,00',
      },
      {
        Fecha: '05/10/2026',
        'nº peddo': '3.963',
        cliente: 'Hanari Carnes',
        id_cliente: 'c35',
        Vendedor: 'Leverling, Janet',
        referencia: 65,
        PVP: '24,62',
        Cantidad: 22,
        'Cía Envío': 'Federal Shipping',
        Importe: '541,64',
      },
      {
        Fecha: '06/10/2026',
        'nº peddo': '3.964',
        cliente: 'White Clover Markets',
        id_cliente: 'c89',
        Vendedor: 'Leverling, Janet',
        referencia: 52,
        PVP: '62,29',
        Cantidad: 35,
        'Cía Envío': 'Federal Shipping',
        Importe: '2.180,15',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas_Mes');
    XLSX.writeFile(wb, 'Plantilla_Ventas_Mes.xlsx');
    sound.playClick();
  };

  // Metrics
  const totalAmount = parsedRows.reduce((acc, s) => acc + s.importe, 0);
  const totalUnits = parsedRows.reduce((acc, s) => acc + s.cantidad, 0);
  const distinctClients = new Set(parsedRows.map((s) => s.cliente)).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/>
                <line x1="8" y1="17" x2="16" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Importar Ventas del Mes desde Excel</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  .xlsx / .xls / .csv
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Compatible con las columnas exactas: Fecha, nº peddo, cliente, id_cliente, Vendedor, referencia, PVP, Cantidad, Cía Envío, Importe.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/40">
          {/* File Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
                : file
                ? 'border-emerald-300 bg-emerald-50/40'
                : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-slate-50/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl shadow-2xs">
                📊
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {file ? file.name : 'Haz clic para seleccionar tu fichero Excel o arrástralo aquí'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Archivos compatibles: <code className="font-mono text-emerald-700 font-bold">.xlsx</code>,{' '}
                  <code className="font-mono text-emerald-700 font-bold">.xls</code> o{' '}
                  <code className="font-mono text-emerald-700 font-bold">.csv</code>
                </p>
              </div>

              {file && (
                <div className="mt-1 inline-flex items-center gap-2 px-3 py-1 bg-white border border-emerald-200 rounded-full text-xs font-semibold text-emerald-800 shadow-2xs">
                  <span>✓ Archivo cargado: {(file.size / 1024).toFixed(1)} KB</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setParsedRows([]);
                    }}
                    className="text-slate-400 hover:text-red-600 font-bold ml-1"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Row: Download Template & Help */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-semibold text-slate-800">¿Necesitas una plantilla de ejemplo?</span>
              <span className="text-slate-400">Descarga el modelo con las 10 columnas oficiales:</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 font-bold rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Descargar Plantilla Excel de Muestra</span>
            </button>
          </div>

          {/* Error Message if any */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Summary KPIs after parsing */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Ventas Detectadas
                  </span>
                  <span className="text-xl font-black text-slate-900 font-mono">
                    {parsedRows.length.toLocaleString('es-ES')}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Facturación
                  </span>
                  <span className="text-xl font-black text-emerald-600 font-mono">
                    {totalAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Unidades Totales
                  </span>
                  <span className="text-xl font-black text-blue-600 font-mono">
                    {totalUnits.toLocaleString('es-ES')} ud.
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Clientes Únicos
                  </span>
                  <span className="text-xl font-black text-purple-600 font-mono">
                    {distinctClients}
                  </span>
                </div>
              </div>

              {/* Table Preview */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Vista previa de las primeras 5 ventas del archivo:</span>
                  </span>
                  <span className="text-slate-400">
                    Mostrando 5 de {parsedRows.length} filas
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Nº Pedido</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">ID Cliente</th>
                        <th className="py-2.5 px-3">Vendedor</th>
                        <th className="py-2.5 px-3">Ref.</th>
                        <th className="py-2.5 px-3 text-right">PVP</th>
                        <th className="py-2.5 px-3 text-center">Cant.</th>
                        <th className="py-2.5 px-3">Cía Envío</th>
                        <th className="py-2.5 px-3 text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.slice(0, 5).map((row, idx) => {
                        const parts = row.fecha.split('-');
                        const fechaFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : row.fecha;

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-medium text-slate-700 whitespace-nowrap">
                              {fechaFormatted}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">
                              {row.numPedido || '—'}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                              {row.cliente}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                              {row.idCliente}
                            </td>
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                              {row.vendedor || '—'}
                            </td>
                            <td className="py-2 px-3 font-mono text-blue-700 font-bold">
                              #{row.referencia}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                              {row.pvp ? `${row.pvp.toFixed(2)} €` : '—'}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                              {row.cantidad}
                            </td>
                            <td className="py-2 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                              {row.envio || '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                              {row.importe.toFixed(2)} €
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Supabase sync option checkbox */}
              {isSupabaseConnected && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-emerald-950 select-none">
                    <input
                      type="checkbox"
                      checked={syncToSupabase}
                      onChange={(e) => setSyncToSupabase(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>Guardar también en tu tabla <strong>VENTAS</strong> de Supabase</span>
                  </label>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Se insertarán los {parsedRows.length} registros en Supabase PostgreSQL
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Upload progress indicator */}
          {isUploadingToSupabase && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-emerald-900">
                <span>Guardando en Supabase tabla VENTAS...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-emerald-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            {parsedRows.length > 0 ? (
              <span>
                Listo para importar <strong>{parsedRows.length} ventas</strong> ({totalAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })})
              </span>
            ) : (
              <span>Selecciona un fichero Excel para comenzar.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={parsedRows.length === 0 || isProcessing || isUploadingToSupabase}
              className={`px-5 py-2 rounded-xl font-bold shadow-xs transition-all flex items-center gap-2 ${
                parsedRows.length > 0 && !isProcessing && !isUploadingToSupabase
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:shadow-md'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isUploadingToSupabase ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Guardando en Supabase ({uploadProgress}%)...</span>
                </>
              ) : isProcessing ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Leyendo Excel...</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span>Importar {parsedRows.length > 0 ? `${parsedRows.length} Ventas` : 'Ventas del Mes'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
