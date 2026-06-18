'use client'
import { useEffect, useState } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface VentaDia {
  fecha: string
  total: number
  cantidad: number
  efectivo: number
  transferencia: number
  debito: number
  credito: number
}

interface ProductoTop {
  nombre: string
  cantidad: number
  total: number
}

const PERIODOS = [
  { label: 'Hoy',        dias: 0 },
  { label: '7 días',     dias: 7 },
  { label: '30 días',    dias: 30 },
  { label: '3 meses',    dias: 90 },
] as const

export default function ReportesPage() {
  const { localId } = useSession()
  const [periodo, setPeriodo] = useState(7)
  const [loading, setLoading] = useState(true)
  const [ventasPorDia, setVentasPorDia] = useState<VentaDia[]>([])
  const [productosTop, setProductosTop] = useState<ProductoTop[]>([])
  const [resumen, setResumen] = useState({
    totalVentas: 0,
    cantVentas: 0,
    ticketPromedio: 0,
    efectivo: 0,
    transferencia: 0,
    debito: 0,
    credito: 0,
  })

  useEffect(() => { if (localId) cargar() }, [localId, periodo])

  const cargar = async () => {
    setLoading(true)
    const desde = new Date()
    if (periodo === 0) {
      desde.setHours(0, 0, 0, 0)
    } else {
      desde.setDate(desde.getDate() - periodo)
      desde.setHours(0, 0, 0, 0)
    }

    const [{ data: ventas }, { data: items }] = await Promise.all([
      supabaseApp
        .from('ventas')
        .select('total, metodo_pago, created_at')
        .eq('local_id', localId)
        .eq('estado', 'completada')
        .gte('created_at', desde.toISOString())
        .order('created_at'),
      supabaseApp
        .from('items_venta')
        .select('nombre, cantidad, subtotal, ventas!inner(local_id, created_at, estado)')
        .eq('ventas.local_id', localId)
        .eq('ventas.estado', 'completada')
        .gte('ventas.created_at', desde.toISOString()),
    ])

    const vs = ventas ?? []

    // Resumen global
    const totalVentas = vs.reduce((s, v) => s + Number(v.total), 0)
    const cantVentas = vs.length
    setResumen({
      totalVentas,
      cantVentas,
      ticketPromedio: cantVentas > 0 ? Math.round(totalVentas / cantVentas) : 0,
      efectivo:       vs.filter((v) => v.metodo_pago === 'efectivo').reduce((s, v) => s + Number(v.total), 0),
      transferencia:  vs.filter((v) => v.metodo_pago === 'transferencia').reduce((s, v) => s + Number(v.total), 0),
      debito:         vs.filter((v) => v.metodo_pago === 'debito').reduce((s, v) => s + Number(v.total), 0),
      credito:        vs.filter((v) => v.metodo_pago === 'credito').reduce((s, v) => s + Number(v.total), 0),
    })

    // Ventas por día
    const porDia: Record<string, VentaDia> = {}
    vs.forEach((v) => {
      const fecha = new Date(v.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
      if (!porDia[fecha]) porDia[fecha] = { fecha, total: 0, cantidad: 0, efectivo: 0, transferencia: 0, debito: 0, credito: 0 }
      porDia[fecha].total += Number(v.total)
      porDia[fecha].cantidad += 1
      porDia[fecha][v.metodo_pago as 'efectivo' | 'transferencia' | 'debito' | 'credito'] += Number(v.total)
    })
    setVentasPorDia(Object.values(porDia).slice(-14))

    // Productos más vendidos (de items_venta)
    const prodMap: Record<string, { cantidad: number; total: number }> = {}
    ;(items ?? []).forEach((i: any) => {
      if (!prodMap[i.nombre]) prodMap[i.nombre] = { cantidad: 0, total: 0 }
      prodMap[i.nombre].cantidad += Number(i.cantidad)
      prodMap[i.nombre].total += Number(i.subtotal)
    })
    const top = Object.entries(prodMap)
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)
    setProductosTop(top)

    setLoading(false)
  }

  const maxVenta = Math.max(...ventasPorDia.map((d) => d.total), 1)

  return (
    <RouteGuard permiso="verReportes">
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Reportes</h1>
          <div className="flex gap-2">
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                onClick={() => setPeriodo(p.dias)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition
                  ${periodo === p.dias ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1 bg-violet-950/50 border border-violet-800 rounded-2xl p-4">
                <p className="text-xs text-gray-400 mb-1">Total ventas</p>
                <p className="text-2xl font-bold text-white">${resumen.totalVentas.toLocaleString()}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-400 mb-1">Ventas</p>
                <p className="text-2xl font-bold text-white">{resumen.cantVentas}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-400 mb-1">Ticket promedio</p>
                <p className="text-2xl font-bold text-white">${resumen.ticketPromedio.toLocaleString()}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-400 mb-1">Efectivo</p>
                <p className="text-2xl font-bold text-green-400">${resumen.efectivo.toLocaleString()}</p>
              </div>
            </div>

            {/* Métodos de pago */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-semibold text-white mb-4">Por método de pago</h2>
              <div className="space-y-3">
                {[
                  { label: 'Efectivo',       valor: resumen.efectivo,      color: 'bg-green-500' },
                  { label: 'Transferencia',  valor: resumen.transferencia,  color: 'bg-blue-500' },
                  { label: 'Débito',         valor: resumen.debito,         color: 'bg-violet-500' },
                  { label: 'Crédito',        valor: resumen.credito,        color: 'bg-amber-500' },
                ].map(({ label, valor, color }) => {
                  const pct = resumen.totalVentas > 0 ? Math.round((valor / resumen.totalVentas) * 100) : 0
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-300">{label}</span>
                        <span className="text-sm font-semibold text-white">${valor.toLocaleString()} <span className="text-gray-500 font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Gráfico de barras por día */}
            {ventasPorDia.length > 1 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h2 className="font-semibold text-white mb-5">Ventas por día</h2>
                <div className="flex items-end gap-1.5 h-32">
                  {ventasPorDia.map((d) => (
                    <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1 group">
                      <div
                        className="w-full bg-violet-600 hover:bg-violet-500 rounded-t-lg transition-all relative"
                        style={{ height: `${Math.max((d.total / maxVenta) * 100, 4)}%` }}
                      >
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                          ${d.total.toLocaleString()}
                        </div>
                      </div>
                      <span className="text-xs text-gray-600">{d.fecha}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Productos más vendidos */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h2 className="font-semibold text-white">Productos más vendidos</h2>
              </div>
              {productosTop.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-10">Sin datos de productos para este período</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Unidades</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {productosTop.map((p, i) => (
                      <tr key={p.nombre} className="hover:bg-gray-800/30 transition">
                        <td className="px-5 py-3 text-sm text-white flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-5">{i + 1}</span>
                          {p.nombre}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-300 text-right">{p.cantidad}</td>
                        <td className="px-5 py-3 text-sm font-semibold text-white text-right">${p.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </RouteGuard>
  )
}
