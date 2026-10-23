import React, { useState } from 'react';
import {
  SUPABASE_URL,
  SUPABASE_KEY,
  SUPABASE_SQL_SETUP,
  ARTICULOS_FULL_SQL,
  SupabaseSyncState,
} from '../lib/supabase';
import { sound } from '../utils/audioFeedback';

interface SupabaseSyncModalProps {
  syncState: SupabaseSyncState;
  onClose: () => void;
  onSyncNow: () => Promise<void>;
  onSeedSupabase: () => Promise<void>;
  vendedoresCount: number;
  clientesCount: number;
  visitasCount: number;
  articulosCount?: number;
  ventasCount?: number;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  syncState,
  onClose,
  onSyncNow,
  onSeedSupabase,
  vendedoresCount,
  clientesCount,
  visitasCount,
  articulosCount = 77,
  ventasCount = 28,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'sql'>('status');
  const [sqlType, setSqlType] = useState<'all' | 'articulos' | 'ventas'>('ventas');
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const VENTAS_SQL = `-- TABLA VENTAS EN SUPABASE Y POLÍTICAS DE ACCESO
CREATE TABLE IF NOT EXISTS public."VENTAS" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente text NOT NULL,
  id_cliente text,
  referencia integer NOT NULL,
  "Vendedor" text,
  "Fecha" text DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD'),
  "Cantidad" numeric DEFAULT 1,
  "Importe" numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public."VENTAS" ENABLE ROW LEVEL SECURITY;

-- Política de acceso total para anon (lectura y escritura desde la web)
DROP POLICY IF EXISTS "Permitir todo a anon en VENTAS" ON public."VENTAS";
CREATE POLICY "Permitir todo a anon en VENTAS" 
ON public."VENTAS" 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Permisos
GRANT ALL ON public."VENTAS" TO anon, authenticated, service_role;`;

  const currentSqlText = sqlType === 'ventas' ? VENTAS_SQL : sqlType === 'articulos' ? ARTICULOS_FULL_SQL : SUPABASE_SQL_SETUP;

