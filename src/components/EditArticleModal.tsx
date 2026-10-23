import React, { useState, useEffect } from 'react';
import { Article } from '../types';
import { sound } from '../utils/audioFeedback';

interface EditArticleModalProps {
  article: Article | null; // null for creating a new article
  onClose: () => void;
  onSave: (article: Article) => void;
  existingReferences: number[];
}

const DEFAULT_FAMILIAS = [
  'Bebidas',
  'Carnes',
  'Condimentos',
  'Frutas/Verduras',
  'Granos/Cereales',
  'Lácteos',
  'Pescado/Marisco',
  'Repostería',
  'Otro',
];

export const EditArticleModal: React.FC<EditArticleModalProps> = ({
  article,
  onClose,
  onSave,
  existingReferences,
}) => {
  const isEditing = !!article;

  const [referencia, setReferencia] = useState<number>(() => {
    if (article) return article.referencia;
    const maxRef = existingReferences.length > 0 ? Math.max(...existingReferences) : 0;
    return maxRef + 1;
  });

  const [producto, setProducto] = useState(article?.producto || '');
  const [proveedor, setProveedor] = useState(article?.proveedor || '');
  const [familia, setFamilia] = useState(article?.familia || 'Condimentos');
  const [stock, setStock] = useState<number>(article?.stock ?? 15);
  const [precioCoste, setPrecioCoste] = useState<number>(article?.precioCoste ?? 10.0);
  const [stockMin, setStockMin] = useState<number>(article?.stockMin ?? 20);
  const [fechaInvent, setFechaInvent] = useState(article?.fechaInvent || '31/12/2025');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (article) {
      setReferencia(article.referencia);
      setProducto(article.producto);
      setProveedor(article.proveedor);
      setFamilia(article.familia);
      setStock(article.stock);
      setPrecioCoste(article.precioCoste);
      setStockMin(article.stockMin);
      setFechaInvent(article.fechaInvent);
    }
  }, [article]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!producto.trim()) {
      setError('El nombre del producto es obligatorio.');
      return;
    }
    if (!proveedor.trim()) {
      setError('El proveedor es obligatorio.');
      return;
    }
    if (!referencia || referencia <= 0) {
      setError('La referencia debe ser un número entero positivo.');
      return;
    }
    if (!isEditing && existingReferences.includes(referencia)) {
      setError(`La referencia #${referencia} ya existe. Elige otra.`);
      return;
    }

    sound.playSuccess();
    onSave({
      referencia,
      producto: producto.trim(),
      proveedor: proveedor.trim(),
      familia: familia.trim() || 'General',
      stock: Math.max(0, Number(stock) || 0),
      precioCoste: Math.max(0, Number(precioCoste) || 0),
      stockMin: Math.max(0, Number(stockMin) || 0),
      fechaInvent: fechaInvent.trim() || '31/12/2025',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
              📦
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEditing ? `Editar Artículo #${article?.referencia}` : 'Nuevo Artículo en Catálogo'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Modifica los datos del inventario y coste' : 'Registra un nuevo producto con su stock y proveedor'}
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Referencia # *</label>
              <input
                type="number"
                min="1"
                disabled={isEditing}
                value={referencia}
                onChange={(e) => setReferencia(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Familia / Categoría *</label>
              <select
                value={familia}
                onChange={(e) => setFamilia(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEFAULT_FAMILIAS.map((fam) => (
                  <option key={fam} value={fam}>
                    {fam}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Nombre del Producto *</label>
            <input
              type="text"
              value={producto}
              onChange={(e) => setProducto(e.target.value)}
              placeholder="Ej. Mermelada de grosellas"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Proveedor *</label>
            <input
              type="text"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Ej. Grandma Kelly's Homestead"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Stock Actual</label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Stock Mínimo</label>
              <input
                type="number"
                min="0"
                value={stockMin}
                onChange={(e) => setStockMin(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Precio Coste (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={precioCoste}
                onChange={(e) => setPrecioCoste(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Fecha de Inventario</label>
            <input
              type="text"
              value={fechaInvent}
              onChange={(e) => setFechaInvent(e.target.value)}
              placeholder="31/12/2025"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              {isEditing ? 'Guardar Cambios' : 'Crear Artículo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
