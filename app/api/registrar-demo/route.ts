import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const DEMO_DIAS = 28
const APP_ID    = 'app-gastronomia'
const OWNER_ID  = 'd8eef2e2-7e07-4ec9-9c6e-766addf89cc5'

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

  const central = createClient(
    process.env.CENTRAL_URL!,
    process.env.CENTRAL_SERVICE_KEY!,
  )

  const { data: orgsExistentes, error: orgQueryErr } = await central
    .from('organizaciones')
    .select('id')
    .eq('email_contacto', email)
    .limit(1)

  if (orgQueryErr) {
    console.error('[registrar-demo] Error buscando org:', orgQueryErr)
    return NextResponse.json({ ok: false, error: 'error_central' }, { status: 500 })
  }

  let orgId: string

  if (orgsExistentes && orgsExistentes.length > 0) {
    orgId = orgsExistentes[0].id
    const { data: subExistente } = await central
      .from('suscripciones_apps')
      .select('id')
      .eq('org_id', orgId)
      .eq('app_id', APP_ID)
      .limit(1)
      .maybeSingle()
    if (subExistente) {
      return NextResponse.json({ ok: true, ya_existe: true })
    }
  } else {
    const nombre = email
      .split('@')[0]
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
    const { data: org, error: orgErr } = await central
      .from('organizaciones')
      .insert({ nombre: nombreGoogle || nombre, email_contacto: email, owner_id: OWNER_ID })
      .select('id')
      .single()
    if (orgErr || !org) {
      console.error('[registrar-demo] Error creando org:', orgErr)
      return NextResponse.json({ ok: false, error: 'error_central' }, { status: 500 })
    }
    orgId = org.id
  }

  // Siempre asegurar que el empleado exista
  await central
    .from('empleados_organizacion')
    .upsert({ org_id: orgId, email }, { onConflict: 'org_id,email', ignoreDuplicates: true })
    .then(({ error: e }) => { if (e) console.error('[registrar-demo] Error empleado:', e) })

  const hoy = new Date().toISOString().slice(0, 10)
  const vencimiento = new Date(Date.now() + DEMO_DIAS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { error: subErr } = await central
    .from('suscripciones_apps')
    .insert({
      org_id:            orgId,
      app_id:            APP_ID,
      plan:              'profesional',
      estado:            'demo',
      fecha_inicio_demo: hoy,
      limite_demo_dias:  DEMO_DIAS,
      fecha_vencimiento: vencimiento,
    })

  if (subErr) {
    console.error('[registrar-demo] Error creando suscripción:', subErr)
    return NextResponse.json({ ok: false, error: 'error_central' }, { status: 500 })
  }

  // Crear config_local en la app para que el onboarding funcione
  const { error: configErr } = await supabaseAdmin
    .from('config_local')
    .upsert({
      local_id:     orgId,
      nombre_negocio: '',
      tipo_negocio: 'restaurante',
      onboarding_completo: false,
    }, { onConflict: 'local_id', ignoreDuplicates: true })

  if (configErr) {
    console.error('[registrar-demo] Error creando config_local:', configErr)
  }

  // Insertar notificación en el panel admin
  await central.from('notificaciones_admin').insert({ org_id: orgId, tipo: 'nueva_org', app_id: APP_ID })

  // Notificar al admin por email
  try {
    const { data: orgData } = await central
      .from('organizaciones')
      .select('nombre, email_contacto')
      .eq('id', orgId)
      .single()

    const fechaAlta = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'cristianduly@gmail.com',
        subject: `🆕 Nueva cuenta demo — ${orgData?.nombre ?? email}`,
        html: `
          <h2>🆕 Nueva cuenta demo en App de Gastronomía</h2>
          <table style="border-collapse:collapse;font-family:sans-serif;">
            <tr><td style="padding:8px;font-weight:bold;">Nombre</td><td style="padding:8px;">${orgData?.nombre ?? '—'}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;">${orgData?.email_contacto ?? email}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">App</td><td style="padding:8px;">Gastronomía</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Plan</td><td style="padding:8px;">Profesional (demo)</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Días de prueba</td><td style="padding:8px;">${DEMO_DIAS} días</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Fecha de alta</td><td style="padding:8px;">${fechaAlta}</td></tr>
          </table>
        `,
      }),
    })
  } catch (mailErr) {
    console.error('[registrar-demo] Error enviando email:', mailErr)
  }

  return NextResponse.json({ ok: true })
}
