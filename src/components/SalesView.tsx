import React, { useState, useMemo } from 'react';
import { Sale, Article, Client, SalesRep } from '../types';
import { sound } from '../utils/audioFeedback';

interface SalesViewProps {
  sales: Sale[];
  articles: Article[];
  clients: Client[];
  salesReps: SalesRep[];
  onOpenNewSaleModal: () => void;
  onOpenImportExcelModal?: () => void;
  onDeleteSale: (saleIdOrIndex: string | number) => void;
  onDeleteMultipleSales: (identifiers: (string | number)[]) => void;
  onSyncWithSupabase: () => Promise<void>;
  onSeedSalesToSupabase: () => Promise<void>;
  isSupabaseConnected: boolean;
  onOpenSupabaseModal: () => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const SalesView: React.FC<SalesViewProps> = ({
  sales,
  articles,
  clients,
  salesReps,
  onOpenNewSaleModal,
  onOpenImportExcelModal,
  onDeleteSale,
  onDeleteMultipleSales,
  onSyncWithSupabase,
  onSeedSalesToSupabase,
  isSupabaseConnected,
  onOpenSupabaseModal,
}) => {
  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedArticleRef, setSelectedArticleRef] = useState<string>('all');
  const [selectedFamilia, setSelectedFamilia] = useState<string>('all');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('all');
  
