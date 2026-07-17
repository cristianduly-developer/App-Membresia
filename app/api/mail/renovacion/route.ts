import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'

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

  const { socio_id, org_id, nueva_fecha_vencimiento, monto, tipo } = await req.json()
  if (!socio_id || !org_id) return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })

  const [{ data: socio }, { data: org }] = await Promise.all([
    supabaseApp.from('socios').select('nombre, apellido, email').eq('id', socio_id).eq('org_id', org_id).single(),
    supabaseApp.from('config_org').select('nombre_negocio, telefono, logo_url').eq('org_id', org_id).maybeSingle(),
  ])

  if (!socio?.email) return NextResponse.json({ ok: false, error: 'sin_email' })

  const fechaVenc = nueva_fecha_vencimiento
    ? new Date(nueva_fecha_vencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

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
          : `<div style="font-size:40px;">✅</div>`}
        <h1 style="color:white;margin:8px 0 4px;font-size:22px;">${esc(nombreNegocio)}</h1>
        <p style="color:rgba(255,255,255,.85);margin:0;font-size:14px;">Renovación confirmada</p>
      </div>
      <div style="padding:32px 24px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">¡Hola, ${esc(socio.nombre)}!</h2>
        <p style="color:#374151;margin:0 0 24px;font-size:15px;line-height:1.6;">
          Tu membresía fue renovada con éxito. Seguís teniendo acceso completo.
        </p>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-weight:700;color:#166534;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">Resumen de la renovación</p>
          ${tipo ? `<p style="margin:0 0 6px;color:#374151;font-size:14px;">📋 <b>Plan:</b> ${tipo}</p>` : ''}
          ${monto ? `<p style="margin:0 0 6px;color:#374151;font-size:14px;">💰 <b>Monto abonado:</b> $${Number(monto).toLocaleString('es-AR')}</p>` : ''}
          ${fechaVenc ? `<p style="margin:0;color:#374151;font-size:14px;">📅 <b>Nuevo vencimiento:</b> ${fechaVenc}</p>` : ''}
        </div>

        <div style="background:#f9fafb;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center;">
          <p style="margin:0 0 12px;font-weight:700;color:#111827;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">Tu QR de acceso</p>
          <img src="cid:qr-acceso" alt="QR de acceso" style="width:180px;height:180px;display:block;margin:0 auto;border-radius:8px;" />
          <p style="margin:12px 0 0;color:#6b7280;font-size:12px;">Guardalo por si lo necesitás</p>
        </div>

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
        subject: `Membresía renovada en ${nombreNegocio} ✅`,
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
  } catch (err) {
    console.error('[mail/renovacion]', err)
    return NextResponse.json({ ok: false, error: 'mail_error' })
  }

  return NextResponse.json({ ok: true })
}
