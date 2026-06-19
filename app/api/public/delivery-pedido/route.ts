import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Rate limiting en memoria: localId+IP → [timestamps]
const rateLimitMap = new Map<string, number[]>()
const WINDOW_MS = 60_000  // 1 minuto
const MAX_PEDIDOS = 5     // máximo 5 pedidos por minuto por IP+local

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
  const { localId, cliente, carrito, total, metodoPago, retiraEnLocal } = body

  if (!localId || !cliente?.nombre || !cliente?.tel || !carrito?.length) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const key = `${ip}:${localId}`
  if (!checkRateLimit(key)) {
    return NextResponse.json({ error: 'Demasiados pedidos. Esperá un momento.' }, { status: 429 })
  }

  const { data: pedido, error } = await supabaseAdmin
    .from('pedidos_delivery')
    .insert({
      local_id: localId,
      cliente_nombre: cliente.nombre,
      cliente_tel: cliente.tel,
      cliente_dir: retiraEnLocal ? 'Retira en el local' : cliente.dir ?? '',
      observaciones: cliente.obs || null,
      total,
      metodo_pago: metodoPago ?? 'efectivo',
      estado: 'recibido',
      origen: 'link',
    })
    .select()
    .single()

  if (error || !pedido) {
    return NextResponse.json({ error: 'Error al registrar el pedido' }, { status: 500 })
  }

  await supabaseAdmin.from('items_pedido_delivery').insert(
    carrito.map((i: { producto_id: string; nombre: string; precio: number; cantidad: number; subtotal: number; observacion?: string | null }) => ({
      pedido_delivery_id: pedido.id,
      producto_id: i.producto_id,
      nombre: i.nombre,
      precio_unitario: i.precio,
      cantidad: i.cantidad,
      subtotal: i.subtotal,
      observacion: i.observacion ?? null,
    }))
  )

  return NextResponse.json({ ok: true, pedidoId: pedido.id })
}
