'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { PlanGuard } from '@/components/PlanGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface AptoItem {
  id: string
  socio_id: string
  fecha_emision: string | null
  fecha_vencimiento: string
  observaciones: string | null
  socios: { nombre: string; apellido: string; foto_url: string | null } | null
}

interface SocioSinApto {
  id: string
  nombre: string
  apellido: string
  foto_url: string | null
}

type Filtro = 'todos' | 'vigente' | 'proximo' | 'vencido' | 'sin_apto'

function estadoApto(fecha: string): { label: string; color: string; bg: string; dias: number } {
  const diff = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: 'Vencido', color: 'text-red-400', bg: 'bg-red-500/20', dias: diff }
  if (diff <= 30) return { label: `Vence en ${diff}d`, color: 'text-yellow-400', bg: 'bg-yellow-500/20', dias: diff }
  return { label: 'Vigente', color: 'text-green-400', bg: 'bg-green-500/20', dias: diff }
}

function formatFecha(f: string | null) {
  if (!f) return '—'
  return new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function AptoMedicoPage() {
  const { localId, permisos } = useSession()
  const router = useRouter()

  const [aptos, setAptos] = useState<AptoItem[]>([])
  const [sinApto, setSinApto] = useState<SocioSinApto[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')

  // Modal carga/edición
  const [modal, setModal] = useState(false)
  const [socioModal, setSocioModal] = useState<{ id: string; nombre: string } | null>(null)
  const [form, setForm] = useState({ fecha_emision: '', fecha_vencimiento: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [sociosBusqueda, setSociosBusqueda] = useState<SocioSinApto[]>([])

  useEffect(() => {
    if (!localId) return
    cargar()
  }, [localId])

  const cargar = async () => {
    setLoading(true)
    const [{ data: aptosData }, { data: sociosActivos }] = await Promise.all([
      supabaseApp.from('apto_medico').select('*, socios(nombre, apellido, foto_url)').eq('org_id', localId).order('fecha_vencimiento'),
      supabaseApp.from('socios').select('id, nombre, apellido, foto_url').eq('org_id', localId).eq('estado', 'activo').order('apellido'),
    ])

    setAptos((aptosData ?? []) as AptoItem[])

    const conApto = new Set((aptosData ?? []).map((a: any) => a.socio_id))
    setSinApto(((sociosActivos ?? []) as SocioSinApto[]).filter(s => !conApto.has(s.id)))
    setLoading(false)
  }

  const buscarSocio = async (q: string) => {
    setBusquedaSocio(q)
    if (!q.trim()) { setSociosBusqueda([]); return }
    const { data } = await supabaseApp
      .from('socios').select('id, nombre, apellido, foto_url')
      .eq('org_id', localId).eq('estado', 'activo')
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%`).limit(8)
    setSociosBusqueda((data ?? []) as SocioSinApto[])
  }

  const abrirModal = (socio: { id: string; nombre: string; apellido: string }, aptoExistente?: AptoItem) => {
    setSocioModal({ id: socio.id, nombre: `${socio.nombre} ${socio.apellido}` })
    setForm({
      fecha_emision: aptoExistente?.fecha_emision ?? '',
      fecha_vencimiento: aptoExistente?.fecha_vencimiento ?? '',
      observaciones: aptoExistente?.observaciones ?? '',
    })
    setBusquedaSocio('')
    setSociosBusqueda([])
    setModal(true)
  }

  const guardar = async () => {
    if (!socioModal || !form.fecha_vencimiento) return
    setGuardando(true)
    await supabaseApp.from('apto_medico').upsert({
      org_id: localId,
      socio_id: socioModal.id,
      fecha_emision: form.fecha_emision || null,
      fecha_vencimiento: form.fecha_vencimiento,
      observaciones: form.observaciones || null,
    }, { onConflict: 'org_id,socio_id' })
    setModal(false)
    await cargar()
    setGuardando(false)
  }

  const filtrados = aptos.filter(a => {
    if (filtro === 'todos') return true
    if (filtro === 'sin_apto') return false
    const { dias } = estadoApto(a.fecha_vencimiento)
    if (filtro === 'vencido') return dias < 0
    if (filtro === 'proximo') return dias >= 0 && dias <= 30
    if (filtro === 'vigente') return dias > 30
    return true
  })

  const contVencidos = aptos.filter(a => estadoApto(a.fecha_vencimiento).dias < 0).length
  const contProximos = aptos.filter(a => { const d = estadoApto(a.fecha_vencimiento).dias; return d >= 0 && d <= 30 }).length

  return (
    <RouteGuard permiso="verSocios">
    <PlanGuard feature="usaAptoMedico">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Apto médico</h1>
            <p className="text-gray-500 text-sm">{aptos.length} registrados · {sinApto.length} sin apto</p>
          </div>
          <button
            onClick={() => { setSocioModal(null); setForm({ fecha_emision: '', fecha_vencimiento: '', observaciones: '' }); setModal(true) }}
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span> Cargar
          </button>
        </div>

        {/* Resumen semáforo */}
        {!loading && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Vencidos', val: contVencidos, color: 'text-red-400', filtroKey: 'vencido' as Filtro },
              { label: 'Por vencer', val: contProximos, color: 'text-yellow-400', filtroKey: 'proximo' as Filtro },
              { label: 'Sin apto', val: sinApto.length, color: 'text-gray-400', filtroKey: 'sin_apto' as Filtro },
            ].map(({ label, val, color, filtroKey }) => (
              <button
                key={label}
                onClick={() => setFiltro(filtroKey)}
                className={`bg-gray-900 border rounded-xl p-3 text-center transition ${filtro === filtroKey ? 'border-violet-600' : 'border-gray-800'}`}
              >
                <p className={`text-2xl font-bold ${color}`}>{val}</p>
                <p className="text-gray-500 text-xs mt-0.5">{label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {([
            { key: 'todos', label: 'Todos' },
            { key: 'vigente', label: 'Vigentes' },
            { key: 'proximo', label: 'Por vencer' },
            { key: 'vencido', label: 'Vencidos' },
            { key: 'sin_apto', label: 'Sin apto' },
          ] as { key: Filtro; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setFiltro(key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${filtro === key ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {/* Socios con apto */}
            {filtro !== 'sin_apto' && filtrados.map(a => {
              const estado = estadoApto(a.fecha_vencimiento)
              return (
                <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
                  <button onClick={() => router.push(`/socios/${a.socio_id}`)}
                    className="w-10 h-10 rounded-full bg-violet-900 flex items-center justify-center shrink-0 overflow-hidden">
                    {a.socios?.foto_url
                      ? <img src={a.socios.foto_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-violet-300 font-bold text-sm">{a.socios?.nombre[0]}{a.socios?.apellido[0]}</span>
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{a.socios?.apellido}, {a.socios?.nombre}</p>
                    <p className="text-gray-500 text-xs">Vence: {formatFecha(a.fecha_vencimiento)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${estado.bg} ${estado.color}`}>
                      {estado.label}
                    </span>
                    <button onClick={() => abrirModal(a.socios as any, a)}
                      className="text-gray-500 hover:text-violet-400 text-xs transition">✏️</button>
                  </div>
                </div>
              )
            })}

            {/* Socios sin apto */}
            {filtro === 'sin_apto' && sinApto.map(s => (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-900 flex items-center justify-center shrink-0">
                  <span className="text-violet-300 font-bold text-sm">{s.nombre[0]}{s.apellido[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{s.apellido}, {s.nombre}</p>
                  <p className="text-gray-500 text-xs">Sin apto registrado</p>
                </div>
                <button onClick={() => abrirModal(s)}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-violet-900/40 text-violet-300 hover:bg-violet-900/70 transition">
                  Cargar
                </button>
              </div>
            ))}

            {filtrados.length === 0 && filtro !== 'sin_apto' && (
              <div className="text-center py-16 text-gray-500">Sin registros en este estado</div>
            )}
          </div>
        )}

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">
                  {socioModal ? socioModal.nombre : 'Cargar apto médico'}
                </h2>
                <button onClick={() => setModal(false)} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
              </div>

              {/* Selector de socio si no viene pre-cargado */}
              {!socioModal && (
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Socio</label>
                  <input
                    autoFocus
                    value={busquedaSocio}
                    onChange={e => buscarSocio(e.target.value)}
                    placeholder="Buscar socio..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
                  />
                  {sociosBusqueda.length > 0 && (
                    <div className="mt-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                      {sociosBusqueda.map(s => (
                        <button key={s.id} onClick={() => { setSocioModal({ id: s.id, nombre: `${s.nombre} ${s.apellido}` }); setSociosBusqueda([]) }}
                          className="w-full px-4 py-2.5 text-left text-white text-sm hover:bg-gray-800 transition">
                          {s.apellido}, {s.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Fecha emisión</label>
                  <input type="date" value={form.fecha_emision}
                    onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Vencimiento *</label>
                  <input type="date" value={form.fecha_vencimiento}
                    onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500" />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Observaciones</label>
                <textarea value={form.observaciones} rows={2}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 resize-none" />
              </div>

              <button onClick={guardar} disabled={guardando || !socioModal || !form.fecha_vencimiento}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
                {guardando ? 'Guardando...' : 'Guardar apto'}
              </button>
            </div>
          </div>
        )}

      </div>
    </PlanGuard>
    </RouteGuard>
  )
}
