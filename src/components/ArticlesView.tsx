import React, { useState, useMemo } from 'react';
import { Article } from '../types';
import { sound } from '../utils/audioFeedback';

interface ArticlesViewProps {
  articles: Article[];
  onOpenNewArticleModal: () => void;
  onEditArticle: (article: Article) => void;
  onDeleteArticle: (referencia: number) => void;
  onDeleteMultipleArticles: (referencias: number[]) => void;
  onSyncWithSupabase?: () => Promise<void>;
  isSupabaseConnected: boolean;
  onOpenSupabaseModal: () => void;
}

export const ArticlesView: React.FC<ArticlesViewProps> = ({
  articles,
  onOpenNewArticleModal,
  onEditArticle,
  onDeleteArticle,
  onDeleteMultipleArticles,
  onSyncWithSupabase,
  isSupabaseConnected,
  onOpenSupabaseModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFamilia, setSelectedFamilia] = useState<string>('all');
  const [selectedStockFilter, setSelectedStockFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'ref_asc' | 'ref_desc' | 'name' | 'stock' | 'price' | 'val'>('ref_asc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedRefs, setSelectedRefs] = useState<number[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Extract unique familias
  const familias = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      if (a.familia) set.add(a.familia);
    });
    return Array.from(set).sort();
  }, [articles]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalCount = articles.length;
    const totalInventoryValue = articles.reduce((acc, a) => acc + a.stock * a.precioCoste, 0);
    const lowStockCount = articles.filter((a) => a.stock > 0 && a.stock <= a.stockMin).length;
    const outOfStockCount = articles.filter((a) => a.stock === 0).length;
    const healthyStockCount = articles.filter((a) => a.stock > a.stockMin).length;

    return {
      totalCount,
      totalInventoryValue,
      lowStockCount,
      outOfStockCount,
      healthyStockCount,
    };
  }, [articles]);

  // Filtered & Sorted articles
  const filteredArticles = useMemo(() => {
    return articles
      .filter((a) => {
        // Search
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchRef = String(a.referencia).includes(q);
          const matchProd = a.producto.toLowerCase().includes(q);
          const matchProv = a.proveedor.toLowerCase().includes(q);
          const matchFam = a.familia.toLowerCase().includes(q);
          if (!matchRef && !matchProd && !matchProv && !matchFam) return false;
        }

        // Familia filter
        if (selectedFamilia !== 'all' && a.familia !== selectedFamilia) {
          return false;
        }

        // Stock filter
        if (selectedStockFilter === 'out' && a.stock !== 0) return false;
        if (selectedStockFilter === 'low' && (a.stock === 0 || a.stock > a.stockMin)) return false;
        if (selectedStockFilter === 'healthy' && a.stock <= a.stockMin) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'ref_asc') return a.referencia - b.referencia;
        if (sortBy === 'ref_desc') return b.referencia - a.referencia;
        if (sortBy === 'name') return a.producto.localeCompare(b.producto);
        if (sortBy === 'stock') return b.stock - a.stock;
        if (sortBy === 'price') return b.precioCoste - a.precioCoste;
        if (sortBy === 'val') return b.stock * b.precioCoste - a.stock * a.precioCoste;
        return 0;
      });
  }, [articles, searchTerm, selectedFamilia, selectedStockFilter, sortBy]);

  // Selection handlers
  const handleSelectAll = () => {
    sound.playClick();
    if (selectedRefs.length === filteredArticles.length) {
      setSelectedRefs([]);
    } else {
      setSelectedRefs(filteredArticles.map((a) => a.referencia));
    }
  };

  const handleToggleSelect = (ref: number) => {
    sound.playClick();
    setSelectedRefs((prev) =>
      prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedRefs.length === 0) return;
    sound.playClick();
    if (window.confirm(`¿Estás seguro de que deseas eliminar ${selectedRefs.length} artículo(s)?`)) {
      onDeleteMultipleArticles(selectedRefs);
      setSelectedRefs([]);
      sound.playSuccess();
    }
  };

  const handleSyncSupabase = async () => {
    if (!onSyncWithSupabase) return;
    sound.playClick();
    setIsSyncing(true);
    try {
      await onSyncWithSupabase();
      sound.playSuccess();
    } catch {
      sound.playWarning();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopySqlSetup = () => {
    sound.playClick();
    const sql = `-- Script para crear e insertar los 77 artículos en Supabase
-- Ejecutar en: https://supabase.com/dashboard/project/jeuqkaidbikwbdquhkaa/sql

CREATE TABLE IF NOT EXISTS public.articulos (
    referencia INTEGER PRIMARY KEY,
    proveedor TEXT NOT NULL,
    producto TEXT NOT NULL,
    familia TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    precio_coste NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    stock_min INTEGER NOT NULL DEFAULT 0,
    fecha_invent TEXT DEFAULT '31/12/2025',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a anon en articulos" ON public.articulos FOR ALL USING (true) WITH CHECK (true);
`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Overview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                📦
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Catálogo de Artículos e Inventario
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {articles.length} productos
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Gestión comercial de productos, precios de coste, stocks mínimos, familias y proveedores con sincronización en tiempo real con Supabase.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onOpenSupabaseModal}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors flex items-center gap-1.5 ${
                isSupabaseConnected
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
              }`}
              title="Abrir panel de sincronización con Supabase"
            >
              <span className={`w-2 h-2 rounded-full ${isSupabaseConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{isSupabaseConnected ? 'Supabase Conectado' : 'Conectar Supabase'}</span>
            </button>

            {onSyncWithSupabase && (
              <button
                onClick={handleSyncSupabase}
                disabled={isSyncing}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Sincronizar artículos con Supabase"
              >
                <span>{isSyncing ? '⏳ Sincronizando...' : '⚡ Sincronizar'}</span>
              </button>
            )}

            <button
              onClick={() => {
                sound.playClick();
                onOpenNewArticleModal();
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>+ Nuevo Artículo</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Catálogo</span>
              <span className="text-lg font-black text-slate-900 font-mono">
                {kpis.totalCount} <span className="text-xs font-medium text-slate-400">artículos</span>
              </span>
            </div>
            <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
              📋
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Valor Inventario</span>
              <span className="text-lg font-black text-emerald-600 font-mono">
                {kpis.totalInventoryValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </span>
            </div>
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm">
              💶
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Stock Bajo</span>
              <span className="text-lg font-black text-amber-600 font-mono">
                {kpis.lowStockCount} <span className="text-xs font-medium text-slate-400">alerta</span>
              </span>
            </div>
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-sm">
              ⚠️
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Agotados (0 Stock)</span>
              <span className="text-lg font-black text-red-600 font-mono">
                {kpis.outOfStockCount} <span className="text-xs font-medium text-slate-400">productos</span>
              </span>
            </div>
            <span className="w-8 h-8 rounded-lg bg-red-100 text-red-700 font-bold flex items-center justify-center text-sm">
              🛑
            </span>
          </div>
        </div>
      </div>

      {/* Supabase Notice Banner if not in cloud yet */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">Tabla de Artículos en Supabase</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                77 registros listos
              </span>
            </div>
            <p className="text-slate-600 mt-0.5">
              Hemos preparado el script SQL con los 77 artículos para que tu base de datos en Supabase quede creada y poblada al instante.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopySqlSetup}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-colors flex items-center gap-1.5"
            title="Copiar script SQL para crear la tabla articulos en Supabase"
          >
            <span>{copiedSql ? '✓ ¡Copiado!' : '📋 Copiar SQL Supabase'}</span>
          </button>
          <button
            onClick={onOpenSupabaseModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>Ver Instrucciones</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por referencia, producto, proveedor o familia..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          )}
        </div>

        {/* Filters and View Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Familia */}
          <select
            value={selectedFamilia}
            onChange={(e) => setSelectedFamilia(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas las Familias ({familias.length})</option>
            {familias.map((fam) => (
              <option key={fam} value={fam}>
                {fam}
              </option>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            value={selectedStockFilter}
            onChange={(e) => setSelectedStockFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los Stocks</option>
            <option value="healthy">Stock Normal</option>
            <option value="low">Stock Bajo (≤ Mín)</option>
            <option value="out">Agotados (0 Stock)</option>
          </select>

          {/* Order by */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ref_asc">Ref # (1 - 77)</option>
            <option value="ref_desc">Ref # (77 - 1)</option>
            <option value="name">Producto (A - Z)</option>
            <option value="stock">Stock (Mayor a Menor)</option>
            <option value="price">Precio (Mayor a Menor)</option>
            <option value="val">Valor Stock Total</option>
          </select>

          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                sound.playClick();
                setViewMode('table');
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista en tabla"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setViewMode('cards');
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista en tarjetas"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Multi-Select Bulk Action Bar */}
      {selectedRefs.length > 0 && (
        <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold font-mono">
              {selectedRefs.length}
            </span>
            <span className="text-xs font-semibold">
              {selectedRefs.length === 1 ? '1 artículo seleccionado' : `${selectedRefs.length} artículos seleccionados`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteSelected}
              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              <span>Eliminar en Grupo ({selectedRefs.length})</span>
            </button>

            <button
              onClick={() => setSelectedRefs([])}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 transition-colors"
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Content View: Table or Cards */}
      {filteredArticles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-xl">
            🔍
          </div>
          <h3 className="text-base font-bold text-slate-800">No se encontraron artículos</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Prueba a cambiar los términos de búsqueda o los filtros de familia y stock.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedFamilia('all');
              setSelectedStockFilter('all');
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
          >
            Limpiar Filtros
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRefs.length > 0 && selectedRefs.length === filteredArticles.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 w-16">Ref</th>
                  <th className="py-3 px-3 min-w-[200px]">Producto</th>
                  <th className="py-3 px-3 min-w-[140px]">Familia</th>
                  <th className="py-3 px-3 min-w-[180px]">Proveedor</th>
                  <th className="py-3 px-3 text-right">Stock</th>
                  <th className="py-3 px-3 text-right">Stock Mín</th>
                  <th className="py-3 px-3 text-right">Precio Coste</th>
                  <th className="py-3 px-3 text-right">Valor Total</th>
                  <th className="py-3 px-3 text-center">Fecha Invent</th>
                  <th className="py-3 px-3 text-right w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredArticles.map((art) => {
                  const isSelected = selectedRefs.includes(art.referencia);
                  const isOutOfStock = art.stock === 0;
                  const isLowStock = art.stock > 0 && art.stock <= art.stockMin;
                  const totalValue = art.stock * art.precioCoste;

                  return (
                    <tr
                      key={art.referencia}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : isOutOfStock ? 'bg-red-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(art.referencia)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                      </td>

                      <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold text-slate-700">
                          #{art.referencia}
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 block">{art.producto}</span>
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {art.familia}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[200px]" title={art.proveedor}>
                        {art.proveedor}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isOutOfStock
                                ? 'text-red-600'
                                : isLowStock
                                ? 'text-amber-600'
                                : 'text-slate-900'
                            }`}
                          >
                            {art.stock} uds
                          </span>
                          {isOutOfStock ? (
                            <span className="text-[9px] font-black text-red-600 uppercase">Agotado</span>
                          ) : isLowStock ? (
                            <span className="text-[9px] font-bold text-amber-600">Bajo Stock</span>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {art.stockMin} uds
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                        {art.precioCoste.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-600">
                        {totalValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">
                        {art.fechaInvent}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              sound.playClick();
                              onEditArticle(art);
                            }}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar artículo"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"/>
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              sound.playClick();
                              if (window.confirm(`¿Eliminar el artículo #${art.referencia}: ${art.producto}?`)) {
                                onDeleteArticle(art.referencia);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar artículo"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Mostrando {filteredArticles.length} de {articles.length} artículos</span>
            <span>Inventario totalizado en Euros (€)</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredArticles.map((art) => {
            const isSelected = selectedRefs.includes(art.referencia);
            const isOutOfStock = art.stock === 0;
            const isLowStock = art.stock > 0 && art.stock <= art.stockMin;

            return (
              <div
                key={art.referencia}
                className={`bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20'
                    : isOutOfStock
                    ? 'border-red-200 bg-red-50/10'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-black px-2 py-0.5 bg-slate-900 text-white rounded-md">
                      #{art.referencia}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {art.familia}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mt-2 leading-snug">
                    {art.producto}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate" title={art.proveedor}>
                    {art.proveedor}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Stock Actual</span>
                      <span
                        className={`font-mono font-black ${
                          isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-slate-900'
                        }`}
                      >
                        {art.stock} uds
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Precio Coste</span>
                      <span className="font-mono font-bold text-slate-900">
                        {art.precioCoste.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Inv: {art.fechaInvent}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        sound.playClick();
                        onEditArticle(art);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        sound.playClick();
                        if (window.confirm(`¿Eliminar #${art.referencia}: ${art.producto}?`)) {
                          onDeleteArticle(art.referencia);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
