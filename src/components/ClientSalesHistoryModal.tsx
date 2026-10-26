import React, { useState, useMemo } from 'react';
import { Visit, Client, Sale, Article } from '../types';
import { sound } from '../utils/audioFeedback';

interface ClientSalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  visit?: Visit | null;
  sales: Sale[];
  articles: Article[];
  onOpenNewSaleForClient?: (clientId: string) => void;
  onGoToCrmClient?: (clientId: string) => void;
}

type PeriodFilter = 'last_year' | 'year_2026' | 'year_2025' | 'all';

export const ClientSalesHistoryModal: React.FC<ClientSalesHistoryModalProps> = ({
  isOpen,
  onClose,
  client,
  visit,
  sales,
  articles,
  onOpenNewSaleForClient,
  onGoToCrmClient,
}) => {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('last_year');
  const [activeTab, setActiveTab] = useState<'articles' | 'transactions'>('articles');
  const [searchTerm, setSearchTerm] = useState('');

  // Quick lookup dictionary for articles by referencia
  const articleMap = useMemo(() => {
    const map = new Map<number, Article>();
    articles.forEach((a) => map.set(a.referencia, a));
    return map;
  }, [articles]);

  // Filter sales for THIS client
  const clientSales = useMemo(() => {
    if (!client) return [];
    const clientNameNorm = client.name.trim().toLowerCase();
    const clientIdNorm = client.id.trim();

    return sales.filter((s) => {
      const matchId = s.idCliente && s.idCliente.trim() === clientIdNorm;
      const matchName = s.cliente && s.cliente.trim().toLowerCase() === clientNameNorm;
      return matchId || matchName;
    });
  }, [client, sales]);

  // Filter client sales by Period (default: Último año / últimos 365 días)
  const periodFilteredSales = useMemo(() => {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setDate(today.getDate() - 365);
    const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

    return clientSales.filter((s) => {
      if (!s.fecha) return periodFilter === 'all';

      if (periodFilter === 'last_year') {
        // Last 365 days up to today (or 2026-10)
        return s.fecha >= oneYearAgoStr;
      }
      if (periodFilter === 'year_2026') {
        return s.fecha.startsWith('2026');
      }
      if (periodFilter === 'year_2025') {
        return s.fecha.startsWith('2025');
      }
      return true; // 'all'
    });
  }, [clientSales, periodFilter]);

  // KPIs for the selected period
  const kpis = useMemo(() => {
    const totalAmount = periodFilteredSales.reduce((acc, s) => acc + (Number(s.importe) || 0), 0);
    const totalUnits = periodFilteredSales.reduce((acc, s) => acc + (Number(s.cantidad) || 0), 0);
    const totalOrders = periodFilteredSales.length;
    const avgTicket = totalOrders > 0 ? totalAmount / totalOrders : 0;

    return {
      totalAmount,
      totalUnits,
      totalOrders,
      avgTicket,
    };
  }, [periodFilteredSales]);

  // Group by purchased article in the period
  interface PurchasedArticleItem {
    referencia: number;
    producto: string;
    familia: string;
    totalUnits: number;
    totalAmount: number;
    avgUnitPrice: number;
    lastPurchaseDate: string;
    orderCount: number;
    currentStock: number;
  }

  const purchasedArticles = useMemo(() => {
    const map = new Map<number, PurchasedArticleItem>();

    periodFilteredSales.forEach((s) => {
      const ref = s.referencia;
      const article = articleMap.get(ref);
      const existing = map.get(ref);

      const qty = Number(s.cantidad) || 0;
      const amount = Number(s.importe) || 0;
      const saleDate = s.fecha || '';

      if (existing) {
        existing.totalUnits += qty;
        existing.totalAmount += amount;
        existing.orderCount += 1;
        if (saleDate > existing.lastPurchaseDate) {
          existing.lastPurchaseDate = saleDate;
        }
      } else {
        map.set(ref, {
          referencia: ref,
          producto: article ? article.producto : `Artículo Ref. #${ref}`,
          familia: article ? article.familia : 'GENERAL',
          totalUnits: qty,
          totalAmount: amount,
          avgUnitPrice: 0,
          lastPurchaseDate: saleDate,
          orderCount: 1,
          currentStock: article ? article.stock : 0,
        });
      }
    });

    // Compute average unit prices and sort by totalAmount descending
    const list = Array.from(map.values()).map((item) => ({
      ...item,
      avgUnitPrice: item.totalUnits > 0 ? item.totalAmount / item.totalUnits : 0,
    }));

    return list.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [periodFilteredSales, articleMap]);

  // Search filter for articles or transactions
  const filteredPurchasedArticles = useMemo(() => {
    if (!searchTerm.trim()) return purchasedArticles;
    const q = searchTerm.toLowerCase();
    return purchasedArticles.filter(
      (a) =>
        String(a.referencia).includes(q) ||
        a.producto.toLowerCase().includes(q) ||
        a.familia.toLowerCase().includes(q)
    );
  }, [purchasedArticles, searchTerm]);

  const filteredTransactions = useMemo(() => {
    const list = [...periodFilteredSales].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter((s) => {
      const art = articleMap.get(s.referencia);
      return (
        String(s.referencia).includes(q) ||
        (art && art.producto.toLowerCase().includes(q)) ||
        (s.vendedor && s.vendedor.toLowerCase().includes(q)) ||
        (s.fecha && s.fecha.includes(q))
      );
    });
  }, [periodFilteredSales, searchTerm, articleMap]);

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-[1250] flex items-center justify-center p-3 sm:p-5 bg-slate-900/65 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 my-auto">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 text-xl shadow-inner mt-0.5">
              🛒
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-black tracking-tight text-white">
                  Historial de Compras del Cliente
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  {client.category}
                </span>
                {client.code && (
                  <span className="font-mono text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded text-slate-300">
                    Cód: {client.code}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-blue-200 mt-0.5 flex items-center gap-2">
                <span>{client.name}</span>
                <span className="text-white/40">·</span>
                <span className="text-xs font-normal text-slate-300 font-mono">{client.company}</span>
              </p>
              {visit && (
                <div className="flex items-center gap-2 text-[11px] text-blue-300/90 mt-1">
                  <span>📅 Visita seleccionada: <strong>{visit.scheduledDate}</strong> a las <strong>{visit.scheduledTime || '09:00'}</strong></span>
                  <span className="text-white/40">·</span>
                  <span>Objetivo: <em>{visit.objective || 'Visita comercial'}</em></span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenNewSaleForClient && (
              <button
                onClick={() => {
                  sound.playClick();
                  onOpenNewSaleForClient(client.id);
                  onClose();
                }}
                className="hidden sm:flex px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors items-center gap-1.5"
                title="Registrar una nueva venta a este cliente"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span>+ Nueva Venta</span>
              </button>
            )}

            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="Cerrar ventana"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Toolbar: Period Selector & Search */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Período analizado:</span>
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setPeriodFilter('last_year');
                }}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                  periodFilter === 'last_year'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Último Año (365 días)
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setPeriodFilter('year_2026');
                }}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                  periodFilter === 'year_2026'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Año 2026
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setPeriodFilter('year_2025');
                }}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                  periodFilter === 'year_2025'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Año 2025
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setPeriodFilter('all');
                }}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                  periodFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todo el Histórico
              </button>
            </div>
          </div>

          {/* Quick search inside the client's purchases */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar artículo o ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/40">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* Total Facturado */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {periodFilter === 'last_year' ? 'Total Último Año' : 'Total Período'}
              </span>
              <div className="mt-1">
                <span className="text-2xl font-black text-emerald-600 tracking-tight font-mono">
                  {kpis.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Facturación al cliente</span>
            </div>

            {/* Unidades Compradas */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Unidades Compradas
              </span>
              <div className="mt-1">
                <span className="text-2xl font-black text-blue-600 tracking-tight font-mono">
                  {kpis.totalUnits.toLocaleString('es-ES')} ud.
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1">En {purchasedArticles.length} artículos distintos</span>
            </div>

            {/* Nº Pedidos */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Pedidos Realizados
              </span>
              <div className="mt-1">
                <span className="text-2xl font-black text-slate-800 tracking-tight font-mono">
                  {kpis.totalOrders}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Operaciones de venta</span>
            </div>

            {/* Ticket Medio */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Ticket Medio
              </span>
              <div className="mt-1">
                <span className="text-2xl font-black text-indigo-600 tracking-tight font-mono">
                  {kpis.avgTicket.toFixed(2)} €
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Por cada compra</span>
            </div>
          </div>

          {/* Sub-tabs: Artículos Comprados vs Lista de Ventas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('articles');
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    activeTab === 'articles'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <span>📦 Artículos Comprados ({purchasedArticles.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('transactions');
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    activeTab === 'transactions'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <span>🧾 Tickets y Transacciones ({periodFilteredSales.length})</span>
                </button>
              </div>

              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                {periodFilter === 'last_year' ? 'Filtrado: Últimos 365 días' : `Período: ${periodFilter}`}
              </span>
            </div>

            {/* TAB 1: Artículos Comprados */}
            {activeTab === 'articles' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Ref.</th>
                      <th className="py-3 px-4">Artículo / Producto</th>
                      <th className="py-3 px-4">Familia</th>
                      <th className="py-3 px-4 text-center">Cantidad Total</th>
                      <th className="py-3 px-4 text-right">Precio Medio Ud.</th>
                      <th className="py-3 px-4 text-right">Total Gastado</th>
                      <th className="py-3 px-4 text-center">Última Compra</th>
                      <th className="py-3 px-4 text-center">Stock Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPurchasedArticles.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="text-3xl">🛒</span>
                            <p className="font-bold text-sm text-slate-700">
                              {clientSales.length === 0
                                ? 'Este cliente no tiene compras registradas en el sistema'
                                : 'No hay compras registradas en el período seleccionado'}
                            </p>
                            <p className="text-xs text-slate-400 max-w-sm">
                              {clientSales.length === 0
                                ? 'Puedes registrar la primera venta desde el botón inferior o desde el apartado Ventas.'
                                : 'Prueba a seleccionar "Todo el Histórico" para ver compras anteriores.'}
                            </p>
                            {onOpenNewSaleForClient && (
                              <button
                                onClick={() => {
                                  sound.playClick();
                                  onOpenNewSaleForClient(client.id);
                                  onClose();
                                }}
                                className="mt-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors"
                              >
                                + Registrar Venta a este Cliente
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredPurchasedArticles.map((item) => {
                        const pctOfTotal = kpis.totalAmount > 0 ? (item.totalAmount / kpis.totalAmount) * 100 : 0;
                        return (
                          <tr key={item.referencia} className="hover:bg-blue-50/40 transition-colors">
                            {/* Ref */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded text-[11px]">
                                #{item.referencia}
                              </span>
                            </td>

                            {/* Producto */}
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 text-xs">
                                {item.producto}
                              </div>
                              {/* Relative percentage bar */}
                              <div className="w-32 bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div
                                  className="bg-blue-600 h-full rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(5, pctOfTotal))}%` }}
                                  title={`${pctOfTotal.toFixed(1)}% del total`}
                                />
                              </div>
                            </td>

                            {/* Familia */}
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                                {item.familia}
                              </span>
                            </td>

                            {/* Cantidad Total */}
                            <td className="py-3 px-4 text-center font-mono font-black text-slate-900 text-sm">
                              {item.totalUnits} <span className="text-[10px] text-slate-400 font-normal">ud.</span>
                            </td>

                            {/* Precio Medio */}
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              {item.avgUnitPrice.toFixed(2)} €
                            </td>

                            {/* Total Gastado */}
                            <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm whitespace-nowrap">
                              {item.totalAmount.toFixed(2)} €
                              <span className="text-[10px] text-slate-400 font-normal block">
                                {pctOfTotal.toFixed(1)}% del total
                              </span>
                            </td>

                            {/* Última Compra */}
                            <td className="py-3 px-4 text-center font-mono text-slate-700 text-[11px] whitespace-nowrap">
                              {item.lastPurchaseDate || '—'}
                            </td>

                            {/* Stock Actual en Almacén */}
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span
                                className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                                  item.currentStock > 10
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : item.currentStock > 0
                                    ? 'bg-amber-50 text-amber-800'
                                    : 'bg-red-50 text-red-800'
                                }`}
                              >
                                {item.currentStock} disp.
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {filteredPurchasedArticles.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                        <td colSpan={3} className="py-3 px-4 text-right uppercase text-[11px] text-slate-500">
                          Totales de Artículos Comprados:
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-black text-blue-700 text-sm">
                          {kpis.totalUnits} ud.
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          Ø {kpis.avgTicket.toFixed(2)} €
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-base">
                          {kpis.totalAmount.toFixed(2)} €
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* TAB 2: Tickets / Transacciones individuales */}
            {activeTab === 'transactions' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Ref.</th>
                      <th className="py-3 px-4">Producto</th>
                      <th className="py-3 px-4">Vendedor</th>
                      <th className="py-3 px-4 text-center">Cantidad</th>
                      <th className="py-3 px-4 text-right">Precio Ud.</th>
                      <th className="py-3 px-4 text-right">Importe Venta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No hay transacciones registradas en este período
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((s, idx) => {
                        const article = articleMap.get(s.referencia);
                        const unitPrice = s.cantidad > 0 ? s.importe / s.cantidad : 0;
                        return (
                          <tr key={s.id || idx} className="hover:bg-blue-50/40 transition-colors">
                            <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                              {s.fecha}
                            </td>
                            <td className="py-3 px-4 font-mono text-blue-700 font-bold">
                              #{s.referencia}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {article ? article.producto : `Artículo #${s.referencia}`}
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {s.vendedor}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                              {s.cantidad}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              {unitPrice.toFixed(2)} €
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                              {s.importe.toFixed(2)} €
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span>Cliente: <strong>{client.name}</strong></span>
            <span>·</span>
            <span>Tel: <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline font-mono">{client.phone}</a></span>
          </div>

          <div className="flex items-center gap-2.5">
            {onGoToCrmClient && (
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onGoToCrmClient(client.id);
                  onClose();
                }}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Ver Ficha CRM
              </button>
            )}

            {onOpenNewSaleForClient && (
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onOpenNewSaleForClient(client.id);
                  onClose();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span>+ Registrar Nueva Venta</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
