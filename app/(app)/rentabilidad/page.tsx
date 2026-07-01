'use client'
import { useEffect, useState } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { PlanGuard } from '@/components/PlanGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface ResumenMes {
  cobros: number
  gastos: number
  liquidaciones: number
  neto: number
  cantidadCobros: number
  cantidadSociosActivos: number
}

interface CobroPorMetodo {
  metodo: string
  total: number
  cantidad: number
}

interface GastoPorCategoria {
  categoria: string
  total: number
}

function mesLabel(anio: number, mes: number) {
  return new Date(anio, mes - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

const METODO_LABEL: Record<string, string> = {
  efectivo: '💵 Efectivo',
  transferencia: '📲 Transferencia',
  debito: '💳 Débito',
  credito: '💳 Crédito',
}

const CAT_LABEL: Record<string, string> = {
  limpieza: '🧹 Limpieza',
  mantenimiento: '🔧 Mantenimiento',
  insumos: '📦 Insumos',
  servicios: '💡 Servicios',
  varios: '📋 Varios',
  otros: '💸 Otros',
}

export default function RentabilidadPage() {
  const { localId } = useSession()

  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [resumen, setResumen] = useState<ResumenMes | null>(null)
  const [porMetodo, setPorMetodo] = useState<CobroPorMetodo[]>([])
  const [porCategoria, setPorCategoria] = useState<GastoPorCategoria[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localId) return
    cargar()
  }, [localId, anio, mes])

  const cargar = async () => {
    setLoading(true)

    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
    const hasta = new Date(anio, mes, 0).toISOString().split('T')[0]

    const [{ data: cobros }, { data: gastos }, { data: sociosActivos }] = await Promise.all([
      supabaseApp.from('cobros').select('monto, metodo').eq('org_id', localId).eq('estado', 'pagado').gte('fecha_pago', desde).lte('fecha_pago', hasta),
      supabaseApp.from('gastos_caja').select('monto, categoria').eq('org_id', localId).gte('fecha', desde).lte('fecha', hasta),
      supabaseApp.from('membresias').select('id').eq('org_id', localId).in('estado', ['activa', 'proxima_vencer']),
    ])

    const totalCobros = (cobros ?? []).reduce((s, c) => s + c.monto, 0)
    const totalGastos = (gastos ?? []).reduce((s, g) => s + g.monto, 0)

    setResumen({
      cobros: totalCobros,
      gastos: totalGastos,
      liquidaciones: 0,
      neto: totalCobros - totalGastos,
      cantidadCobros: cobros?.length ?? 0,
      cantidadSociosActivos: sociosActivos?.length ?? 0,
    })

    // Por método de pago
    const metodosMap = new Map<string, { total: number; cantidad: number }>()
    ;(cobros ?? []).forEach(c => {
      const prev = metodosMap.get(c.metodo) ?? { total: 0, cantidad: 0 }
      metodosMap.set(c.metodo, { total: prev.total + c.monto, cantidad: prev.cantidad + 1 })
    })
    setPorMetodo(
      Array.from(metodosMap.entries())
        .map(([metodo, v]) => ({ metodo, ...v }))
        .sort((a, b) => b.total - a.total)
    )

    // Por categoría de gasto
    const catMap = new Map<string, number>()
    ;(gastos ?? []).forEach(g => {
      catMap.set(g.categoria, (catMap.get(g.categoria) ?? 0) + g.monto)
    })
    setPorCategoria(
      Array.from(catMap.entries())
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => b.total - a.total)
    )

    setLoading(false)
  }

  const irMesAnterior = () => {
    if (mes === 1) { setAnio(a => a - 1); setMes(12) }
    else setMes(m => m - 1)
  }
  const irMesSiguiente = () => {
    if (anio === hoy.getFullYear() && mes >= hoy.getMonth() + 1) return
    if (mes === 12) { setAnio(a => a + 1); setMes(1) }
    else setMes(m => m + 1)
  }

  const margenPct = resumen && resumen.cobros > 0
    ? Math.round((resumen.neto / resumen.cobros) * 100)
    : null

  return (
    <RouteGuard permiso="verRentabilidad">
      <PlanGuard feature="usaReportesAvanzados">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-white">Rentabilidad</h1>
        </div>

        {/* Selector de mes */}
        <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 mb-5">
          <button onClick={irMesAnterior} className="text-gray-400 hover:text-white text-xl px-2">‹</button>
          <p className="text-white font-semibold capitalize">{mesLabel(anio, mes)}</p>
          <button
            onClick={irMesSiguiente}
            disabled={anio === hoy.getFullYear() && mes >= hoy.getMonth() + 1}
            className="text-gray-400 hover:text-white disabled:opacity-30 text-xl px-2"
          >›</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : resumen && (
          <>
            {/* Resultado neto — tarjeta principal */}
            <div className={`rounded-2xl p-5 mb-4 border ${
              resumen.neto >= 0
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <p className={`text-xs uppercase tracking-wider font-medium mb-1 ${resumen.neto >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {resumen.neto >= 0 ? 'Ganancia neta' : 'Pérdida neta'}
              </p>
              <p className={`text-4xl font-black ${resumen.neto >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                ${Math.abs(resumen.neto).toLocaleString('es-AR')}
              </p>
              {margenPct !== null && (
                <p className="text-gray-400 text-sm mt-1">Margen: {margenPct}%</p>
              )}
            </div>

            {/* Ingresos vs egresos */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Ingresos</p>
                <p className="text-green-400 text-2xl font-bold">${resumen.cobros.toLocaleString('es-AR')}</p>
                <p className="text-gray-600 text-xs mt-1">{resumen.cantidadCobros} cobros</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Egresos</p>
                <p className="text-red-400 text-2xl font-bold">${resumen.gastos.toLocaleString('es-AR')}</p>
                <p className="text-gray-600 text-xs mt-1">gastos caja</p>
              </div>
            </div>

            {/* Barra visual ingresos vs egresos */}
            {resumen.cobros > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
                <p className="text-gray-400 text-xs mb-3">Distribución de ingresos</p>
                <div className="h-4 rounded-full bg-gray-800 overflow-hidden flex">
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${Math.min((resumen.gastos / resumen.cobros) * 100, 100)}%` }}
                  />
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${Math.max(((resumen.cobros - resumen.gastos) / resumen.cobros) * 100, 0)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>🔴 Egresos {resumen.cobros > 0 ? Math.round((resumen.gastos / resumen.cobros) * 100) : 0}%</span>
                  <span>🟢 Neto {margenPct ?? 0}%</span>
                </div>
              </div>
            )}

            {/* Por método de pago */}
            {porMetodo.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Ingresos por método</p>
                <div className="space-y-2">
                  {porMetodo.map(m => (
                    <div key={m.metodo} className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm">{METODO_LABEL[m.metodo] ?? m.metodo}</span>
                      <div className="text-right">
                        <span className="text-white font-semibold">${m.total.toLocaleString('es-AR')}</span>
                        <span className="text-gray-600 text-xs ml-2">({m.cantidad})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Por categoría de gasto */}
            {porCategoria.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Egresos por categoría</p>
                <div className="space-y-2">
                  {porCategoria.map(c => (
                    <div key={c.categoria} className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm">{CAT_LABEL[c.categoria] ?? c.categoria}</span>
                      <span className="text-red-400 font-semibold">-${c.total.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dato extra: socios activos */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Socios con membresía activa</p>
              <p className="text-white text-2xl font-bold">{resumen.cantidadSociosActivos}</p>
              {resumen.cobros > 0 && resumen.cantidadSociosActivos > 0 && (
                <p className="text-gray-500 text-xs mt-1">
                  Promedio cobrado: ${Math.round(resumen.cobros / resumen.cantidadCobros).toLocaleString('es-AR')} por cobro
                </p>
              )}
            </div>
          </>
        )}

      </div>
      </PlanGuard>
    </RouteGuard>
  )
}
