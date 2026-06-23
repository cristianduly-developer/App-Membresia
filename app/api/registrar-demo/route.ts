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

  await supabaseAdmin
    .from('config_org')
    .upsert({ org_id: orgId, onboarding_completo: false }, { onConflict: 'org_id', ignoreDuplicates: true })

  try {
    const { data: orgData } = await central.from('organizaciones').select('nombre, email_contacto').eq('id', orgId).single()
    const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'cristianduly@gmail.com',
        subject: `Nueva cuenta demo — SocioApp — ${orgData?.nombre ?? email}`,
        html: `<h2>Nueva cuenta demo en SocioApp</h2>
          <p><b>Nombre:</b> ${orgData?.nombre ?? '—'}</p>
          <p><b>Email:</b> ${orgData?.email_contacto ?? email}</p>
          <p><b>Plan:</b> Profesional (demo ${DEMO_DIAS} días)</p>
          <p><b>Fecha:</b> ${fecha}</p>`,
      }),
    })
  } catch {}

  return NextResponse.json({ ok: true, org_id: orgId })
}
