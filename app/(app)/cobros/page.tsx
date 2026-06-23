'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Cobro {
  id: string
  socio_id: string
  monto: number
  metodo: string
  estado: string
  fecha_pago: string | null
  fecha_vencimiento: string | null
  concepto: string | null
  socios: { nombre: string; apellido: string; foto_url: string | null } | null
}

type Filtro = 'todos' | 'pagado' | 'pendiente' | 'vencido'

function formatFecha(f: string | null) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const METODO_ICON: Record<string, string> = {
  efectivo: '💵', transferencia: '📲', debito: '💳', credito: '💳',
}

export default function CobrosPage() {
  const { localId, permisos } = useSession()
  const router = useRouter()
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')

  useEffect(() => {
    if (!localId) return
    cargar()
  }, [localId])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabaseApp
      .from('cobros')
      .select('*, socios(nombre, apellido, foto_url)')
      .eq('org_id', localId)
      .order('created_at', { ascending: false })
      .limit(200)
    setCobros((data ?? []) as Cobro[])
    setLoading(false)
  }

  const filtrados = filtro === 'todos' ? cobros : cobros.filter(c => c.estado === filtro)

  const conteos: Record<string, number> = {}
  cobros.forEach(c => { conteos[c.estado] = (conteos[c.estado] ?? 0) + 1 })

  const totalHoy = cobros
    .filter(c => c.estado === 'pagado' && c.fecha_pago === new Date().toISOString().split('T')[0])
    .reduce((s, c) => s + c.monto, 0)

  return (
    <RouteGuard permiso="verCobros">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Cobros</h1>
            <p className="text-gray-500 text-sm">{cobros.length} registros</p>
          </div>
          {permisos?.registrarCobros && (
            <button
              onClick={() => router.push('/cobros/nuevo')}
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span> Cobrar
            </button>
          )}
        </div>

        {/* Cobrado hoy */}
        {!loading && totalHoy > 0 && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-green-400 text-xs font-medium uppercase tracking-wider">Cobrado hoy</p>
              <p className="text-green-300 text-2xl font-bold">${totalHoy.toLocaleString('es-AR')}</p>
            </div>
            <span className="text-3xl">✅</span>
          </div>
        )}

        {/* Contadores */}
        {!loading && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Pagados', key: 'pagado', color: 'text-green-400' },
              { label: 'Pendientes', key: 'pendiente', color: 'text-yellow-400' },
              { label: 'Vencidos', key: 'vencido', color: 'text-red-400' },
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
          {(['todos','pagado','pendiente','vencido'] as Filtro[]).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${filtro === f ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No hay cobros en este estado</div>
        ) : (
          <div className="space-y-2">
            {filtrados.map(c => (
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
                <button
                  onClick={() => router.push(`/socios/${c.socio_id}`)}
                  className="w-10 h-10 rounded-full bg-violet-900 flex items-center justify-center shrink-0 overflow-hidden"
                >
                  {c.socios?.foto_url
                    ? <img src={c.socios.foto_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-violet-300 font-bold text-sm">
                        {c.socios?.nombre[0]}{c.socios?.apellido[0]}
                      </span>
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">
                    {c.socios?.apellido}, {c.socios?.nombre}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {c.concepto ?? 'Cuota'} · {formatFecha(c.fecha_pago ?? c.fecha_vencimiento)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-white font-bold">${c.monto.toLocaleString('es-AR')}</p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <span className="text-sm">{METODO_ICON[c.metodo] ?? '💰'}</span>
                    <span className={`text-xs ${
                      c.estado === 'pagado' ? 'text-green-400' :
                      c.estado === 'vencido' ? 'text-red-400' : 'text-yellow-400'
                    }`}>{c.estado}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </RouteGuard>
  )
}
