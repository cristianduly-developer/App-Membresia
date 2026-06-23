'use client'
import { useEffect, useState } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { PlanGuard } from '@/components/PlanGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Profesor {
  id: string
  nombre: string
  apellido: string
  honorario_por_clase: number | null
}

interface ItemLiquidacion {
  profesor: Profesor
  actividades: { id: string; nombre: string; clases: number }[]
  totalClases: number
  honorarioPorClase: number
  totalBruto: number
  ajuste: number
  totalFinal: number
  estado: 'pendiente' | 'liquidado'
}

function mesLabel(anio: number, mes: number) {
  return new Date(anio, mes - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

export default function LiquidacionesPage() {
  const { localId } = useSession()

  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [items, setItems] = useState<ItemLiquidacion[]>([])
  const [loading, setLoading] = useState(true)
  const [ajustes, setAjustes] = useState<Record<string, string>>({})
  const [liquidados, setLiquidados] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState<string | null>(null)

  useEffect(() => {
    if (!localId) return
    calcular()
  }, [localId, anio, mes])

  const calcular = async () => {
    setLoading(true)

    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
    const hasta = new Date(anio, mes, 0).toISOString().split('T')[0]

    const [{ data: profesores }, { data: actividades }, { data: asistencias }] = await Promise.all([
      supabaseApp.from('profesores').select('id, nombre, apellido, honorario_por_clase').eq('org_id', localId).order('apellido'),
      supabaseApp.from('actividades').select('id, nombre, profesor_id').eq('org_id', localId).not('profesor_id', 'is', null),
      supabaseApp.from('asistencias').select('actividad_id, fecha').eq('org_id', localId).gte('fecha', desde).lte('fecha', hasta),
    ])

    if (!profesores?.length) { setItems([]); setLoading(false); return }

    // Contar clases únicas por actividad (fecha única = 1 clase)
    const clasesPorActividad = new Map<string, Set<string>>()
    ;(asistencias ?? []).forEach(a => {
      if (!a.actividad_id) return
      if (!clasesPorActividad.has(a.actividad_id)) clasesPorActividad.set(a.actividad_id, new Set())
      clasesPorActividad.get(a.actividad_id)!.add(a.fecha)
    })

    // Agrupar actividades por profesor
    const actPorProfesor = new Map<string, { id: string; nombre: string; clases: number }[]>()
    ;(actividades ?? []).forEach(a => {
      if (!a.profesor_id) return
      if (!actPorProfesor.has(a.profesor_id)) actPorProfesor.set(a.profesor_id, [])
      actPorProfesor.get(a.profesor_id)!.push({
        id: a.id,
        nombre: a.nombre,
        clases: clasesPorActividad.get(a.id)?.size ?? 0,
      })
    })

    const result: ItemLiquidacion[] = (profesores as Profesor[])
      .filter(p => actPorProfesor.has(p.id))
      .map(p => {
        const acts = actPorProfesor.get(p.id) ?? []
        const totalClases = acts.reduce((s, a) => s + a.clases, 0)
        const honorarioPorClase = p.honorario_por_clase ?? 0
        const totalBruto = totalClases * honorarioPorClase
        const ajuste = parseFloat(ajustes[p.id] ?? '0') || 0
        return {
          profesor: p,
          actividades: acts,
          totalClases,
          honorarioPorClase,
          totalBruto,
          ajuste,
          totalFinal: totalBruto + ajuste,
          estado: liquidados.has(p.id) ? 'liquidado' : 'pendiente',
        }
      })

    setItems(result)
    setLoading(false)
  }

  const marcarLiquidado = async (profId: string) => {
    setGuardando(profId)
    setLiquidados(prev => new Set([...prev, profId]))
    setItems(prev => prev.map(i =>
      i.profesor.id === profId ? { ...i, estado: 'liquidado' } : i
    ))
    setGuardando(null)
  }

  const cambiarAjuste = (profId: string, val: string) => {
    setAjustes(prev => ({ ...prev, [profId]: val }))
    setItems(prev => prev.map(i => {
      if (i.profesor.id !== profId) return i
      const ajuste = parseFloat(val) || 0
      return { ...i, ajuste, totalFinal: i.totalBruto + ajuste }
    }))
  }

  const irMesAnterior = () => {
    if (mes === 1) { setAnio(a => a - 1); setMes(12) }
    else setMes(m => m - 1)
  }
  const irMesSiguiente = () => {
    if (mes === 12) { setAnio(a => a + 1); setMes(1) }
    else setMes(m => m + 1)
  }

  const totalMes = items.reduce((s, i) => s + i.totalFinal, 0)

  return (
    <RouteGuard permiso="verLiquidaciones">
    <PlanGuard feature="usaLiquidaciones">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-white">Liquidaciones</h1>
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
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">📊</div>
            <p>Sin datos de clases para este período</p>
            <p className="text-xs mt-1">Las liquidaciones se calculan en base a las asistencias registradas</p>
          </div>
        ) : (
          <>
            {/* Resumen total */}
            <div className="bg-violet-900/20 border border-violet-700/40 rounded-2xl p-4 mb-4 flex justify-between items-center">
              <div>
                <p className="text-violet-300 text-xs uppercase tracking-wider">Total a pagar</p>
                <p className="text-white text-2xl font-bold">${totalMes.toLocaleString('es-AR')}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-xs">{items.length} profesores</p>
                <p className="text-gray-500 text-xs">{items.reduce((s, i) => s + i.totalClases, 0)} clases totales</p>
              </div>
            </div>

            {/* Cards por profesor */}
            <div className="space-y-3">
              {items.map(item => (
                <div
                  key={item.profesor.id}
                  className={`bg-gray-900 border rounded-2xl p-4 transition
                    ${item.estado === 'liquidado' ? 'border-green-800/60 opacity-70' : 'border-gray-800'}`}
                >
                  {/* Encabezado */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-violet-900 flex items-center justify-center shrink-0">
                      <span className="text-violet-300 font-bold text-sm">
                        {item.profesor.nombre[0]}{item.profesor.apellido[0]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold">{item.profesor.nombre} {item.profesor.apellido}</p>
                      <p className="text-gray-500 text-xs">
                        ${item.honorarioPorClase.toLocaleString('es-AR')}/clase · {item.totalClases} clases
                      </p>
                    </div>
                    {item.estado === 'liquidado' && (
                      <span className="text-green-400 text-xs font-medium bg-green-900/30 px-2.5 py-1 rounded-full">
                        ✓ Liquidado
                      </span>
                    )}
                  </div>

                  {/* Detalle de actividades */}
                  <div className="space-y-1 mb-3">
                    {item.actividades.map(a => (
                      <div key={a.id} className="flex justify-between text-sm">
                        <span className="text-gray-400 truncate">{a.nombre}</span>
                        <span className="text-gray-300 shrink-0 ml-2">{a.clases} clases</span>
                      </div>
                    ))}
                  </div>

                  {/* Totales */}
                  <div className="border-t border-gray-800 pt-3 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-white">${item.totalBruto.toLocaleString('es-AR')}</span>
                    </div>

                    {/* Ajuste manual */}
                    {item.estado !== 'liquidado' && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-sm flex-1">Ajuste</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                          <input
                            type="number"
                            value={ajustes[item.profesor.id] ?? ''}
                            onChange={e => cambiarAjuste(item.profesor.id, e.target.value)}
                            placeholder="0"
                            className="w-28 bg-gray-800 border border-gray-700 rounded-lg pl-5 pr-2 py-1 text-white text-sm focus:outline-none focus:border-violet-500 text-right"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-white font-semibold">Total</span>
                      <span className="text-white font-bold text-lg">${item.totalFinal.toLocaleString('es-AR')}</span>
                    </div>
                  </div>

                  {/* Acción */}
                  {item.estado !== 'liquidado' && (
                    <button
                      onClick={() => marcarLiquidado(item.profesor.id)}
                      disabled={guardando === item.profesor.id}
                      className="w-full mt-3 py-2.5 bg-green-900/30 hover:bg-green-900/50 text-green-400 font-semibold rounded-xl text-sm transition disabled:opacity-50"
                    >
                      {guardando === item.profesor.id ? 'Procesando...' : '✓ Marcar como liquidado'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </PlanGuard>
    </RouteGuard>
  )
}
