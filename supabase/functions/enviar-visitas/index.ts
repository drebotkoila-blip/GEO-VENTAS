// Supabase Edge Function: enviar-visitas
// Envía un email con adjuntos (Excel de visitas) usando la cuenta de Gmail del propietario por SMTP (puerto 465).
//
// Secrets necesarios (Supabase → Edge Functions → Secrets):
//   GMAIL_USER          → tu dirección de Gmail (ej: tunombre@gmail.com)
//   GMAIL_APP_PASSWORD  → contraseña de aplicación de Google (16 letras, requiere verificación en 2 pasos)
//
// Seguridad: solo envía a emails que existan en la tabla `vendedores`, para que nadie pueda usar
// esta función como relay de spam desde tu Gmail.

import nodemailer from 'npm:nodemailer@6.9.16';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MAX_ATTACH_BYTES = 8 * 1024 * 1024; // 8 MB en total

interface Attachment {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });

  const GMAIL_USER = Deno.env.get('GMAIL_USER');
  const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD');
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return json(500, {
      error: 'Falta configurar GMAIL_USER y GMAIL_APP_PASSWORD en los Secrets de Edge Functions de Supabase.',
      code: 'missing_secrets',
    });
  }

  let body: { to?: string; subject?: string; text?: string; fromName?: string; attachments?: Attachment[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'JSON inválido' });
  }

  const to = (body.to || '').trim().toLowerCase();
  const subject = (body.subject || 'Visitas — GeoVentas').slice(0, 200);
  const text = (body.text || '').slice(0, 50_000);
  const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 5) : [];

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json(400, { error: 'Email del comercial no válido' });

  // Solo destinatarios que sean comerciales dados de alta
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: reps, error: repErr } = await supa.from('vendedores').select('id').ilike('email', to).limit(1);
  if (repErr) return json(500, { error: 'No se pudo comprobar el comercial: ' + repErr.message });
  if (!reps || reps.length === 0) {
    return json(403, { error: 'Ese email no pertenece a ningún comercial de GeoVentas (tabla vendedores).' });
  }

  let total = 0;
  const mailAttachments = attachments.map((a) => {
    const content = a.contentBase64 || '';
    total += Math.floor((content.length * 3) / 4);
    return {
      filename: (a.filename || 'archivo.xlsx').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120),
      content,
      encoding: 'base64' as const,
      contentType: a.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  });
  if (total > MAX_ATTACH_BYTES) return json(413, { error: 'Los adjuntos superan 8 MB' });

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465, // Supabase bloquea 25 y 587; 465 (SSL) está permitido
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s+/g, '') },
    });
    const info = await transporter.sendMail({
      from: `"${(body.fromName || 'GeoVentas').replace(/"/g, '')}" <${GMAIL_USER}>`,
      to,
      replyTo: GMAIL_USER,
      subject,
      text,
      attachments: mailAttachments,
    });
    return json(200, { ok: true, messageId: info.messageId });
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    const hint = /Invalid login|Username and Password not accepted|535/i.test(msg)
      ? ' — Gmail rechazó el acceso: revisa GMAIL_USER y que GMAIL_APP_PASSWORD sea una contraseña de aplicación.'
      : '';
    return json(502, { error: 'Error enviando el correo: ' + msg + hint });
  }
});
