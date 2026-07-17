import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import { reportarError } from '@/lib/reportarError'

function esc(s: unknown) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'no_auth' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const supabaseApp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: userErr } = await supabaseApp.auth.getUser()
  if (userErr || !user) return NextResponse.json({ ok: false, error: 'no_auth' }, { status: 401 })

  const { socio_id, org_id } = await req.json()
  if (!socio_id || !org_id) return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })

  const [{ data: socio }, { data: membresias }, { data: org }] = await Promise.all([
    supabaseApp.from('socios').select('nombre, apellido, email').eq('id', socio_id).eq('org_id', org_id).single(),
    supabaseApp.from('membresias').select('tipo, fecha_vencimiento').eq('socio_id', socio_id).eq('org_id', org_id).order('fecha_vencimiento', { ascending: false }).limit(1),
    supabaseApp.from('config_org').select('nombre_negocio, telefono, logo_url').eq('org_id', org_id).maybeSingle(),
  ])

  if (!socio?.email) return NextResponse.json({ ok: false, error: 'sin_email' })

  const membresia = membresias?.[0] ?? null
  const fechaVenc = membresia?.fecha_vencimiento
    ? new Date(membresia.fecha_vencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  // Generar QR como Buffer PNG para adjuntar inline
  const qrDataUrl = await QRCode.toDataURL(socio_id, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  })
  const qrBase64 = qrDataUrl.match(/^data:.+;base64,(.+)$/)![1]

  const nombreNegocio = (org as any)?.nombre_negocio || 'Tu gimnasio'
  const whatsapp = (org as any)?.telefono
  const logoUrl = (org as any)?.logo_url

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#7c3aed;padding:32px 24px;text-align:center;">
        ${logoUrl
          ? `<img src="${esc(logoUrl)}" alt="${esc(nombreNegocio)}" style="width:64px;height:64px;border-radius:16px;object-fit:cover;margin-bottom:8px;" />`
          : `<div style="font-size:40px;">🏋️</div>`}
        <h1 style="color:white;margin:8px 0 4px;font-size:22px;">${esc(nombreNegocio)}</h1>
        <p style="color:rgba(255,255,255,.85);margin:0;font-size:14px;">Bienvenido/a</p>
      </div>
      <div style="padding:32px 24px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">¡Hola, ${esc(socio.nombre)}!</h2>
        <p style="color:#374151;margin:0 0 24px;font-size:15px;line-height:1.6;">
          Tu membresía fue registrada con éxito. Este es tu código QR personal para registrar tu asistencia en cada visita.
        </p>

        <div style="background:#f9fafb;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center;">
          <p style="margin:0 0 12px;font-weight:700;color:#111827;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">Tu QR de acceso</p>
          <img src="cid:qr-acceso" alt="QR de acceso" style="width:200px;height:200px;display:block;margin:0 auto;border-radius:8px;" />
          <p style="margin:12px 0 0;color:#6b7280;font-size:12px;">Mostralo en recepción para registrar tu entrada</p>
        </div>

        ${membresia ? `
        <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-weight:700;color:#5b21b6;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">Datos de tu membresía</p>
          ${membresia.tipo ? `<p style="margin:0 0 6px;color:#374151;font-size:14px;">📋 <b>Plan:</b> ${membresia.tipo}</p>` : ''}
          ${fechaVenc ? `<p style="margin:0;color:#374151;font-size:14px;">📅 <b>Vence:</b> ${fechaVenc}</p>` : ''}
        </div>` : ''}

        ${whatsapp ? `
        <div style="text-align:center;">
          <a href="https://wa.me/${whatsapp.replace(/\D/g,'')}" style="display:inline-block;background:#25d366;color:white;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;">💬 Contactar por WhatsApp</a>
        </div>` : ''}
      </div>
      <div style="border-top:1px solid #f1f5f9;padding:20px 24px;text-align:center;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">Powered by Soluciones MDP · <a href="https://wa.me/5492235767784" style="color:#9ca3af;">WhatsApp</a> · <a href="https://www.instagram.com/soluciones_mdp" style="color:#9ca3af;">Instagram</a></p>
      </div>
    </div>`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? 'onboarding@resend.dev',
        to: socio.email,
        subject: `¡Bienvenido/a a ${nombreNegocio}! Tu QR de acceso`,
        html,
        attachments: [
          {
            filename: 'qr-acceso.png',
            content: qrBase64,
            content_type: 'image/png',
            content_id: 'qr-acceso',
            inline: true,
          },
        ],
      }),
    })
  } catch (err: any) {
    console.error('[mail/socio-bienvenida] Resend error:', err?.message ?? err)
    reportarError(err, { pantalla: 'mail/socio-bienvenida', accion: 'send_email', user_email: socio?.email, org_id })
    return NextResponse.json({ ok: false, error: 'mail_error', detail: err?.message })
  }

  return NextResponse.json({ ok: true })
}
