'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface DashboardData {
  sociosActivos: number
  sociosTotales: number
  vencenEstaSemana: number
  vencidas: number
  cobradoHoy: number
  cobrosHoy: number
  asistenciasHoy: number
  inactivosAlerta: number
}

interface Pendiente {
  tipo: 'vence_hoy' | 'vence_semana' | 'vencida' | 'inactivo'
  socio_id: string
  nombre: string
  apellido: string
  foto_url: string | null
  detalle: string
  accion: string
  accionUrl: string
}

function diasAtras(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
function diasAdelante(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export default function DashboardPage() {
  const { localId, nombreNegocio } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [loading, setLoading] = useState(true)

  const hoy = new Date().toISOString().split('T')[0]
  const horaActual = new Date().getHours()
  const saludo = horaActual < 12 ? 'Buenos días' : horaActual < 19 ? 'Buenas tardes' : 'Buenas noches'

  useEffect(() => {
    if (!localId) return
    cargar()
  }, [localId])

  const cargar = async () => {
    setLoading(true)

    const [
      { data: membresias },
      { data: cobrosHoy },
      { data: asistenciasHoy },
    ] = await Promise.all([
      supabaseApp.from('membresias').select('socio_id, estado, fecha_vencimiento, socios(id, nombre, apellido, foto_url)').eq('org_id', localId),
      supabaseApp.from('cobros').select('monto').eq('org_id', localId).eq('estado', 'pagado').eq('fecha_pago', hoy),
      supabaseApp.from('asistencias').select('id').eq('org_id', localId).eq('fecha', hoy),
    ])

    const semanaProx = diasAdelante(7)

    let sociosActivos = 0
    let vencenEstaSemana = 0
    let vencidas = 0
    const pendientesArr: Pendiente[] = []
    const sociosVistos = new Set<string>()

    ;(membresias ?? []).forEach((m: any) => {
      const socio = m.socios
      if (!socio || sociosVistos.has(socio.id)) return
      sociosVistos.add(socio.id)

      const diff = Math.ceil((new Date(m.fecha_vencimiento).getTime() - Date.now()) / 86400000)

      if (m.estado === 'activa' || m.estado === 'proxima_vencer') {
        sociosActivos++
        if (diff <= 0) {
          vencidas++
          pendientesArr.push({
            tipo: 'vencida',
            socio_id: socio.id,
            nombre: socio.nombre,
            apellido: socio.apellido,
            foto_url: socio.foto_url,
            detalle: `Membresía vencida hace ${Math.abs(diff)}d`,
            accion: 'Cobrar',
            accionUrl: `/cobros/nuevo?socio=${socio.id}`,
          })
        } else if (diff === 0) {
          vencenEstaSemana++
          pendientesArr.push({
            tipo: 'vence_hoy',
            socio_id: socio.id,
            nombre: socio.nombre,
            apellido: socio.apellido,
            foto_url: socio.foto_url,
            detalle: 'Membresía vence HOY',
            accion: 'Renovar',
            accionUrl: `/cobros/nuevo?socio=${socio.id}`,
          })
        } else if (diff <= 7) {
          vencenEstaSemana++
          pendientesArr.push({
            tipo: 'vence_semana',
            socio_id: socio.id,
            nombre: socio.nombre,
            apellido: socio.apellido,
            foto_url: socio.foto_url,
            detalle: `Vence en ${diff} días`,
            accion: 'Ver',
            accionUrl: `/socios/${socio.id}`,
          })
        }
      }
    })

    // Anti-churn: socios activos sin asistencia en 15 días
    const { data: ultimasAsist } = await supabaseApp
      .from('asistencias')
      .select('socio_id, fecha')
      .eq('org_id', localId)
      .gte('fecha', diasAtras(15))

    const asistReciente = new Set((ultimasAsist ?? []).map(a => a.socio_id))

    let inactivosAlerta = 0
    ;(membresias ?? []).forEach((m: any) => {
      const socio = m.socios
      if (!socio) return
      if ((m.estado === 'activa' || m.estado === 'proxima_vencer') && !asistReciente.has(socio.id)) {
        inactivosAlerta++
        if (pendientesArr.length < 20) {
          pendientesArr.push({
            tipo: 'inactivo',
            socio_id: socio.id,
            nombre: socio.nombre,
            apellido: socio.apellido,
            foto_url: socio.foto_url,
            detalle: 'Sin asistencia en 15+ días',
            accion: 'Ver',
            accionUrl: `/socios/${socio.id}`,
          })
        }
      }
    })

    // Ordenar: vence_hoy → vencida → vence_semana → inactivo
    const orden: Record<string, number> = { vence_hoy: 0, vencida: 1, vence_semana: 2, inactivo: 3 }
    pendientesArr.sort((a, b) => orden[a.tipo] - orden[b.tipo])

    const cobradoHoy = (cobrosHoy ?? []).reduce((s: number, c: any) => s + c.monto, 0)

    setData({
      sociosActivos,
      sociosTotales: sociosVistos.size,
      vencenEstaSemana: vencenEstaSemana,
      vencidas,
      cobradoHoy,
      cobrosHoy: cobrosHoy?.length ?? 0,
      asistenciasHoy: asistenciasHoy?.length ?? 0,
      inactivosAlerta,
    })
    setPendientes(pendientesArr)
    setLoading(false)
  }

  const tipoBadge: Record<string, { bg: string; text: string; icon: string }> = {
    vence_hoy: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: '⚡' },
    vencida: { bg: 'bg-red-500/20', text: 'text-red-400', icon: '🚫' },
    vence_semana: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: '⏰' },
    inactivo: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: '💤' },
  }

  return (
    <RouteGuard permiso="verDashboard">
      <div className="max-w-2xl mx-auto">

        {/* Saludo */}
        <div className="mb-6">
          <p className="text-gray-500 text-sm">{saludo}</p>
          <h1 className="text-2xl font-bold text-white">{nombreNegocio ?? 'Mi negocio'}</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data && (
          <>
            {/* Métricas del día */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
                <p className="text-green-400 text-2xl font-bold">${data.cobradoHoy > 0 ? (data.cobradoHoy / 1000).toFixed(1) + 'k' : '0'}</p>
                <p className="text-gray-500 text-xs mt-0.5">cobrado hoy</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
                <p className="text-violet-400 text-2xl font-bold">{data.asistenciasHoy}</p>
                <p className="text-gray-500 text-xs mt-0.5">presentes hoy</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
                <p className="text-white text-2xl font-bold">{data.sociosActivos}</p>
                <p className="text-gray-500 text-xs mt-0.5">socios activos</p>
              </div>
            </div>

            {/* Alertas resumen */}
            {(data.vencidas > 0 || data.vencenEstaSemana > 0 || data.inactivosAlerta > 0) && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {data.vencidas > 0 && (
                  <button
                    onClick={() => router.push('/membresias?filtro=vencida')}
                    className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center hover:bg-red-500/20 transition"
                  >
                    <p className="text-red-400 text-xl font-bold">{data.vencidas}</p>
                    <p className="text-red-400/70 text-xs">vencidas</p>
                  </button>
                )}
                {data.vencenEstaSemana > 0 && (
                  <button
                    onClick={() => router.push('/membresias?filtro=proxima_vencer')}
                    className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center hover:bg-yellow-500/20 transition"
                  >
                    <p className="text-yellow-400 text-xl font-bold">{data.vencenEstaSemana}</p>
                    <p className="text-yellow-400/70 text-xs">por vencer</p>
                  </button>
                )}
                {data.inactivosAlerta > 0 && (
                  <button
                    onClick={() => router.push('/asistencias')}
                    className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-3 text-center hover:bg-gray-500/20 transition"
                  >
                    <p className="text-gray-400 text-xl font-bold">{data.inactivosAlerta}</p>
                    <p className="text-gray-400/70 text-xs">inactivos</p>
                  </button>
                )}
              </div>
            )}

            {/* Accesos rápidos */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              <button
                onClick={() => router.push('/checkin')}
                className="bg-violet-600 hover:bg-violet-500 text-white rounded-2xl p-4 flex items-center gap-3 transition"
              >
                <span className="text-3xl">📱</span>
                <div className="text-left">
                  <p className="font-bold">Check-in</p>
                  <p className="text-violet-300 text-xs">Escanear QR</p>
                </div>
              </button>
              <button
                onClick={() => router.push('/cobros/nuevo')}
                className="bg-gray-800 hover:bg-gray-700 text-white rounded-2xl p-4 flex items-center gap-3 transition"
              >
                <span className="text-3xl">💰</span>
                <div className="text-left">
                  <p className="font-bold">Cobrar</p>
                  <p className="text-gray-400 text-xs">Registrar pago</p>
                </div>
              </button>
            </div>

            {/* Bandeja de pendientes */}
            {pendientes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-white font-semibold">Pendientes del día</h2>
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {pendientes.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {pendientes.map((p, i) => {
                    const badge = tipoBadge[p.tipo]
                    return (
                      <div key={`${p.socio_id}-${p.tipo}-${i}`} className="bg-gray-900 border border-gray-800 rounded-2xl p-3 flex items-center gap-3">
                        {/* Avatar */}
                        <button
                          onClick={() => router.push(`/socios/${p.socio_id}`)}
                          className="w-10 h-10 rounded-full bg-violet-900 flex items-center justify-center shrink-0 overflow-hidden"
                        >
                          {p.foto_url
                            ? <img src={p.foto_url} alt="" className="w-full h-full object-cover" />
                            : <span className="text-violet-300 font-bold text-sm">{p.nombre[0]}{p.apellido[0]}</span>
                          }
                        </button>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{p.apellido}, {p.nombre}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-sm">{badge.icon}</span>
                            <p className={`text-xs ${badge.text}`}>{p.detalle}</p>
                          </div>
                        </div>

                        {/* CTA */}
                        <button
                          onClick={() => router.push(p.accionUrl)}
                          className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${badge.bg} ${badge.text} hover:opacity-80`}
                        >
                          {p.accion}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {pendientes.length === 0 && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-gray-400 font-medium">Todo al día</p>
                <p className="text-gray-600 text-sm mt-1">Sin pendientes para hoy</p>
              </div>
            )}
          </>
        )}

      </div>
    </RouteGuard>
  )
}
