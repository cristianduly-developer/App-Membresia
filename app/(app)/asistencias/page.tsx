'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { PlanGuard } from '@/components/PlanGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Asistencia {
  id: string
  socio_id: string
  actividad_id: string | null
  fecha: string
  metodo_checkin: string
  socios: { nombre: string; apellido: string; foto_url: string | null } | null
  actividades: { nombre: string } | null
}

interface SocioInactivo {
  id: string
  nombre: string
  apellido: string
  foto_url: string | null
  ultima_asistencia: string | null
  dias_inactivo: number
  membresia_estado: string
}

function formatFecha(f: string) {
  return new Date(f).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function diasAtras(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().split('T')[0]
}

export default function AsistenciasPage() {
  const { localId } = useSession()
  const router = useRouter()

  const [tab, setTab] = useState<'registro' | 'antichurn'>('registro')
  const [asistencias, setAsistencias] = useState<Asistencia[]>([])
  const [inactivos, setInactivos] = useState<SocioInactivo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingChurn, setLoadingChurn] = useState(false)
  const [diasFiltro, setDiasFiltro] = useState(7)
  const [diasAlerta, setDiasAlerta] = useState(10)

  useEffect(() => {
    if (!localId) return
    cargarAsistencias()
  }, [localId, diasFiltro])

  useEffect(() => {
    if (!localId || tab !== 'antichurn') return
    cargarInactivos()
  }, [localId, tab, diasAlerta])

  const cargarAsistencias = async () => {
    setLoading(true)
    const desde = diasAtras(diasFiltro)
    const { data } = await supabaseApp
      .from('asistencias')
      .select('*, socios(nombre, apellido, foto_url), actividades(nombre)')
      .eq('org_id', localId)
      .gte('fecha', desde)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    setAsistencias((data ?? []) as Asistencia[])
    setLoading(false)
  }

  const cargarInactivos = async () => {
    setLoadingChurn(true)

    // Socios con membresía activa
    const { data: membresias } = await supabaseApp
      .from('membresias')
      .select('socio_id, estado, socios(id, nombre, apellido, foto_url)')
      .eq('org_id', localId)
      .in('estado', ['activa', 'proxima_vencer'])

    if (!membresias?.length) { setInactivos([]); setLoadingChurn(false); return }

    const socioIds = [...new Set(membresias.map(m => m.socio_id))]

    // Última asistencia de cada socio
    const { data: ultimasAsist } = await supabaseApp
      .from('asistencias')
      .select('socio_id, fecha')
      .eq('org_id', localId)
      .in('socio_id', socioIds)
      .order('fecha', { ascending: false })

    const ultimaPorSocio = new Map<string, string>()
    ;(ultimasAsist ?? []).forEach(a => {
      if (!ultimaPorSocio.has(a.socio_id)) ultimaPorSocio.set(a.socio_id, a.fecha)
    })

    const hoy = new Date()
    const resultado: SocioInactivo[] = []

    const vistos = new Set<string>()
    membresias.forEach(m => {
      const socio = (m as any).socios
      if (!socio || vistos.has(socio.id)) return
      vistos.add(socio.id)

      const ultima = ultimaPorSocio.get(socio.id) ?? null
      const diasInactivo = ultima
        ? Math.floor((hoy.getTime() - new Date(ultima).getTime()) / 86400000)
        : 999

      if (diasInactivo >= diasAlerta) {
        resultado.push({
          id: socio.id,
          nombre: socio.nombre,
          apellido: socio.apellido,
          foto_url: socio.foto_url,
          ultima_asistencia: ultima,
          dias_inactivo: diasInactivo,
          membresia_estado: m.estado,
        })
      }
    })

    resultado.sort((a, b) => b.dias_inactivo - a.dias_inactivo)
    setInactivos(resultado)
    setLoadingChurn(false)
  }

  // Agrupar asistencias por fecha
  const porFecha = asistencias.reduce((acc, a) => {
    if (!acc[a.fecha]) acc[a.fecha] = []
    acc[a.fecha].push(a)
    return acc
  }, {} as Record<string, Asistencia[]>)

  const fechas = Object.keys(porFecha).sort((a, b) => b.localeCompare(a))

  return (
    <RouteGuard permiso="verAsistencias">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-white">Asistencias</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 rounded-xl p-1 mb-5">
          <button
            onClick={() => setTab('registro')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition
              ${tab === 'registro' ? 'bg-violet-600 text-white' : 'text-gray-400'}`}
          >
            📋 Registro
          </button>
          <button
            onClick={() => setTab('antichurn')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5
              ${tab === 'antichurn' ? 'bg-violet-600 text-white' : 'text-gray-400'}`}
          >
            🔔 Alertas
            {inactivos.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {inactivos.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB: REGISTRO */}
        {tab === 'registro' && (
          <>
            {/* Filtro días */}
            <div className="flex gap-2 mb-4">
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setDiasFiltro(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                    ${diasFiltro === d ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  Últimos {d}d
                </button>
              ))}
              <span className="ml-auto text-gray-500 text-sm self-center">
                {asistencias.length} presencias
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : fechas.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p>Sin asistencias en este período</p>
              </div>
            ) : (
              <div className="space-y-4">
                {fechas.map(fecha => (
                  <div key={fecha}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                        {formatFecha(fecha)}
                      </p>
                      <span className="text-gray-600 text-xs">({porFecha[fecha].length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {porFecha[fecha].map(a => (
                        <button
                          key={a.id}
                          onClick={() => router.push(`/socios/${a.socio_id}`)}
                          className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center gap-3 hover:border-violet-700 transition text-left"
                        >
                          <div className="w-9 h-9 rounded-full bg-violet-900 flex items-center justify-center shrink-0 overflow-hidden">
                            {a.socios?.foto_url
                              ? <img src={a.socios.foto_url} alt="" className="w-full h-full object-cover" />
                              : <span className="text-violet-300 font-bold text-sm">
                                  {a.socios?.nombre[0]}{a.socios?.apellido[0]}
                                </span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {a.socios?.apellido}, {a.socios?.nombre}
                            </p>
                            {a.actividades && (
                              <p className="text-gray-500 text-xs truncate">{a.actividades.nombre}</p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0
                            ${a.metodo_checkin === 'qr' ? 'bg-violet-900/50 text-violet-400' : 'bg-gray-800 text-gray-500'}`}>
                            {a.metodo_checkin === 'qr' ? '📱 QR' : '✍️ manual'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* TAB: ANTI-CHURN */}
        {tab === 'antichurn' && (
          <PlanGuard feature="usaAlertaDesercion"><>
            {/* Selector días inactividad */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
              <p className="text-gray-400 text-xs mb-2">Alertar si no viene hace más de:</p>
              <div className="flex gap-2">
                {[7, 10, 15, 30].map(d => (
                  <button
                    key={d}
                    onClick={() => setDiasAlerta(d)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition
                      ${diasAlerta === d ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {loadingChurn ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : inactivos.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-gray-400 font-medium">¡Sin alertas!</p>
                <p className="text-gray-600 text-sm mt-1">
                  Todos los socios activos vinieron en los últimos {diasAlerta} días
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-500 text-xs mb-3">
                  {inactivos.length} socio{inactivos.length !== 1 ? 's' : ''} con membresía activa sin venir
                </p>
                {inactivos.map(s => (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/socios/${s.id}`)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3 hover:border-violet-700 transition text-left"
                  >
                    <div className="w-11 h-11 rounded-full bg-violet-900 flex items-center justify-center shrink-0 overflow-hidden">
                      {s.foto_url
                        ? <img src={s.foto_url} alt="" className="w-full h-full object-cover" />
                        : <span className="text-violet-300 font-bold">{s.nombre[0]}{s.apellido[0]}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold">{s.apellido}, {s.nombre}</p>
                      <p className="text-gray-500 text-xs">
                        {s.ultima_asistencia
                          ? `Última vez: ${formatFecha(s.ultima_asistencia)}`
                          : 'Nunca asistió'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-lg font-bold ${
                        s.dias_inactivo > 20 ? 'text-red-400' :
                        s.dias_inactivo > 14 ? 'text-orange-400' : 'text-yellow-400'
                      }`}>
                        {s.dias_inactivo === 999 ? '∞' : s.dias_inactivo}d
                      </p>
                      <p className="text-gray-600 text-xs">inactivo</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </></PlanGuard>
        )}

      </div>
    </RouteGuard>
  )
}
