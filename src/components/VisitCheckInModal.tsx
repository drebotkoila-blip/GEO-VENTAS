import React, { useState, useRef, useEffect } from 'react';
import { Visit, Client, SalesRep, VisitOutcome } from '../types';
import { calculateDistanceMeters, formatDistance } from '../utils/geoUtils';
import { sound } from '../utils/audioFeedback';

interface VisitCheckInModalProps {
  visit: Visit;
  client: Client;
  rep: SalesRep;
  onClose: () => void;
  onCheckIn: (visitId: string, coords: { lat: number; lng: number }, distance: number, isWithinGeofence: boolean, reason?: string) => void;
  onCheckOut: (visitId: string, data: {
    outcome: VisitOutcome;
    saleAmount?: number;
    notes: string;
    rating: number;
    signatureBase64?: string;
    photoUrl?: string;
  }) => void;
}

export const VisitCheckInModal: React.FC<VisitCheckInModalProps> = ({
  visit,
  client,
  rep,
  onClose,
  onCheckIn,
  onCheckOut,
}) => {
  const isCheckingIn = visit.status === 'scheduled';
  const isCheckingOut = visit.status === 'in_progress';

  // Distance calculation
  const distanceToClient = calculateDistanceMeters(rep.currentCoords, client.coords);
  const isWithinGeofence = distanceToClient <= client.geofenceRadiusMeters;

  // Form states
  const [overrideReason, setOverrideReason] = useState('');
  const [outcome, setOutcome] = useState<VisitOutcome>('sale_closed');
  const [saleAmount, setSaleAmount] = useState<number | ''>(visit.saleAmount || '');
  const [notes, setNotes] = useState(visit.notes || '');
  const [rating, setRating] = useState(5);
  const [hasSignature, setHasSignature] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(visit.photoUrl || null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Canvas for signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [isCheckingOut]);

  // Clean camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    sound.playClick();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Camera capture handlers
  const handleStartCamera = async () => {
    sound.playClick();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch {
      // Fallback: file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setPhotoPreview(ev.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const handleCaptureSnapshot = () => {
    sound.playClick();
    if (videoRef.current) {
      const video = videoRef.current;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = video.videoWidth || 640;
      offCanvas.height = video.videoHeight || 480;
      const ctx = offCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);
        setPhotoPreview(offCanvas.toDataURL('image/jpeg', 0.85));
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsCameraActive(false);
    }
  };

  const handleConfirmCheckIn = () => {
    if (isWithinGeofence) {
      sound.playSuccess();
    } else {
      sound.playWarning();
    }
    onCheckIn(
      visit.id,
      rep.currentCoords,
      distanceToClient,
      isWithinGeofence,
      !isWithinGeofence ? overrideReason : undefined
    );
  };

  const handleConfirmCheckOut = () => {
    if (outcome === 'sale_closed') {
      sound.playFanfare();
    } else {
      sound.playSuccess();
    }

    let signatureBase64: string | undefined = undefined;
    if (hasSignature && canvasRef.current) {
      signatureBase64 = canvasRef.current.toDataURL('image/png');
    }

    onCheckOut(visit.id, {
      outcome,
      saleAmount: typeof saleAmount === 'number' ? saleAmount : undefined,
      notes,
      rating,
      signatureBase64,
      photoUrl: photoPreview || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isCheckingIn ? 'Registro de Llegada (Check-in GPS)' : 'Finalización de Visita (Check-out)'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {client.name} · {client.city}
            </p>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Client summary */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Dirección:</span>
              <span className="text-slate-900 font-semibold text-right">{client.address}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Contacto:</span>
              <span className="text-slate-900 font-medium">{client.contactName} ({client.phone})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Objetivo:</span>
              <span className="text-slate-800 italic text-right max-w-xs">{visit.objective}</span>
            </div>
          </div>

          {/* CHECK-IN STATE */}
          {isCheckingIn && (
            <div className="space-y-4">
              {/* Geofence status banner */}
              <div
                className={`rounded-xl p-4 border transition-all ${
                  isWithinGeofence
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs'
                    : 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 p-2 rounded-xl text-white shadow-xs ${
                      isWithinGeofence ? 'bg-emerald-600' : 'bg-amber-600'
                    }`}
                  >
                    {isWithinGeofence ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    )}
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-sm">
                      {isWithinGeofence
                        ? 'Geolocalización GPS Verificada'
                        : 'Fuera de la Geocerca del Cliente'}
                    </p>
                    <p>
                      Distancia calculada:{' '}
                      <strong className="font-mono tabular-nums text-sm">{formatDistance(distanceToClient)}</strong>{' '}
                      (Radio límite: <span className="font-mono tabular-nums">{client.geofenceRadiusMeters}m</span>)
                    </p>
                    <p className="text-[11px] opacity-80">
                      Coordenadas registradas:{' '}
                      <span className="font-mono tabular-nums">
                        {rep.currentCoords.lat.toFixed(6)}, {rep.currentCoords.lng.toFixed(6)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {!isWithinGeofence && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Motivo de Check-in a distancia (Obligatorio para auditoría)
                  </label>
                  <textarea
                    rows={2}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Ej: Cliente atendió en la nave de enfrente o cafetería anexa..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* CHECK-OUT STATE */}
          {isCheckingOut && (
            <div className="space-y-4">
              {/* Outcome selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Resultado Comercial
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'sale_closed', label: 'Venta Cerrada' },
                    { id: 'negotiation', label: 'En Negociación' },
                    { id: 'rescheduled', label: 'Reagendada' },
                    { id: 'not_interested', label: 'No Interesado' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setOutcome(opt.id as VisitOutcome);
                      }}
                      className={`p-2.5 rounded-xl border font-semibold transition-all text-left flex items-center justify-between ${
                        outcome === opt.id
                          ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {outcome === opt.id && <span className="text-blue-600 font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount closed */}
              {outcome === 'sale_closed' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Importe del Pedido (€)
                  </label>
                  <input
                    type="number"
                    value={saleAmount}
                    onChange={(e) => setSaleAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ej: 4500"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-base font-bold"
                  />
                </div>
              )}

              {/* Satisfaction rating */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Satisfacción / Calificación del Cliente
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setRating(star);
                      }}
                      className="p-1 text-lg hover:scale-110 transition-transform"
                    >
                      <span className={star <= rating ? 'text-amber-400' : 'text-slate-300'}>
                        ★
                      </span>
                    </button>
                  ))}
                  <span className="text-xs font-medium text-slate-500 ml-2">
                    {rating === 5 ? 'Excelente' : rating >= 4 ? 'Muy Buena' : rating >= 3 ? 'Regular' : 'Baja'}
                  </span>
                </div>
              </div>

              {/* Visit Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resumen de la visita y compromisos
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Temas tratados, lista de pedidos, fecha pactada..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Photo Evidence / Attachment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Evidencia Fotográfica (Fachada / Albarán / Muestras)
                </label>
                {isCameraActive ? (
                  <div className="space-y-2">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-44 bg-black rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={handleCaptureSnapshot}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold"
                    >
                      Capturar Foto Ahora
                    </button>
                  </div>
                ) : photoPreview ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-200">
                    <img src={photoPreview} alt="Evidencia de visita" className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setPhotoPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-slate-900/80 text-white p-1 rounded-md text-xs hover:bg-red-600 transition-colors"
                    >
                      Cambiar foto
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartCamera}
                    className="w-full py-2.5 border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/50 rounded-xl text-xs font-medium text-slate-600 flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                      <circle cx="12" cy="13" r="3"/>
                    </svg>
                    <span>Tomar o subir foto de la visita</span>
                  </button>
                )}
              </div>

              {/* Digital Signature Pad */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Firma de Conformidad Digital
                  </label>
                  {hasSignature && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="border border-dashed border-slate-300 rounded-xl p-1 bg-slate-50">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={100}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-[100px] bg-white rounded-lg cursor-crosshair touch-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            Cancelar
          </button>

          {isCheckingIn && (
            <button
              onClick={handleConfirmCheckIn}
              disabled={!isWithinGeofence && !overrideReason.trim()}
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>Confirmar Llegada GPS</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
          )}

          {isCheckingOut && (
            <button
              onClick={handleConfirmCheckOut}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>Finalizar Visita y Guardar</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
