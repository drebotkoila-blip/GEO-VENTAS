import React, { useState, useEffect, useMemo } from 'react';
import { Sale, Client, Article, SalesRep } from '../types';
import { sound } from '../utils/audioFeedback';

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSale: (sale: Omit<Sale, 'id'>) => void;
  clients: Client[];
  articles: Article[];
  salesReps: SalesRep[];
  initialClientId?: string;
}

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  isOpen,
  onClose,
  onSaveSale,
  clients,
  articles,
  salesReps,
  initialClientId,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || '');
  const [customClientName, setCustomClientName] = useState<string>('');
  const [isCustomClient, setIsCustomClient] = useState<boolean>(false);

  const [selectedReferencia, setSelectedReferencia] = useState<number>(articles[0]?.referencia || 1);
  const [articleSearchQuery, setArticleSearchQuery] = useState<string>('');
  const [cantidad, setCantidad] = useState<number>(1);
  const [precioUnitario, setPrecioUnitario] = useState<number>(0);
  const [importeTotal, setImporteTotal] = useState<number>(0);
  const [vendedor, setVendedor] = useState<string>(salesReps[0]?.name || 'Carlos Morales');
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync initial client when prop changes
  useEffect(() => {
    if (initialClientId) {
      setSelectedClientId(initialClientId);
      setIsCustomClient(false);
    } else if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [initialClientId, clients]);

  // Current selected article details
  const selectedArticle = useMemo(() => {
    return articles.find((a) => a.referencia === Number(selectedReferencia));
  }, [articles, selectedReferencia]);

  // When article changes, set initial unit price
  useEffect(() => {
    if (selectedArticle) {
      const defaultUnitPrice = Number((selectedArticle.precioCoste * 1.35).toFixed(2)) || selectedArticle.precioCoste;
      setPrecioUnitario(defaultUnitPrice);
      setImporteTotal(Number((defaultUnitPrice * cantidad).toFixed(2)));
    }
  }, [selectedReferencia, selectedArticle]);

  // Recalculate total when quantity or unit price changes
  const handleCantidadChange = (val: number) => {
    const q = Math.max(1, val);
    setCantidad(q);
    setImporteTotal(Number((q * precioUnitario).toFixed(2)));
  };

  const handleUnitPriceChange = (val: number) => {
    setPrecioUnitario(val);
    setImporteTotal(Number((cantidad * val).toFixed(2)));
  };

  const handleTotalChange = (val: number) => {
    setImporteTotal(val);
    if (cantidad > 0) {
      setPrecioUnitario(Number((val / cantidad).toFixed(2)));
    }
  };

  // Filtered articles list for selection dropdown
  const filteredArticles = useMemo(() => {
    if (!articleSearchQuery.trim()) return articles.slice(0, 50);
    const q = articleSearchQuery.toLowerCase();
    return articles.filter(
      (a) =>
        String(a.referencia).includes(q) ||
        a.producto.toLowerCase().includes(q) ||
        a.familia.toLowerCase().includes(q)
    );
  }, [articles, articleSearchQuery]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let clientName = '';
    let idClienteVal = '';

    if (isCustomClient) {
      if (!customClientName.trim()) {
        setErrorMsg('Por favor introduce el nombre del cliente');
        return;
      }
      clientName = customClientName.trim();
      idClienteVal = `cli-custom-${Date.now()}`;
    } else {
      const foundClient = clients.find((c) => c.id === selectedClientId);
      if (!foundClient) {
        setErrorMsg('Por favor selecciona un cliente');
        return;
      }
      clientName = foundClient.name;
      idClienteVal = foundClient.id;
    }

    if (!selectedArticle) {
      setErrorMsg('Por favor selecciona un artículo válido');
      return;
    }

    if (cantidad <= 0) {
      setErrorMsg('La cantidad debe ser mayor a 0');
      return;
    }

    if (importeTotal <= 0) {
      setErrorMsg('El importe debe ser mayor a 0');
      return;
    }

    sound.playSuccess();

    onSaveSale({
      cliente: clientName,
      idCliente: idClienteVal,
      referencia: selectedArticle.referencia,
      vendedor: vendedor || (salesReps[0]?.name ?? 'Vendedor'),
      fecha,
      cantidad,
      importe: Number(importeTotal.toFixed(2)),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Registrar Nueva Venta</h3>
              <p className="text-xs text-blue-200">Guardado en Supabase (tabla VENTAS) y local</p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Cliente */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700">Cliente *</label>
              <button
                type="button"
                onClick={() => setIsCustomClient(!isCustomClient)}
                className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold"
              >
                {isCustomClient ? '← Seleccionar cliente de la lista' : '+ Escribir cliente nuevo'}
              </button>
            </div>

            {isCustomClient ? (
              <input
                type="text"
                placeholder="Nombre de la empresa o cliente..."
                value={customClientName}
                onChange={(e) => setCustomClientName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.address}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Artículo / Producto del Catálogo */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Artículo / Producto (Catálogo 77 Artículos) *</label>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Buscar por referencia o nombre..."
                value={articleSearchQuery}
                onChange={(e) => setArticleSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={selectedReferencia}
                onChange={(e) => setSelectedReferencia(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {filteredArticles.map((a) => (
                  <option key={a.referencia} value={a.referencia}>
                    [Ref. {a.referencia}] {a.producto} — Coste: {a.precioCoste.toFixed(2)}€ (Stock: {a.stock})
                  </option>
                ))}
              </select>

              {/* Selected Article Snapshot */}
              {selectedArticle && (
                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 flex items-center justify-between text-slate-700">
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">{selectedArticle.producto}</span>
                    <span className="text-[11px] text-slate-500">
                      Familia: <strong className="text-blue-700">{selectedArticle.familia}</strong> | Stock: <strong>{selectedArticle.stock} ud.</strong>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Coste Base</span>
                    <span className="font-mono font-bold text-slate-900">{selectedArticle.precioCoste.toFixed(2)} €</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Cantidad y Precios */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Cantidad *</label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleCantidadChange(cantidad - 1)}
                  className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-l-xl font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={cantidad}
                  onChange={(e) => handleCantidadChange(Number(e.target.value))}
                  className="w-full text-center bg-slate-50 border-y border-slate-300 py-2 font-mono font-bold text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCantidadChange(cantidad + 1)}
                  className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-r-xl font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Precio Ud. (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precioUnitario}
                onChange={(e) => handleUnitPriceChange(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-emerald-800">Total Venta (€) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={importeTotal}
                onChange={(e) => handleTotalChange(Number(e.target.value))}
                className="w-full bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2 font-mono font-bold text-emerald-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* 4. Vendedor y Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Vendedor Asignado *</label>
              <select
                value={vendedor}
                onChange={(e) => setVendedor(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {salesReps.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name} ({r.territory})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Fecha de Venta *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-slate-700 font-bold hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all flex items-center gap-1.5"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>Guardar Venta</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
