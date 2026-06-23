'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Socio {
  id: string
  nombre: string
  apellido: string
  dni: string | null
  telefono: string | null
  email: string | null
  estado: string
  foto_url: string | null
  membresia_activa?: {
    tipo: string
    fecha_vencimiento: string
    estado: string
  } | null
}

function estadoColor(estado: string) {
  if (estado === 'activo') return 'bg-green-500/20 text-green-400'
  if (estado === 'suspendido') return 'bg-red-500/20 text-red-400'
  return 'bg-gray-500/20 text-gray-400'
}

function membresiaColor(estado: string) {
  if (estado === 'activa') return 'text-green-400'
  if (estado === 'proxima_vencer') return 'text-yellow-400'
  if (estado === 'vencida') return 'text-red-400'
  return 'text-gray-500'
}

function diasRestantes(fecha: string): string {
  const hoy = new Date()
  const venc = new Date(fecha)
  const diff = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `Vencida hace ${Math.abs(diff)}d`
  if (diff === 0) return 'Vence hoy'
  if (diff <= 7) return `Vence en ${diff}d`
  return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export default function SociosPage() {
  const { localId } = useSession()
  const router = useRouter()
  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo' | 'suspendido'>('todos')

  useEffect(() => {
    if (!localId) return
    cargarSocios()
  }, [localId])

  const cargarSocios = async () => {
    setLoading(true)
    const { data } = await supabaseApp
      .from('socios')
      .select(`
        id, nombre, apellido, dni, telefono, email, estado, foto_url,
        membresias(tipo, fecha_vencimiento, estado)
      `)
      .eq('org_id', localId)
      .order('apellido')

    const sociosConMembresia = (data ?? []).map((s: any) => ({
      ...s,
      membresia_activa: s.membresias?.find((m: any) => m.estado === 'activa') 
        ?? s.membresias?.find((m: any) => m.estado === 'proxima_vencer')
        ?? s.membresias?.[0] ?? null,
    }))

    setSocios(sociosConMembresia)
    setLoading(false)
  }

  const filtrados = socios.filter((s) => {
    const q = busqueda.toLowerCase()
    const coincide = !q || 
      s.nombre.toLowerCase().includes(q) || 
      s.apellido.toLowerCase().includes(q) || 
      (s.dni ?? '').includes(q)
    const estado = filtroEstado === 'todos' || s.estado === filtroEstado
    return coincide && estado
  })

  return (
    <RouteGuard permiso="verSocios">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Socios</h1>
            <p className="text-gray-500 text-sm">{socios.length} en total</p>
          </div>
          <button
            onClick={() => router.push('/socios/nuevo')}
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span> Nuevo socio
          </button>
        </div>

        {/* Búsqueda */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">🔍</span>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o DNI..."
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl pl-10 pr-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Filtro estado */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {(['todos','activo','inactivo','suspendido'] as const).map((e) => (
            <button
              key={e}
              onClick={() => setFiltroEstado(e)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize
                ${filtroEstado === e ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {e === 'todos' ? 'Todos' : e.charAt(0).toUpperCase() + e.slice(1)}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">👥</div>
            <p>{busqueda ? 'No se encontraron socios' : 'Todavía no hay socios'}</p>
            {!busqueda && (
              <button onClick={() => router.push('/socios/nuevo')} className="mt-4 text-violet-400 text-sm hover:underline">
                Agregar el primero
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((socio) => (
              <button
                key={socio.id}
                onClick={() => router.push(`/socios/${socio.id}`)}
                className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4 hover:border-violet-700 transition text-left"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-violet-900 flex items-center justify-center shrink-0 overflow-hidden">
                  {socio.foto_url
                    ? <img src={socio.foto_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-violet-300 font-bold text-lg">{socio.nombre[0]}{socio.apellido[0]}</span>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-white font-semibold truncate">{socio.apellido}, {socio.nombre}</p>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${estadoColor(socio.estado)}`}>
                      {socio.estado}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {socio.dni && <span>DNI {socio.dni}</span>}
                    {socio.membresia_activa ? (
                      <span className={membresiaColor(socio.membresia_activa.estado)}>
                        {socio.membresia_activa.tipo} · {diasRestantes(socio.membresia_activa.fecha_vencimiento)}
                      </span>
                    ) : (
                      <span className="text-red-400">Sin membresía</span>
                    )}
                  </div>
                </div>

                <span className="text-gray-600 text-lg shrink-0">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  )
}
