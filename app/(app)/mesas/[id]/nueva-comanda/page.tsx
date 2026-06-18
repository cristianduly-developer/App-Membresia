'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Categoria { id: string; nombre: string }
interface Producto { id: string; nombre: string; precio: number; categoria_id: string | null; agotado: boolean }
interface CartItem { productoId: string; nombre: string; precio: number; cantidad: number; observacion: string }

export default function NuevaComandaPage() {
  const { localId } = useSession()
  const router = useRouter()
  const params = useParams()
  const mesaId = params.id as string

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [mesaNombre, setMesaNombre] = useState('')
  const [comandaExistente, setComandaExistente] = useState<{ id: string; tanda_actual: number } | null>(null)
  const [tabActivo, setTabActivo] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [modalObs, setModalObs] = useState<CartItem | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!mesaId || !localId) return
    Promise.all([
      supabaseApp.from('mesas').select('nombre').eq('id', mesaId).single(),
      supabaseApp.from('categorias').select('*').eq('local_id', localId).eq('activo', true).order('nombre'),
      supabaseApp.from('productos').select('*').eq('local_id', localId).eq('activo', true).order('nombre'),
      supabaseApp.from('comandas').select('id, tanda_actual').eq('mesa_id', mesaId).eq('estado', 'abierta').maybeSingle(),
    ]).then(([{ data: m }, { data: cats }, { data: prods }, { data: cmd }]) => {
      setMesaNombre(m?.nombre ?? '')
      setCategorias(cats ?? [])
      setProductos(prods ?? [])
      setComandaExistente(cmd)
      setLoading(false)
    })
  }, [mesaId, localId])

  const productosFiltrados = useMemo(() => {
    let list = productos.filter((p) => !p.agotado)
    if (tabActivo !== 'todos') list = list.filter((p) => p.categoria_id === tabActivo)
    if (busqueda) list = list.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    return list
  }, [productos, tabActivo, busqueda])

  const agregarAlCart = (prod: Producto) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productoId === prod.id && !i.observacion)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + 1 }
        return next
      }
      return [...prev, { productoId: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: 1, observacion: '' }]
    })
  }

  const cambiarCantidad = (idx: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev]
      const nueva = next[idx].cantidad + delta
      if (nueva <= 0) return prev.filter((_, i) => i !== idx)
      next[idx] = { ...next[idx], cantidad: nueva }
      return next
    })
  }

  const guardarObservacion = (obs: string) => {
    if (!modalObs) return
    const idx = cart.indexOf(modalObs)
    if (idx < 0) return
    setCart((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], observacion: obs }
      return next
    })
    setModalObs(null)
  }

  const total = cart.reduce((s, i) => s + i.precio * i.cantidad, 0)

  const confirmarPedido = async () => {
    if (cart.length === 0) return
    setGuardando(true)

    let comandaId = comandaExistente?.id
    let tanda = (comandaExistente?.tanda_actual ?? 0) + 1

    if (!comandaId) {
      // Nueva comanda
      const { data: nuevaComanda } = await supabaseApp
        .from('comandas')
        .insert({ local_id: localId, mesa_id: mesaId, tanda_actual: 1, total: 0 })
        .select('id')
        .single()
      comandaId = nuevaComanda?.id
      tanda = 1
      // Marcar mesa como ocupada
      await supabaseApp.from('mesas').update({ estado: 'ocupada' }).eq('id', mesaId)
    } else {
      // Actualizar tanda
      await supabaseApp.from('comandas').update({ tanda_actual: tanda }).eq('id', comandaId)
    }

    if (!comandaId) { setGuardando(false); return }

    // Insertar items
    const itemsPayload = cart.map((i) => ({
      comanda_id: comandaId,
      producto_id: i.productoId,
      nombre: i.nombre,
      precio: i.precio,
      cantidad: i.cantidad,
      subtotal: i.precio * i.cantidad,
      observacion: i.observacion || null,
      tanda,
      estado: 'pendiente',
    }))

    await supabaseApp.from('items_comanda').insert(itemsPayload)

    // Recalcular total comanda
    const { data: todosItems } = await supabaseApp
      .from('items_comanda')
      .select('subtotal')
      .eq('comanda_id', comandaId)

    const nuevoTotal = (todosItems ?? []).reduce((s, i) => s + Number(i.subtotal), 0)
    await supabaseApp.from('comandas').update({ total: nuevoTotal }).eq('id', comandaId)

    setGuardando(false)
    router.push(`/mesas/${mesaId}`)
  }

  return (
    <RouteGuard permiso="crearComandas">
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 flex-shrink-0">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition">← Volver</button>
          <div>
            <h1 className="text-xl font-bold text-white">
              {comandaExistente ? 'Agregar pedido' : 'Nueva comanda'}
            </h1>
            <p className="text-xs text-gray-500">{mesaNombre}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex gap-4 flex-1 min-h-0">
            {/* Productos */}
            <div className="flex-1 flex flex-col min-h-0">
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar..."
                className="mb-3 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500 flex-shrink-0"
              />

              {/* Tabs categorias */}
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1 flex-shrink-0 scrollbar-hide">
                <button
                  onClick={() => setTabActivo('todos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition
                    ${tabActivo === 'todos' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  Todos
                </button>
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setTabActivo(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition
                      ${tabActivo === c.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>

              {/* Grid productos */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-4">
                  {productosFiltrados.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => agregarAlCart(p)}
                      className="bg-gray-900 border border-gray-800 hover:border-violet-600 rounded-xl p-3 text-left transition hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <p className="text-sm font-medium text-white leading-snug">{p.nombre}</p>
                      <p className="text-sm font-bold text-violet-400 mt-1">${p.precio.toLocaleString()}</p>
                    </button>
                  ))}
                  {productosFiltrados.length === 0 && (
                    <p className="col-span-full text-gray-600 text-sm text-center py-8">Sin productos</p>
                  )}
                </div>
              </div>
            </div>

            {/* Cart */}
            <div className="w-72 flex flex-col flex-shrink-0 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
                <h2 className="font-bold text-white text-sm">Pedido</h2>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-8">Tocá un producto para agregarlo</p>
                ) : (
                  cart.map((item, idx) => (
                    <div key={idx} className="bg-gray-800 rounded-xl px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white flex-1 truncate">{item.nombre}</span>
                        <span className="text-sm font-bold text-white flex-shrink-0">
                          ${(item.precio * item.cantidad).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => cambiarCantidad(idx, -1)} className="w-6 h-6 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm flex items-center justify-center transition">−</button>
                          <span className="text-sm text-white w-4 text-center">{item.cantidad}</span>
                          <button onClick={() => cambiarCantidad(idx, 1)} className="w-6 h-6 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm flex items-center justify-center transition">+</button>
                        </div>
                        <button onClick={() => setModalObs(item)} className="text-xs text-gray-500 hover:text-gray-300 transition">
                          {item.observacion ? `"${item.observacion.slice(0, 12)}..."` : '+ obs.'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-gray-800 flex-shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Total tanda</span>
                  <span className="text-white font-bold">${total.toLocaleString()}</span>
                </div>
                <button
                  onClick={confirmarPedido}
                  disabled={cart.length === 0 || guardando}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition"
                >
                  {guardando ? 'Enviando...' : 'Confirmar pedido'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal observacion */}
      {modalObs && (
        <ObservacionModal
          inicial={modalObs.observacion}
          nombre={modalObs.nombre}
          onClose={() => setModalObs(null)}
          onGuardar={guardarObservacion}
        />
      )}
    </RouteGuard>
  )
}

function ObservacionModal({ inicial, nombre, onClose, onGuardar }: { inicial: string; nombre: string; onClose: () => void; onGuardar: (v: string) => void }) {
  const [val, setVal] = useState(inicial)
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-lg font-bold text-white mb-1">Observación</h3>
        <p className="text-sm text-gray-400 mb-4">{nombre}</p>
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Ej: sin cebolla, término medio, alergia..."
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500 resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 bg-gray-800 text-gray-300 font-semibold rounded-xl py-3 text-sm hover:bg-gray-700 transition">Cancelar</button>
          <button onClick={() => onGuardar(val)} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl py-3 text-sm transition">Guardar</button>
        </div>
      </div>
    </div>
  )
}
