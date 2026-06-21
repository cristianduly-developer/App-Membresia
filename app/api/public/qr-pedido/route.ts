import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { qrLimiter, checkMemRateLimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const body = await req.json()
  const { localId, mesaId, mesaNombre, items, total } = body

  if (!localId || !mesaId || !items?.length) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }
  if (items.length > 50) {
    return NextResponse.json({ error: 'Demasiados items' }, { status: 400 })
  }

  const key = `${ip}:${localId}:${mesaId}`
  if (qrLimiter) {
    const { success } = await qrLimiter.limit(key)
    if (!success) return NextResponse.json({ error: 'Demasiados pedidos. Esperá un momento.' }, { status: 429 })
  } else if (!checkMemRateLimit(key, 10)) {
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

  // Recalcular total server-side usando precios reales de BD
  const productoIds = items.map((i: { producto_id: string }) => i.producto_id)
  const { data: productosDB } = await supabaseAdmin
    .from('productos')
    .select('id, precio, nombre')
    .eq('local_id', localId)
    .in('id', productoIds)

  if (!productosDB?.length) {
    return NextResponse.json({ error: 'Productos no encontrados' }, { status: 400 })
  }

  const precioMap = Object.fromEntries(productosDB.map((p: { id: string; precio: number }) => [p.id, p.precio]))
  const totalReal = items.reduce((acc: number, i: { producto_id: string; cantidad: number }) => {
    return acc + (precioMap[i.producto_id] ?? 0) * i.cantidad
  }, 0)

  const itemsConPrecio = items.map((i: { producto_id: string; nombre: string; cantidad: number; observacion?: string }) => ({
    producto_id: i.producto_id,
    nombre: i.nombre,
    precio: precioMap[i.producto_id] ?? 0,
    cantidad: i.cantidad,
    subtotal: (precioMap[i.producto_id] ?? 0) * i.cantidad,
    observacion: i.observacion ?? null,
  }))

  const { error } = await supabaseAdmin.from('pedidos_qr').insert({
    local_id: localId,
    mesa_id: mesaId,
    mesa_nombre: mesaNombre,
    items: itemsConPrecio,
    total: totalReal,
  })

  if (error) {
    return NextResponse.json({ error: 'Error al registrar el pedido' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
