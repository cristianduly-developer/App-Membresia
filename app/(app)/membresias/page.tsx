'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Membresia {
  id: string
  socio_id: string
  tipo: string
  precio: number
  fecha_inicio: string
  fecha_vencimiento: string
  estado: string
  actividades_ids: string[] | null
  socios: { nombre: string; apellido: string; foto_url: string | null } | null
}

type Filtro = 'todos' | 'activa' | 'proxima_vencer' | 'vencida' | 'congelada'

function formatFecha(f: string) {
  return new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function diasRestantes(fecha: string): { texto: string; color: string } {
  const diff = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { texto: `Vencida hace ${Math.abs(diff)}d`, color: 'text-red-400' }
  if (diff === 0) return { texto: 'Vence hoy', color: 'text-yellow-400' }
  if (diff <= 7) return { texto: `Vence en ${diff}d`, color: 'text-yellow-400' }
  return { texto: `Vence ${formatFecha(fecha)}`, color: 'text-green-400' }
}

function estadoBadge(estado: string) {
  const map: Record<string, string> = {
    activa: 'bg-green-500/20 text-green-400',
    proxima_vencer: 'bg-yellow-500/20 text-yellow-400',
    vencida: 'bg-red-500/20 text-red-400',
    congelada: 'bg-blue-500/20 text-blue-400',
    cancelada: 'bg-gray-500/20 text-gray-400',
  }
  return map[estado] ?? 'bg-gray-500/20 text-gray-400'
}

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos', label: 'Todas' },
  { key: 'activa', label: 'Activas' },
  { key: 'proxima_vencer', label: 'Por vencer' },
  { key: 'vencida', label: 'Vencidas' },
  { key: 'congelada', label: 'Congeladas' },
]

export default function MembresiasPage() {
  const { localId, permisos } = useSession()
  const router = useRouter()
  const [membresias, setMembresias] = useState<Membresia[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [accionId, setAccionId] = useState<string | null>(null)

  useEffect(() => {
    if (!localId) return
    cargar()
  }, [localId])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabaseApp
      .from('membresias')
      .select('*, socios(nombre, apellido, foto_url)')
      .eq('org_id', localId)
      .order('fecha_vencimiento', { ascending: true })
    setMembresias((data ?? []) as Membresia[])
    setLoading(false)
  }

  const renovar = async (m: Membresia) => {
    setAccionId(m.id)
    const dias = m.tipo === 'trimestral' ? 90 : 30
    const nuevaFecha = new Date(
      Math.max(new Date(m.fecha_vencimiento).getTime(), Date.now())
    )
    nuevaFecha.setDate(nuevaFecha.getDate() + dias)
    await supabaseApp.from('membresias').update({
      fecha_vencimiento: nuevaFecha.toISOString().split('T')[0],
      estado: 'activa',
    }).eq('id', m.id)
    await cargar()
    setAccionId(null)
  }

  const congelar = async (m: Membresia) => {
    setAccionId(m.id)
    await supabaseApp.from('membresias').update({ estado: 'congelada' }).eq('id', m.id)
    await cargar()
    setAccionId(null)
  }

  const descongelar = async (m: Membresia) => {
    setAccionId(m.id)
    await supabaseApp.from('membresias').update({ estado: 'activa' }).eq('id', m.id)
    await cargar()
    setAccionId(null)
  }

  const filtradas = filtro === 'todos' ? membresias : membresias.filter(m => m.estado === filtro)

  const conteos: Record<string, number> = {}
  membresias.forEach(m => { conteos[m.estado] = (conteos[m.estado] ?? 0) + 1 })

  return (
    <RouteGuard permiso="verMembresias">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Membresías</h1>
            <p className="text-gray-500 text-sm">{membresias.length} en total</p>
          </div>
          {permisos?.editarMembresias && (
            <button
              onClick={() => router.push('/membresias/nueva')}
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span> Nueva
            </button>
          )}
        </div>

        {/* Resumen rápido */}
        {!loading && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Activas', key: 'activa', color: 'text-green-400' },
              { label: 'Por vencer', key: 'proxima_vencer', color: 'text-yellow-400' },
              { label: 'Vencidas', key: 'vencida', color: 'text-red-400' },
            ].map(({ label, key, color }) => (
              <button
                key={key}
                onClick={() => setFiltro(key as Filtro)}
                className={`bg-gray-900 border rounded-xl p-3 text-center transition
                  ${filtro === key ? 'border-violet-600' : 'border-gray-800 hover:border-gray-700'}`}
              >
                <p className={`text-2xl font-bold ${color}`}>{conteos[key] ?? 0}</p>
                <p className="text-gray-500 text-xs mt-0.5">{label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {FILTROS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${filtro === key ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p>No hay membresías en este estado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtradas.map(m => {
              const venc = diasRestantes(m.fecha_vencimiento)
              const cargando = accionId === m.id
              return (
                <div
                  key={m.id}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
                >
                  {/* Socio + estado */}
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      onClick={() => router.push(`/socios/${m.socio_id}`)}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="w-10 h-10 rounded-full bg-violet-900 flex items-center justify-center shrink-0 overflow-hidden">
                        {m.socios?.foto_url
                          ? <img src={m.socios.foto_url} alt="" className="w-full h-full object-cover" />
                          : <span className="text-violet-300 font-bold text-sm">
                              {m.socios?.nombre[0]}{m.socios?.apellido[0]}
                            </span>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">
                          {m.socios?.apellido}, {m.socios?.nombre}
                        </p>
                        <p className="text-gray-500 text-xs capitalize">{m.tipo}</p>
                      </div>
                    </button>
                    <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${estadoBadge(m.estado)}`}>
                      {m.estado.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Detalle */}
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-gray-500">
                      ${m.precio.toLocaleString('es-AR')}
                    </span>
                    <span className={venc.color}>{venc.texto}</span>
                  </div>

                  {/* Acciones */}
                  {permisos?.editarMembresias && (
                    <div className="flex gap-2">
                      {m.estado !== 'congelada' ? (
                        <>
                          <button
                            onClick={() => renovar(m)}
                            disabled={cargando}
                            className="flex-1 py-2 rounded-xl bg-violet-900/50 text-violet-300 text-xs font-medium hover:bg-violet-900 transition disabled:opacity-50"
                          >
                            {cargando ? '...' : '↻ Renovar'}
                          </button>
                          <button
                            onClick={() => congelar(m)}
                            disabled={cargando}
                            className="flex-1 py-2 rounded-xl bg-blue-900/30 text-blue-400 text-xs font-medium hover:bg-blue-900/50 transition disabled:opacity-50"
                          >
                            {cargando ? '...' : '❄ Congelar'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => descongelar(m)}
                          disabled={cargando}
                          className="flex-1 py-2 rounded-xl bg-green-900/30 text-green-400 text-xs font-medium hover:bg-green-900/50 transition disabled:opacity-50"
                        >
                          {cargando ? '...' : '▶ Descongelar'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </RouteGuard>
  )
}
