import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Rate limiting en memoria: IP+localId → [timestamps]
const rateLimitMap = new Map<string, number[]>()
const WINDOW_MS = 60_000  // 1 minuto
const MAX_PEDIDOS = 10    // 10 pedidos por minuto por mesa (más tolerante que delivery)

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const hits = (rateLimitMap.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (hits.length >= MAX_PEDIDOS) return false
  rateLimitMap.set(key, [...hits, now])
  return true
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const body = await req.json()
  const { localId, mesaId, mesaNombre, items, total } = body

  if (!localId || !mesaId || !items?.length || !total) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const key = `${ip}:${localId}:${mesaId}`
  if (!checkRateLimit(key)) {
    return NextResponse.json({ error: 'Demasiados pedidos. Esperá un momento.' }, { status: 429 })
  }

  // Verificar que el local_id existe (previene spam a localIds inventados)
  const { data: config } = await supabaseAdmin
    .from('config_local')
    .select('local_id')
    .eq('local_id', localId)
    .maybeSingle()

  if (!config) {
    return NextResponse.json({ error: 'Local no encontrado' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.from('pedidos_qr').insert({
    local_id: localId,
    mesa_id: mesaId,
    mesa_nombre: mesaNombre,
    items,
    total,
  })

  if (error) {
    return NextResponse.json({ error: 'Error al registrar el pedido' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