  const handleCopySql = () => {
    sound.playClick();
    navigator.clipboard.writeText(currentSqlText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleManualSync = async () => {
    sound.playClick();
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      await onSyncNow();
      sound.playSuccess();
      setSyncMessage('Sincronización completada exitosamente.');
    } catch (err: any) {
      sound.playWarning();
      setSyncMessage(`Aviso: ${err.message || 'Error de sincronización'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeed = async () => {
    sound.playClick();
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      await onSeedSupabase();
      sound.playSuccess();
      setSyncMessage('Datos iniciales subidos a Supabase correctamente.');
    } catch (err: any) {
      sound.playWarning();
      setSyncMessage(`Aviso: ${err.message || 'Error al subir datos'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <img 
              src="/assets/aistudio/geo-logo-design-inspiration-for-a-unique-identity-modern-elegance-and-creative-design-watermark-your-success-with-the-striking-this-logo-vector_47d08a1d.jpg" 
              alt="GEO Logo" 
              className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shadow-xs shrink-0"
            />
            <div>
              <h3 className="text-base font-bold text-slate-900">Conexión con Supabase</h3>
              <p className="text-xs text-slate-500">Base de datos en la nube y sincronización en tiempo real</p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-6 pt-3 border-b border-slate-200 bg-slate-50/50">
          <div className="flex gap-4 text-xs font-bold">
            <button
              onClick={() => {
                sound.playClick();
                setActiveTab('status');
              }}
              className={`pb-2.5 transition-colors border-b-2 ${
                activeTab === 'status'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Estado de Sincronización
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setActiveTab('sql');
              }}
              className={`pb-2.5 transition-colors border-b-2 ${
                activeTab === 'sql'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Script SQL de Tablas
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {activeTab === 'status' ? (
            <div className="space-y-4 text-xs">
              {/* Connection Status Card */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                  syncState.isConnected
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    : 'bg-red-50/90 border-red-300 text-red-950'
                }`}
              >
                <div
                  className={`mt-0.5 p-2 rounded-xl text-white ${
                    syncState.isConnected ? 'bg-emerald-600' : 'bg-red-600'
                  }`}
                >
                  {syncState.isConnected ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">
                      {syncState.isConnected
                        ? 'Conectado Exitosamente a Supabase'
                        : 'Error al conectar con Supabase'}
                    </span>
                    <span className="text-[11px] font-mono font-semibold">
                      {syncState.isConnected ? 'EN LÍNEA' : 'OFFLINE'}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    {syncState.isConnected
                      ? 'La API de Supabase responde y autentica correctamente con tu Publishable Key.'
                      : syncState.error || 'Verifica la URL o conexión.'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    URL: {SUPABASE_URL}
                  </p>
                </div>
              </div>

              {/* Data Overview Strip */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 text-xs block">Registros Locales y en la Nube</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Vendedores</span>
                    <span className="font-bold text-slate-900 text-sm font-mono tabular-nums">{vendedoresCount}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Clientes</span>
                    <span className="font-bold text-slate-900 text-sm font-mono tabular-nums">{clientesCount}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Visitas</span>
                    <span className="font-bold text-slate-900 text-sm font-mono tabular-nums">{visitasCount}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-300 bg-emerald-50/40">
                    <span className="text-[10px] text-emerald-700 font-bold block">Artículos</span>
                    <span className="font-bold text-emerald-800 text-sm font-mono tabular-nums">{articulosCount}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-blue-300 bg-blue-50/40">
                    <span className="text-[10px] text-blue-700 font-bold block">Ventas</span>
                    <span className="font-bold text-blue-800 text-sm font-mono tabular-nums">{ventasCount}</span>
                  </div>
                </div>
              </div>

              {/* Status Notice message */}
              {syncMessage && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 font-medium">
                  {syncMessage}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isSyncing ? 'animate-spin' : ''}>
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                    <path d="M16 21h5v-5"/>
                  </svg>
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar con Supabase'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSeed}
                  disabled={isSyncing}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
                  title="Sube los datos iniciales de vendedores, clientes y artículos a tu base de datos Supabase"
                >
                  <span>Subir Datos a Supabase</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              {/* SQL sub-selector */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setSqlType('ventas');
                  }}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    sqlType === 'ventas' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  📊 Tabla VENTAS y RLS
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setSqlType('articulos');
                  }}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    sqlType === 'articulos' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  📦 Tabla Artículos (+77)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setSqlType('all');
                  }}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    sqlType === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  🗄️ Todo el Esquema
                </button>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-slate-600">
                  {sqlType === 'ventas'
                    ? 'Esquema de la tabla "VENTAS" con políticas RLS para habilitar lectura y escritura pública:'
                    : sqlType === 'articulos'
                    ? 'Copia y ejecuta este script en Supabase para crear la tabla "articulos" e insertar los 77 registros:'
                    : 'Esquema completo con Vendedores, Clientes, Visitas, Artículos y Ventas:'}
                </p>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3.5 py-1.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <span>{copiedSql ? '✓ Copiado' : 'Copiar SQL'}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto text-[11px] font-mono max-h-60 leading-relaxed">
                  {currentSqlText}
                </pre>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 space-y-1 text-[11px]">
                <strong className="block font-semibold">Instrucciones rápidas en Supabase:</strong>
                <ol className="list-decimal pl-4 space-y-0.5">
                  <li>Abre tu consola de Supabase (<a href="https://supabase.com/dashboard/project/jeuqkaidbikwbdquhkaa/sql" target="_blank" rel="noreferrer" className="underline font-bold">SQL Editor</a>).</li>
                  <li>Haz clic en <strong>New Query</strong>, pega el script copiado y pulsa <strong>Run</strong>.</li>
                  <li>¡Listo! La tabla quedará creada con todos los datos e índices.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Publishable Key: <span className="font-mono">{SUPABASE_KEY.substring(0, 16)}...</span></span>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