  // Table view & selection state
  const [selectedSaleIds, setSelectedSaleIds] = useState<(string | number)[]>([]);
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'qty_desc'>('date_desc');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTabSubView, setActiveTabSubView] = useState<'table' | 'analytics'>('table');

  // Quick lookup dictionary for Articles by reference
  const articleMap = useMemo(() => {
    const map = new Map<number, Article>();
    articles.forEach((a) => map.set(a.referencia, a));
    return map;
  }, [articles]);

  // Extract available distinct Years from sales
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    sales.forEach((s) => {
      if (s.fecha) {
        const y = s.fecha.slice(0, 4);
        if (y && !isNaN(Number(y))) years.add(y);
      }
    });
    return Array.from(years).sort().reverse();
  }, [sales]);

  // Extract distinct Vendedores from sales + salesReps
  const availableVendedores = useMemo(() => {
    const names = new Set<string>();
    salesReps.forEach((r) => names.add(r.name));
    sales.forEach((s) => {
      if (s.vendedor) names.add(s.vendedor);
    });
    return Array.from(names).sort();
  }, [sales, salesReps]);

  // Extract distinct Familias from catalog
  const availableFamilias = useMemo(() => {
    const fams = new Set<string>();
    articles.forEach((a) => {
      if (a.familia) fams.add(a.familia);
    });
    return Array.from(fams).sort();
  }, [articles]);

  // Filtered & Sorted Sales
  const filteredSales = useMemo(() => {
    return sales
      .filter((s) => {
        const article = articleMap.get(s.referencia);
        const artName = article ? article.producto.toLowerCase() : '';
        const artFam = article ? article.familia : '';

        // Text Search
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchClient = s.cliente?.toLowerCase().includes(q) || s.idCliente?.toLowerCase().includes(q);
          const matchArt = artName.includes(q) || String(s.referencia).includes(q);
          const matchRep = s.vendedor?.toLowerCase().includes(q);
          if (!matchClient && !matchArt && !matchRep) return false;
        }

        // Year filter
        if (selectedYear !== 'all') {
          const saleYear = s.fecha?.slice(0, 4);
          if (saleYear !== selectedYear) return false;
        }

        // Month filter
        if (selectedMonth !== 'all') {
          const saleMonth = s.fecha?.slice(5, 7);
          const monthNumStr = String(Number(selectedMonth)).padStart(2, '0');
          if (saleMonth !== monthNumStr) return false;
        }

        // Client filter
        if (selectedClient !== 'all') {
          if (s.cliente !== selectedClient && s.idCliente !== selectedClient) return false;
        }

        // Article filter
        if (selectedArticleRef !== 'all') {
          if (String(s.referencia) !== selectedArticleRef) return false;
        }

        // Familia filter
        if (selectedFamilia !== 'all') {
          if (artFam !== selectedFamilia) return false;
        }

        // Vendedor filter
        if (selectedVendedor !== 'all') {
          if (s.vendedor !== selectedVendedor) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return (b.fecha || '').localeCompare(a.fecha || '');
        if (sortBy === 'date_asc') return (a.fecha || '').localeCompare(b.fecha || '');
        if (sortBy === 'amount_desc') return b.importe - a.importe;
        if (sortBy === 'amount_asc') return a.importe - b.importe;
        if (sortBy === 'qty_desc') return b.cantidad - a.cantidad;
        return 0;
      });
  }, [
    sales,
    articleMap,
    searchTerm,
    selectedYear,
    selectedMonth,
    selectedClient,
    selectedArticleRef,
    selectedFamilia,
    selectedVendedor,
    sortBy,
  ]);

  // Overall KPIs based on filtered results
  const kpis = useMemo(() => {
    const totalAmount = filteredSales.reduce((acc, s) => acc + (Number(s.importe) || 0), 0);
    const totalUnits = filteredSales.reduce((acc, s) => acc + (Number(s.cantidad) || 0), 0);
    const totalTx = filteredSales.length;
    const avgTicket = totalTx > 0 ? totalAmount / totalTx : 0;

    // Top client
    const clientSalesMap = new Map<string, number>();
    filteredSales.forEach((s) => {
      const c = s.cliente || 'Desconocido';
      clientSalesMap.set(c, (clientSalesMap.get(c) || 0) + s.importe);
    });
    let topClient = { name: 'Ninguno', amount: 0 };
    clientSalesMap.forEach((amount, name) => {
      if (amount > topClient.amount) topClient = { name, amount };
    });

    // Top product
    const prodSalesMap = new Map<number, { amount: number; units: number }>();
    filteredSales.forEach((s) => {
      const current = prodSalesMap.get(s.referencia) || { amount: 0, units: 0 };
      prodSalesMap.set(s.referencia, {
        amount: current.amount + s.importe,
        units: current.units + s.cantidad,
      });
    });
    let topRef = 0;
    let topRefAmount = 0;
    prodSalesMap.forEach((val, ref) => {
      if (val.amount > topRefAmount) {
        topRefAmount = val.amount;
        topRef = ref;
      }
    });
    const topArticleObj = articleMap.get(topRef);
    const topArticleName = topArticleObj ? topArticleObj.producto : topRef ? `Ref. ${topRef}` : 'Ninguno';

    return {
      totalAmount,
      totalUnits,
      totalTx,
      avgTicket,
      topClient,
      topArticle: {
        name: topArticleName,
        ref: topRef,
        amount: topRefAmount,
      },
    };
  }, [filteredSales, articleMap]);

  // Monthly Evolution Data for Bar Chart
  const monthlyChartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      index: i + 1,
      monthName: MONTH_NAMES[i].slice(0, 3),
      fullName: MONTH_NAMES[i],
      amount: 0,
      units: 0,
      count: 0,
    }));

    filteredSales.forEach((s) => {
      if (s.fecha) {
        const m = parseInt(s.fecha.slice(5, 7), 10);
        if (m >= 1 && m <= 12) {
          months[m - 1].amount += Number(s.importe) || 0;
          months[m - 1].units += Number(s.cantidad) || 0;
          months[m - 1].count += 1;
        }
      }
    });

    const maxMonthAmount = Math.max(...months.map((m) => m.amount), 1);
    return { months, maxMonthAmount };
  }, [filteredSales]);

  // Vendedor Breakdown
  const repBreakdown = useMemo(() => {
    const map = new Map<string, { amount: number; units: number; count: number }>();
    filteredSales.forEach((s) => {
      const rep = s.vendedor || 'Sin Vendedor';
      const curr = map.get(rep) || { amount: 0, units: 0, count: 0 };
      map.set(rep, {
        amount: curr.amount + s.importe,
        units: curr.units + s.cantidad,
        count: curr.count + 1,
      });
    });
    const total = kpis.totalAmount || 1;
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        pct: (data.amount / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredSales, kpis.totalAmount]);

  // Familia Breakdown
  const familiaBreakdown = useMemo(() => {
    const map = new Map<string, { amount: number; units: number }>();
    filteredSales.forEach((s) => {
      const art = articleMap.get(s.referencia);
      const fam = art?.familia || 'SIN FAMILIA';
      const curr = map.get(fam) || { amount: 0, units: 0 };
      map.set(fam, {
        amount: curr.amount + s.importe,
        units: curr.units + s.cantidad,
      });
    });
    const total = kpis.totalAmount || 1;
    return Array.from(map.entries())
      .map(([familia, data]) => ({
        familia,
        ...data,
        pct: (data.amount / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredSales, articleMap, kpis.totalAmount]);

  // Selection handlers
  const handleSelectAll = () => {
    sound.playClick();
    if (selectedSaleIds.length === filteredSales.length) {
      setSelectedSaleIds([]);
    } else {
      setSelectedSaleIds(filteredSales.map((s, idx) => s.id || idx));
    }
  };

  const handleToggleSelectOne = (idOrIdx: string | number) => {
    sound.playClick();
    setSelectedSaleIds((prev) =>
      prev.includes(idOrIdx) ? prev.filter((item) => item !== idOrIdx) : [...prev, idOrIdx]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedSaleIds.length === 0) return;
    if (window.confirm(`¿Seguro que deseas eliminar ${selectedSaleIds.length} venta(s)?`)) {
      sound.playSuccess();
      onDeleteMultipleSales(selectedSaleIds);
      setSelectedSaleIds([]);
    }
  };

  const handleResetFilters = () => {
    sound.playClick();
    setSearchTerm('');
    setSelectedYear('all');
    setSelectedMonth('all');
    setSelectedClient('all');
    setSelectedArticleRef('all');
    setSelectedFamilia('all');
    setSelectedVendedor('all');
  };

  const handleSyncNow = async () => {
    sound.playClick();
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      await onSyncWithSupabase();
      sound.playSuccess();
      setSyncStatusMsg('Sincronizado con Supabase (tabla VENTAS)');
    } catch (err: any) {
      sound.playWarning();
      setSyncStatusMsg(`Error: ${err.message || 'Error al conectar'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    }
  };

  const handleSeedNow = async () => {
    sound.playClick();
    setIsSeeding(true);
    setSyncStatusMsg(null);
    try {
      await onSeedSalesToSupabase();
      sound.playSuccess();
      setSyncStatusMsg('Ventas cargadas a Supabase');
    } catch (err: any) {
      sound.playWarning();
      setSyncStatusMsg(`Error: ${err.message || 'Error al subir ventas'}`);
    } finally {
      setIsSeeding(false);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    sound.playClick();
    if (filteredSales.length === 0) return;

    const headers = ['ID', 'Fecha', 'Cliente', 'ID_Cliente', 'Referencia', 'Producto', 'Familia', 'Vendedor', 'Cantidad', 'Importe_EUR'];
    const rows = filteredSales.map((s, idx) => {
      const art = articleMap.get(s.referencia);
      return [
        s.id || idx + 1,
        s.fecha,
        `"${(s.cliente || '').replace(/"/g, '""')}"`,
        s.idCliente,
        s.referencia,
        `"${(art?.producto || '').replace(/"/g, '""')}"`,
        `"${(art?.familia || '').replace(/"/g, '""')}"`,
        `"${(s.vendedor || '').replace(/"/g, '""')}"`,
        s.cantidad,
        s.importe.toFixed(2),
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ventas_geoventas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const rlsSql = `CREATE POLICY "Permitir todo a anon en VENTAS" ON public."VENTAS" FOR ALL USING (true) WITH CHECK (true);`;

  const handleCopyRls = () => {
    sound.playClick();
    navigator.clipboard.writeText(rlsSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Gestión de Ventas
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold font-mono">
                  {sales.length} ventas registradas
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Sincronizado con tabla <code className="font-mono font-bold text-slate-700 bg-slate-100 px-1 py-0.5 rounded">VENTAS</code> en Supabase y catálogo de 77 artículos
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              sound.playClick();
              setShowSqlHelp(!showSqlHelp);
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            title="Ver configuración SQL de la tabla VENTAS"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Ayuda SQL Supabase</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredSales.length === 0}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isSupabaseConnected
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={isSyncing ? 'animate-spin' : ''}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Supabase'}</span>
          </button>

          {onOpenImportExcelModal && (
            <button
              onClick={() => {
                sound.playClick();
                onOpenImportExcelModal();
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Importar ventas del mes desde fichero Excel (.xlsx, .xls, .csv)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <span>📥 Importar Excel del Mes</span>
            </button>
          )}

          <button
            onClick={() => {
              sound.playClick();
              onOpenNewSaleModal();
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all flex items-center gap-1.5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>+ Registrar Venta</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatusMsg && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-semibold flex items-center justify-between animate-in fade-in">
          <span>{syncStatusMsg}</span>
          <button onClick={() => setSyncStatusMsg(null)} className="text-blue-500 hover:text-blue-700">✕</button>
        </div>
      )}

      {/* Supabase SQL Help Banner */}
      {showSqlHelp && (
        <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                Configuración de la tabla VENTAS en Supabase
              </span>
            </div>
            <button
              onClick={() => setShowSqlHelp(false)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              Cerrar
            </button>
          </div>
          <p className="text-xs text-slate-300">
            Tu tabla <code className="text-amber-300 font-mono">VENTAS</code> ya está creada con las columnas:
            <code className="text-slate-300 font-mono bg-slate-800 px-1.5 py-0.5 rounded ml-1">
              cliente, id_cliente, referencia, Vendedor, Fecha, Cantidad, Importe
            </code>.
          </p>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
            <code className="text-xs font-mono text-emerald-400 break-all select-all">
              {rlsSql}
            </code>
            <button
              onClick={handleCopyRls}
              className="ml-3 shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white transition-colors"
            >
              {copiedSql ? '✓ Copiado' : 'Copiar SQL'}
            </button>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              ¿Quieres subir el lote inicial de 28 ventas realistas de muestra a tu Supabase?
            </span>
            <button
              onClick={handleSeedNow}
              disabled={isSeeding}
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-xs font-bold text-white transition-colors flex items-center gap-1.5"
            >
              <span>{isSeeding ? 'Subiendo...' : 'Subir 28 Ventas de Prueba a Supabase'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Facturación */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Facturación</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight font-mono">
              {kpis.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold mt-1">Total acumulado</span>
        </div>

        {/* Unidades Vendidas */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unidades</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-blue-600 tracking-tight font-mono">
              {kpis.totalUnits.toLocaleString('es-ES')}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Productos entregados</span>
        </div>

        {/* Ticket Medio */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ticket Medio</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-indigo-600 tracking-tight font-mono">
              {kpis.avgTicket.toFixed(2)} €
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Por transacción</span>
        </div>

        {/* Nº Transacciones */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Operaciones</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-800 tracking-tight font-mono">
              {kpis.totalTx}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Ventas cerradas</span>
        </div>

        {/* Top Cliente */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Top Cliente</span>
          <div className="mt-2">
            <span className="text-xs font-bold text-slate-900 line-clamp-1" title={kpis.topClient.name}>
              {kpis.topClient.name}
            </span>
            <span className="text-sm font-black text-emerald-600 font-mono block">
              {kpis.topClient.amount.toFixed(2)} €
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Mayor comprador</span>
        </div>

        {/* Top Artículo */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Top Artículo</span>
          <div className="mt-2">
            <span className="text-xs font-bold text-slate-900 line-clamp-1" title={kpis.topArticle.name}>
              {kpis.topArticle.name}
            </span>
            <span className="text-sm font-black text-blue-600 font-mono block">
              {kpis.topArticle.amount.toFixed(2)} €
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Más facturado</span>
        </div>
      </div>

      {/* 3. Filtros Interactivos (Año, Mes, Cliente, Artículo, Familia, Vendedor) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            <span>Filtros de Búsqueda y Segmentación</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors"
            >
              Limpiar filtros
            </button>
            <span className="text-slate-300">|</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => {
                  sound.playClick();
                  setActiveTabSubView('table');
                }}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeTabSubView === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Tabla
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  setActiveTabSubView('analytics');
                }}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeTabSubView === 'analytics' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Gráficos
              </button>
            </div>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5 text-xs">
          {/* 1. Buscador */}
          <div className="lg:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Buscar</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Cliente, producto, vendedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-2.5 top-2 text-slate-400"
              >
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
          </div>

          {/* 2. Año */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Año</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los años</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Mes */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mes</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los meses</option>
              {MONTH_NAMES.map((name, index) => (
                <option key={index + 1} value={String(index + 1)}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Cliente */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cliente</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
            >
              <option value="all">Todos los clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Artículo / Ref */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Artículo</label>
            <select
              value={selectedArticleRef}
              onChange={(e) => setSelectedArticleRef(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
            >
              <option value="all">Todos los artículos</option>
              {articles.map((a) => (
                <option key={a.referencia} value={String(a.referencia)}>
                  [Ref. {a.referencia}] {a.producto}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Vendedor */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vendedor</label>
            <select
              value={selectedVendedor}
              onChange={(e) => setSelectedVendedor(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los vendedores</option>
              {availableVendedores.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Extra pill filters for Familias */}
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto text-xs scrollbar-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0 mr-1">Familia:</span>
          <button
            onClick={() => setSelectedFamilia('all')}
            className={`px-2.5 py-1 rounded-lg font-medium shrink-0 transition-colors ${
              selectedFamilia === 'all'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas ({availableFamilias.length})
          </button>
          {availableFamilias.map((fam) => (
            <button
              key={fam}
              onClick={() => setSelectedFamilia(fam)}
              className={`px-2.5 py-1 rounded-lg font-medium shrink-0 transition-colors ${
                selectedFamilia === fam
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {fam}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Subview: Analytics / Gráficos */}
      {activeTabSubView === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Monthly Evolution Chart */}
          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Evolución de Ventas por Mes</h3>
                <p className="text-xs text-slate-500">Facturación mensual en euros</p>
              </div>
              <span className="text-xs font-bold font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                {selectedYear === 'all' ? 'Histórico General' : `Año ${selectedYear}`}
              </span>
            </div>

            {/* Bar Chart Visualization */}
            <div className="h-48 pt-6 flex items-end justify-between gap-1 border-b border-slate-200">
              {monthlyChartData.months.map((m) => {
                const heightPct = Math.min(100, Math.max(4, (m.amount / monthlyChartData.maxMonthAmount) * 100));
                return (
                  <div key={m.index} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-2 bg-slate-900 text-white text-[10px] rounded-lg py-1 px-2 whitespace-nowrap z-20 shadow-lg transition-opacity">
                      <div className="font-bold">{m.fullName}</div>
                      <div>{m.amount.toFixed(2)} €</div>
                      <div className="text-slate-400">{m.units} unidades ({m.count} ventas)</div>
                    </div>

                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        m.amount > 0
                          ? 'bg-gradient-to-t from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400'
                          : 'bg-slate-100'
                      }`}
                    />
                    <span className="text-[10px] text-slate-500 font-semibold group-hover:text-blue-600">
                      {m.monthName}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Total facturado en gráfico: <strong>{kpis.totalAmount.toFixed(2)} €</strong></span>
              <span>Pico mensual: <strong>{monthlyChartData.maxMonthAmount.toFixed(2)} €</strong></span>
            </div>
          </div>

          {/* Vendedores & Familias Ranking */}
          <div className="lg:col-span-5 space-y-5">
            {/* Vendedores */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">Ventas por Comercial</h3>
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {repBreakdown.map((r) => (
                  <div key={r.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{r.name}</span>
                      <span className="font-mono font-bold text-slate-900">
                        {r.amount.toFixed(2)} € <span className="text-slate-400 text-[10px]">({r.pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, r.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Familias */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">Distribución por Familia</h3>
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {familiaBreakdown.slice(0, 5).map((f) => (
                  <div key={f.familia} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{f.familia}</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {f.amount.toFixed(2)} € <span className="text-slate-400 text-[10px]">({f.pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, f.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Subview: Tabla Principal de Ventas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Action Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={selectedSaleIds.length > 0 && selectedSaleIds.length === filteredSales.length}
                onChange={handleSelectAll}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Seleccionar todos ({filteredSales.length})</span>
            </label>

            {selectedSaleIds.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <span>Eliminar seleccionados ({selectedSaleIds.length})</span>
              </button>
            )}
          </div>

          {/* Sort By selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date_desc">Fecha (más reciente)</option>
              <option value="date_asc">Fecha (más antigua)</option>
              <option value="amount_desc">Importe (mayor a menor)</option>
              <option value="amount_asc">Importe (menor a mayor)</option>
              <option value="qty_desc">Cantidad (mayor a menor)</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 w-10 text-center">#</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Artículo / Producto</th>
                <th className="py-3 px-4">Familia</th>
                <th className="py-3 px-4">Vendedor</th>
                <th className="py-3 px-4 text-center">Cantidad</th>
                <th className="py-3 px-4 text-right">Precio Ud.</th>
                <th className="py-3 px-4 text-right">Importe Total</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      <p className="font-semibold text-sm text-slate-600">No se encontraron ventas con los filtros seleccionados</p>
                      <p className="text-xs text-slate-400">Prueba a limpiar los filtros o registra una nueva venta</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={handleResetFilters}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          Limpiar Filtros
                        </button>
                        {onOpenImportExcelModal && (
                          <button
                            onClick={() => {
                              sound.playClick();
                              onOpenImportExcelModal();
                            }}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                          >
                            <span>📥 Importar Excel</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSales.map((s, idx) => {
                  const saleIdKey = s.id || idx;
                  const isSelected = selectedSaleIds.includes(saleIdKey);
                  const article = articleMap.get(s.referencia);
                  const unitPrice = s.pvp && s.pvp > 0 ? s.pvp : (s.cantidad > 0 ? s.importe / s.cantidad : 0);
                  const formattedDate = (() => {
                    if (!s.fecha) return '—';
                    if (s.fecha.includes('-')) {
                      const parts = s.fecha.split('-');
                      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                    return s.fecha;
                  })();

                  return (
                    <tr
                      key={saleIdKey}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isSelected ? 'bg-blue-50/70' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(saleIdKey)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Fecha */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-medium text-slate-700">
                        {formattedDate}
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{s.cliente}</div>
                        {s.idCliente && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {s.idCliente}
                          </span>
                        )}
                      </td>

                      {/* Artículo */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {article ? article.producto : `Artículo #${s.referencia}`}
                        </div>
                        <span className="text-[10px] text-blue-700 font-mono font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                          Ref. {s.referencia}
                        </span>
                      </td>

                      {/* Familia */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                          {article?.familia || '—'}
                        </span>
                      </td>

                      {/* Vendedor */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-800 font-medium">
                        {s.vendedor}
                      </td>

                      {/* Cantidad */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                        {s.cantidad}
                      </td>

                      {/* Precio Unitario */}
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {unitPrice.toFixed(2)} €
                      </td>

                      {/* Importe Total */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-black text-emerald-700 text-sm">
                        {s.importe.toFixed(2)} €
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Eliminar la venta de ${s.cliente} (${s.importe} €)?`)) {
                              sound.playClick();
                              onDeleteSale(saleIdKey);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar venta"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredSales.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                  <td colSpan={6} className="py-3 px-4 text-right uppercase text-[11px] text-slate-500">
                    Totales ({filteredSales.length} ventas filtradas):
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-black text-blue-700">
                    {kpis.totalUnits} ud.
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    Ø {kpis.avgTicket.toFixed(2)} €
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-base">
                    {kpis.totalAmount.toFixed(2)} €
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
