import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const DEMO_DIAS = 28
const APP_ID    = 'app-membresias'
const OWNER_ID  = process.env.DEMO_OWNER_ID ?? 'd8eef2e2-7e07-4ec9-9c6e-766addf89cc5'

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
  if (userErr || !user?.email) {
    return NextResponse.json({ ok: false, error: 'no_auth' }, { status: 401 })
  }

  const email = user.email.toLowerCase().trim()
  const nombreGoogle = (user.user_metadata?.full_name as string | undefined)?.trim() || null
  const central = createClient(process.env.CENTRAL_URL!, process.env.CENTRAL_SERVICE_KEY!)

  const nombre = nombreGoogle || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const { data: rpcResult, error: rpcErr } = await central.rpc('registrar_demo', {
    p_email:     email,
    p_nombre:    nombre,
    p_app_id:    APP_ID,
    p_owner_id:  OWNER_ID,
    p_demo_dias: DEMO_DIAS,
  })

  if (rpcErr) {
    console.error('[registrar-demo] Error RPC:', rpcErr)
    return NextResponse.json({ ok: false, error: 'error_central' }, { status: 500 })
  }

  if (rpcResult?.ya_existe) return NextResponse.json({ ok: true, ya_existe: true })

  const orgId = rpcResult?.org_id

  central.from('notificaciones_admin').insert({
    tipo: 'nueva_org',
    mensaje: `Nueva cuenta demo en App Membresías — ${nombre} (${email})`,
    org_id: orgId,
    app_id: APP_ID,
  }).then(() => {})

  await supabaseAdmin
    .from('config_org')
    .upsert({ org_id: orgId, onboarding_completo: false }, { onConflict: 'org_id', ignoreDuplicates: true })

  try {
    const { data: orgData } = await central.from('organizaciones').select('nombre, email_contacto').eq('id', orgId).single()
    const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
    const mailFrom = process.env.MAIL_FROM ?? 'onboarding@resend.dev'
    const appUrl = 'https://membresias.solucionesmdp.com.ar'

    const bienvenidaHtml = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:#7c3aed;padding:32px 24px;text-align:center;">
          <div style="font-size:40px;">🏋️</div>
          <h1 style="color:white;margin:8px 0 4px;font-size:22px;">App Membresías</h1>
          <p style="color:rgba(255,255,255,.85);margin:0;font-size:14px;">Soluciones MDP</p>
        </div>
        <div style="padding:32px 24px;">
          <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">¡Hola, ${nombre}!</h2>
          <p style="color:#374151;margin:0 0 24px;font-size:15px;line-height:1.6;">
            Tu prueba gratuita de <strong>${DEMO_DIAS} días</strong> ya está activa. Podés empezar a gestionar tu gimnasio o club ahora mismo.
          </p>
          <div style="background:#f9fafb;border-radius:10px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 12px;font-weight:700;color:#111827;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">¿Qué podés hacer?</p>
            <p style="margin:0 0 8px;color:#374151;font-size:14px;">✅ Registrar socios y gestionar actividades</p>
            <p style="margin:0 0 8px;color:#374151;font-size:14px;">✅ Registrar cobros y ver caja y rentabilidad</p>
            <p style="margin:0 0 0;color:#374151;font-size:14px;">✅ Gestionar profesores y liquidaciones</p>
          </div>
          <div style="text-align:center;">
            <a href="${appUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;">Abrir App Membresías →</a>
          </div>
        </div>
        <div style="padding:0 24px 24px;">
          <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:20px;text-align:center;">
            <p style="margin:0 0 6px;font-weight:700;color:#5b21b6;font-size:15px;">¿No sabés por dónde empezar?</p>
            <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">Tenemos una guía completa con todo lo que necesitás saber.</p>
            <a href="${appUrl}/ayuda" style="display:inline-block;background:#7c3aed;color:white;padding:10px 24px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;">📖 Ver guía de ayuda</a>
          </div>
        </div>
        <div style="border-top:1px solid #f1f5f9;padding:20px 24px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Soluciones MDP · <a href="https://wa.me/5492235767784" style="color:#9ca3af;">WhatsApp</a> · <a href="https://www.instagram.com/soluciones_mdp" style="color:#9ca3af;">Instagram</a> · <a href="https://www.facebook.com/share/1D7keoQJe1/" style="color:#9ca3af;">Facebook</a></p><p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">Seguinos en nuestras redes para enterarte de novedades y tips</p>
        </div>
      </div>`

    await Promise.all([
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: mailFrom,
          to: email,
          subject: `¡Bienvenido/a a App Membresías! Tu prueba de ${DEMO_DIAS} días está activa`,
          html: bienvenidaHtml,
        }),
      }),
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: mailFrom,
          to: 'cristianduly@gmail.com',
          subject: `Nueva cuenta demo — App Membresías — ${orgData?.nombre ?? email}`,
          html: `<h2>Nueva cuenta demo en App Membresías</h2>
            <p><b>Nombre:</b> ${orgData?.nombre ?? '—'}</p>
            <p><b>Email:</b> ${orgData?.email_contacto ?? email}</p>
            <p><b>Plan:</b> Profesional (demo ${DEMO_DIAS} días)</p>
            <p><b>Fecha:</b> ${fecha}</p>`,
        }),
      }),
    ])
  } catch {}

  return NextResponse.json({ ok: true, org_id: orgId })
}
