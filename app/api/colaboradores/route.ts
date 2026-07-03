import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verificarAcceso } from '@/lib/supabaseCentral'
import { createClient } from '@supabase/supabase-js'

const central = createClient(process.env.CENTRAL_URL!, process.env.CENTRAL_SERVICE_KEY!)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { nombre, email, rol, orgId } = await req.json()
  if (!nombre || !email || !orgId) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  // El que agrega colaboradores tiene que ser el dueño de esa organización
  const acceso = await verificarAcceso(user.email.toLowerCase())
  if (!acceso?.tiene_acceso || acceso.ret_org_id !== orgId) {
    return NextResponse.json({ error: 'No autorizado sobre esta organización' }, { status: 403 })
  }

  const emailLower = email.trim().toLowerCase()

  // Verificar duplicado en DB local
  const { data: existe } = await supabaseAdmin
    .from('colaboradores')
    .select('id')
    .eq('org_id', orgId)
    .eq('email', emailLower)
    .maybeSingle()

  if (existe) return NextResponse.json({ error: 'Ese email ya está registrado' }, { status: 409 })

  // Límite de colaboradores por plan (plan real desde la central, no del cliente)
  const LIMITES_COLAB: Record<string, number> = { basico: 0, profesional: 2, premium: 5, sincargo: 2 }
  const limite = LIMITES_COLAB[acceso.plan] ?? 0
  const { count } = await supabaseAdmin
    .from('colaboradores')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('activo', true)
  if ((count ?? 0) >= limite) {
    return NextResponse.json({ error: limite === 0 ? 'Tu plan no incluye colaboradores. Actualizá el plan para sumar personal.' : `Tu plan permite hasta ${limite} colaboradores. Actualizá el plan para agregar más.` }, { status: 403 })
  }

  // Insertar en DB local
  const { error: localErr } = await supabaseAdmin.from('colaboradores').insert({
    org_id: orgId,
    email: emailLower,
    nombre: nombre.trim(),
    rol,
    activo: true,
  })
  if (localErr) return NextResponse.json({ error: localErr.message }, { status: 500 })

  // Insertar en central
  central.from('empleados_organizacion').upsert({
    org_id: orgId,
    email: emailLower,
    nombre: nombre.trim(),
    activo: true,
  }, { onConflict: 'org_id,email', ignoreDuplicates: true }).then(() => {})

  // Notificar al saas-admin-panel
  central.from('notificaciones_admin').insert({
    tipo: 'nuevo_colaborador',
    mensaje: `Nuevo colaborador en App Membresías — ${nombre} (${emailLower}) — rol: ${rol}`,
    org_id: orgId,
    app_id: 'app-membresias',
  }).then(() => {})

  return NextResponse.json({ ok: true })
}
