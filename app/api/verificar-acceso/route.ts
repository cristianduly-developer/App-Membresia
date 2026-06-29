import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verificarAcceso } from '@/lib/supabaseCentral'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  // Usar el email del token verificado (más confiable que el param)
  const verifiedEmail = (user.email ?? email).toLowerCase()

  // Verificar si es colaborador
  const { data: colab } = await supabaseAdmin
    .from('colaboradores')
    .select('org_id, rol')
    .eq('email', verifiedEmail)
    .eq('activo', true)
    .maybeSingle()

  if (colab) {
    // Verificar que la suscripción del owner sigue activa
    const central = createClient(
      process.env.CENTRAL_URL!,
      process.env.CENTRAL_SERVICE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data: subData } = await central
      .from('suscripciones_apps')
      .select('estado, plan')
      .eq('org_id', colab.org_id)
      .eq('app_id', 'app-membresias')
      .maybeSingle()

    if (!subData || ['suspendido', 'impago'].includes(subData.estado)) {
      return NextResponse.json({ error: 'cuenta_suspendida' }, { status: 403 })
    }

    return NextResponse.json({
      esColab: true,
      localId: colab.org_id,
      rol: colab.rol,
      plan: subData.plan ?? 'basico',
    })
  }

  // Verificar contra el central
  const acceso = await verificarAcceso(verifiedEmail)

  if (acceso && acceso.tiene_acceso) {
    // Auto-registrar empleado si no existe
    const central = createClient(
      process.env.CENTRAL_URL!,
      process.env.CENTRAL_SERVICE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data: empExiste } = await central
      .from('empleados_organizacion')
      .select('id')
      .eq('org_id', acceso.ret_org_id)
      .eq('email', verifiedEmail)
      .maybeSingle()
    if (!empExiste) {
      await central.from('empleados_organizacion').insert({
        org_id: acceso.ret_org_id,
        email: verifiedEmail,
        nombre: acceso.nombre_docente || null,
        activo: true,
      })
    }
    // Actualizar ultimo_acceso
    const centralPing = createClient(process.env.CENTRAL_URL!, process.env.CENTRAL_SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    centralPing.from('suscripciones_apps').update({ ultimo_acceso: new Date().toISOString() }).eq('org_id', acceso.ret_org_id).eq('app_id', 'app-membresias').then(() => {})
    return NextResponse.json({ esColab: false, acceso })
  }

  // Sin acceso — verificar si está suspendida o impaga
  const central = createClient(
    process.env.CENTRAL_URL!,
    process.env.CENTRAL_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data: empData } = await central
    .from('empleados_organizacion')
    .select('org_id')
    .eq('email', verifiedEmail)
    .limit(1)

  if (empData && empData.length > 0) {
    const { data: subData } = await central
      .from('suscripciones_apps')
      .select('estado')
      .eq('org_id', empData[0].org_id)
      .eq('app_id', 'app-membresias')
      .in('estado', ['suspendido', 'impago'])
      .limit(1)
      .maybeSingle()

    if (subData?.estado) {
      return NextResponse.json({ error: 'cuenta_suspendida', estado: subData.estado }, { status: 403 })
    }
  }

  return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
}
