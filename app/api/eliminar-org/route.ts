import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

async function findUserByEmail(supa: SupabaseClient, email?: string) {
  const target = email?.toLowerCase()
  if (!target) return null
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return null
    const found = data.users.find((u) => u.email?.toLowerCase() === target)
    if (found) return found
    if (data.users.length < 1000) break
  }
  return null
}

export async function POST(req: NextRequest) {
  const appKey = req.headers.get('x-app-key')
  if (!process.env.ERROR_REPORT_KEY || appKey !== process.env.ERROR_REPORT_KEY) {
    return NextResponse.json({ ok: false, error: 'no_auth' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { org_id } = body
  if (!org_id) return NextResponse.json({ ok: false, error: 'org_id requerido' }, { status: 400 })

  try {
    const central = createClient(process.env.CENTRAL_URL!, process.env.CENTRAL_SERVICE_KEY!)
    const { data: org } = await central.from('organizaciones').select('email_contacto').eq('id', org_id).single()
    if (!org) return NextResponse.json({ ok: false, error: 'org no encontrada' }, { status: 404 })

    const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const user = await findUserByEmail(supa, org.email_contacto)
    if (!user) return NextResponse.json({ ok: true, msg: 'usuario no encontrado' })

    const uid = user.id

    // Las tablas de Membresías son multi-tenant por org_id (no user_id).
    // Orden: hijas antes que padres (socios/profesores) por si no hay cascade.
    await supa.from('cobros').delete().eq('org_id', org_id)
    await supa.from('asistencias').delete().eq('org_id', org_id)
    await supa.from('apto_medico').delete().eq('org_id', org_id)
    await supa.from('membresias').delete().eq('org_id', org_id)
    await supa.from('liquidaciones').delete().eq('org_id', org_id)
    await supa.from('actividades').delete().eq('org_id', org_id)
    await supa.from('gastos_caja').delete().eq('org_id', org_id)
    await supa.from('colaboradores').delete().eq('org_id', org_id)
    await supa.from('config_org').delete().eq('org_id', org_id)
    await supa.from('socios').delete().eq('org_id', org_id)
    await supa.from('profesores').delete().eq('org_id', org_id)

    await supa.auth.admin.deleteUser(uid)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[eliminar-org]', err)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
