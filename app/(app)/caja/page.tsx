'use client'
import { useEffect, useState } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Gasto {
  id: string
  descripcion: string
  monto: number
  categoria: string
  fecha: string
}

const CATEGORIAS = [
  { key: 'limpieza', label: 'Limpieza', icon: '🧹' },
  { key: 'mantenimiento', label: 'Mantenimiento', icon: '🔧' },
  { key: 'insumos', label: 'Insumos', icon: '📦' },
  { key: 'servicios', label: 'Servicios', icon: '💡' },
  { key: 'varios', label: 'Varios', icon: '📋' },
  { key: 'otros', label: 'Otros', icon: '💸' },
]

function catIcon(cat: string) {
  return CATEGORIAS.find(c => c.key === cat)?.icon ?? '💸'
}

function formatFecha(f: string) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function diasAtras(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export default function CajaPage() {
  const { localId, permisos } = useSession()
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)
  const [diasFiltro, setDiasFiltro] = useState(30)

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ descripcion: '', monto: '', categoria: 'otros', fecha: new Date().toISOString().split('T')[0] })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!localId) return
    cargar()
  }, [localId, diasFiltro])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabaseApp
      .from('gastos_caja')
      .select('id, descripcion, monto, categoria, fecha')
      .eq('org_id', localId)
      .gte('fecha', diasAtras(diasFiltro))
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    setGastos((data ?? []) as Gasto[])
    setLoading(false)
  }

  const guardar = async () => {
    if (!form.descripcion.trim()) { setError('Ingresá una descripción'); return }
    if (!form.monto || Number(form.monto) <= 0) { setError('Ingresá un monto válido'); return }
    setGuardando(true)
    setError(null)
    const { error: e } = await supabaseApp.from('gastos_caja').insert({
      org_id: localId,
      descripcion: form.descripcion.trim(),
      monto: parseFloat(form.monto),
      categoria: form.categoria,
      fecha: form.fecha,
    })
    if (e) { setError(e.message); setGuardando(false); return }
    setModal(false)
    setForm({ descripcion: '', monto: '', categoria: 'otros', fecha: new Date().toISOString().split('T')[0] })
    await cargar()
    setGuardando(false)
  }

  const eliminar = async (id: string) => {
    await supabaseApp.from('gastos_caja').delete().eq('id', id)
    setGastos(g => g.filter(x => x.id !== id))
  }

  const total = gastos.reduce((s, g) => s + g.monto, 0)

  // Agrupar por fecha
  const porFecha = gastos.reduce((acc, g) => {
    if (!acc[g.fecha]) acc[g.fecha] = []
    acc[g.fecha].push(g)
    return acc
  }, {} as Record<string, Gasto[]>)
  const fechas = Object.keys(porFecha).sort((a, b) => b.localeCompare(a))

  return (
    <RouteGuard permiso="verCaja">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Caja chica</h1>
            <p className="text-gray-500 text-sm">Gastos del negocio</p>
          </div>
          {permisos?.verCaja && (
            <button
              onClick={() => setModal(true)}
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span> Gasto
            </button>
          )}
        </div>

        {/* Resumen */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4 flex justify-between items-center">
          <div>
            <p className="text-red-400 text-xs uppercase tracking-wider font-medium">Egresado</p>
            <p className="text-white text-2xl font-bold">${total.toLocaleString('es-AR')}</p>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDiasFiltro(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition
                  ${diasFiltro === d ? 'bg-red-600/50 text-red-200' : 'bg-gray-800 text-gray-500'}`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Por categoría */}
        {!loading && gastos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {CATEGORIAS.map(cat => {
              const subtotal = gastos.filter(g => g.categoria === cat.key).reduce((s, g) => s + g.monto, 0)
              if (subtotal === 0) return null
              return (
                <div key={cat.key} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                  <p className="text-xl">{cat.icon}</p>
                  <p className="text-white text-sm font-bold">${subtotal.toLocaleString('es-AR')}</p>
                  <p className="text-gray-500 text-xs">{cat.label}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : fechas.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p>Sin gastos registrados en este período</p>
          </div>
        ) : (
          <div className="space-y-4">
            {fechas.map(fecha => {
              const subtotal = porFecha[fecha].reduce((s, g) => s + g.monto, 0)
              return (
                <div key={fecha}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{formatFecha(fecha)}</p>
                    <p className="text-gray-500 text-xs">${subtotal.toLocaleString('es-AR')}</p>
                  </div>
                  <div className="space-y-1.5">
                    {porFecha[fecha].map(g => (
                      <div key={g.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center gap-3">
                        <span className="text-xl shrink-0">{catIcon(g.categoria)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{g.descripcion}</p>
                          <p className="text-gray-500 text-xs capitalize">
                            {CATEGORIAS.find(c => c.key === g.categoria)?.label ?? g.categoria}
                          </p>
                        </div>
                        <p className="text-red-400 font-bold shrink-0">-${g.monto.toLocaleString('es-AR')}</p>
                        {permisos?.verCaja && (
                          <button
                            onClick={() => eliminar(g.id)}
                            className="text-gray-600 hover:text-red-400 text-lg shrink-0 transition"
                          >×</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal nuevo gasto */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">Registrar gasto</h2>
                <button onClick={() => setModal(false)} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Descripción *</label>
                <input
                  autoFocus
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Detergente, foco, etc."
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input
                    type="number"
                    value={form.monto}
                    onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-7 pr-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-2">Categoría</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIAS.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setForm(f => ({ ...f, categoria: cat.key }))}
                      className={`py-2 rounded-xl text-xs font-medium transition flex flex-col items-center gap-1
                        ${form.categoria === cat.key ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      <span className="text-base">{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Fecha</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                onClick={guardar}
                disabled={guardando}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
              >
                {guardando ? 'Guardando...' : 'Registrar gasto'}
              </button>
            </div>
          </div>
        )}

      </div>
    </RouteGuard>
  )
}
