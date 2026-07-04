'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'
import { mensajeErrorGuardado } from '@/lib/errores'

interface Actividad {
  id: string
  nombre: string
  dias: string[]
  horario_inicio: string
  horario_fin: string
  cupo_maximo: number | null
  profesor_id: string | null
  profesores?: { nombre: string; apellido: string } | null
}

const DIAS_ORDEN = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo']
const DIAS_ABREV: Record<string, string> = {
  lunes:'Lun', martes:'Mar', miercoles:'Mié', jueves:'Jue', viernes:'Vie', sabado:'Sáb', domingo:'Dom'
}

function diasLabel(dias: string[]) {
  if (!dias?.length) return '—'
  return dias.map(d => DIAS_ABREV[d] ?? d).join(' · ')
}

export default function ActividadesPage() {
  const { localId, permisos } = useSession()
  const router = useRouter()
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [loading, setLoading] = useState(true)

  // Modal nueva actividad
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', horario_inicio: '', horario_fin: '', cupo_maximo: '', dias: [] as string[] })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!localId) return
    cargar()
  }, [localId])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabaseApp
      .from('actividades')
      .select('id, nombre, dias, horario_inicio, horario_fin, cupo_maximo, profesor_id, profesores(nombre, apellido)')
      .eq('org_id', localId)
      .order('nombre')
    setActividades((data ?? []) as unknown as Actividad[])
    setLoading(false)
  }

  const toggleDia = (d: string) => {
    setForm(f => ({
      ...f,
      dias: f.dias.includes(d) ? f.dias.filter(x => x !== d) : [...f.dias, d]
    }))
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (form.dias.length === 0) { setError('Seleccioná al menos un día'); return }
    setGuardando(true)
    setError(null)
    const payload: Record<string, any> = {
      org_id: localId,
      nombre: form.nombre.trim(),
      dias: form.dias,
      horario_inicio: form.horario_inicio || null,
      horario_fin: form.horario_fin || null,
      cupo_maximo: form.cupo_maximo ? parseInt(form.cupo_maximo) : null,
    }
    const { error: err } = await supabaseApp.from('actividades').insert(payload)
    if (err) { setError(mensajeErrorGuardado(err) || err.message); setGuardando(false); return }
    setModal(false)
    setForm({ nombre: '', horario_inicio: '', horario_fin: '', cupo_maximo: '', dias: [] })
    await cargar()
    setGuardando(false)
  }

  return (
    <RouteGuard permiso="verActividades">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Actividades</h1>
            <p className="text-gray-500 text-sm">{actividades.length} en total</p>
          </div>
          {permisos?.editarActividades && (
            <button
              onClick={() => setModal(true)}
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span> Nueva
            </button>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : actividades.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">🏃</div>
            <p>Todavía no hay actividades</p>
            {permisos?.editarActividades && (
              <button onClick={() => setModal(true)} className="mt-4 text-violet-400 text-sm hover:underline">
                Crear la primera
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {actividades.map(act => (
              <button
                key={act.id}
                onClick={() => router.push(`/actividades/${act.id}`)}
                className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-violet-700 transition text-left flex items-center gap-4"
              >
                <div className="w-11 h-11 rounded-xl bg-violet-900/50 flex items-center justify-center shrink-0">
                  <span className="text-violet-400 text-xl">🏃</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold">{act.nombre}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {diasLabel(act.dias)}
                    {act.horario_inicio && ` · ${act.horario_inicio}–${act.horario_fin}`}
                  </p>
                  {act.profesores && (
                    <p className="text-violet-400 text-xs mt-0.5">
                      Prof. {act.profesores.nombre} {act.profesores.apellido}
                    </p>
                  )}
                </div>
                {act.cupo_maximo && (
                  <div className="shrink-0 text-right">
                    <p className="text-gray-400 text-xs">Cupo</p>
                    <p className="text-white text-sm font-semibold">{act.cupo_maximo}</p>
                  </div>
                )}
                <span className="text-gray-600 text-lg shrink-0">›</span>
              </button>
            ))}
          </div>
        )}

        {/* Modal nueva actividad */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-white font-bold text-lg">Nueva actividad</h2>
                <button onClick={() => setModal(false)} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Musculación"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-2">Días *</label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_ORDEN.map(d => (
                    <button
                      key={d}
                      onClick={() => toggleDia(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize
                        ${form.dias.includes(d) ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      {DIAS_ABREV[d]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Hora inicio</label>
                  <input
                    type="time"
                    value={form.horario_inicio}
                    onChange={e => setForm(f => ({ ...f, horario_inicio: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Hora fin</label>
                  <input
                    type="time"
                    value={form.horario_fin}
                    onChange={e => setForm(f => ({ ...f, horario_fin: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Cupo máximo</label>
                <input
                  type="number"
                  value={form.cupo_maximo}
                  onChange={e => setForm(f => ({ ...f, cupo_maximo: e.target.value }))}
                  placeholder="Dejar vacío si no tiene límite"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                onClick={guardar}
                disabled={guardando}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
              >
                {guardando ? 'Guardando...' : 'Guardar actividad'}
              </button>
            </div>
          </div>
        )}

      </div>
    </RouteGuard>
  )
}
