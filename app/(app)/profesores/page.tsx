'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { PlanGuard } from '@/components/PlanGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Profesor {
  id: string
  nombre: string
  apellido: string
  telefono: string | null
  email: string | null
  honorario_por_clase: number | null
}

interface ActividadProf {
  id: string
  nombre: string
  dias: string[]
  horario_inicio: string | null
}

const DIAS_ABREV: Record<string, string> = {
  lunes:'L', martes:'M', miercoles:'X', jueves:'J', viernes:'V', sabado:'S', domingo:'D'
}

export default function ProfesoresPage() {
  const { localId, permisos } = useSession()
  const router = useRouter()
  const [profesores, setProfesores] = useState<Profesor[]>([])
  const [loading, setLoading] = useState(true)

  // Modal
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', email: '', honorario_por_clase: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Panel actividades del profesor
  const [profSelec, setProfSelec] = useState<Profesor | null>(null)
  const [actividades, setActividades] = useState<ActividadProf[]>([])

  useEffect(() => {
    if (!localId) return
    cargar()
  }, [localId])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabaseApp
      .from('profesores')
      .select('*')
      .eq('org_id', localId)
      .order('apellido')
    setProfesores((data ?? []) as Profesor[])
    setLoading(false)
  }

  const abrirNuevo = () => {
    setEditandoId(null)
    setForm({ nombre: '', apellido: '', telefono: '', email: '', honorario_por_clase: '' })
    setError(null)
    setModal(true)
  }

  const abrirEditar = (p: Profesor) => {
    setEditandoId(p.id)
    setForm({
      nombre: p.nombre,
      apellido: p.apellido,
      telefono: p.telefono ?? '',
      email: p.email ?? '',
      honorario_por_clase: p.honorario_por_clase?.toString() ?? '',
    })
    setError(null)
    setModal(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) { setError('Nombre y apellido son obligatorios'); return }
    setGuardando(true)
    setError(null)
    const payload: Record<string, any> = {
      org_id: localId,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      telefono: form.telefono || null,
      email: form.email || null,
      honorario_por_clase: form.honorario_por_clase ? parseFloat(form.honorario_por_clase) : null,
    }
    if (editandoId) {
      await supabaseApp.from('profesores').update(payload).eq('id', editandoId)
    } else {
      const { error: e } = await supabaseApp.from('profesores').insert(payload)
      if (e) { setError(e.message); setGuardando(false); return }
    }
    setModal(false)
    await cargar()
    setGuardando(false)
  }

  const verActividades = async (p: Profesor) => {
    setProfSelec(p)
    const { data } = await supabaseApp
      .from('actividades')
      .select('id, nombre, dias, horario_inicio')
      .eq('org_id', localId)
      .eq('profesor_id', p.id)
      .order('nombre')
    setActividades((data ?? []) as ActividadProf[])
  }

  return (
    <RouteGuard permiso="verProfesores">
    <PlanGuard feature="usaProfesores">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Profesores</h1>
            <p className="text-gray-500 text-sm">{profesores.length} en total</p>
          </div>
          {permisos?.editarProfesores && (
            <button
              onClick={abrirNuevo}
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span> Nuevo
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : profesores.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">👨‍🏫</div>
            <p>Todavía no hay profesores</p>
          </div>
        ) : (
          <div className="space-y-2">
            {profesores.map(p => (
              <div
                key={p.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-violet-900 flex items-center justify-center shrink-0">
                    <span className="text-violet-300 font-bold">{p.nombre[0]}{p.apellido[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold">{p.nombre} {p.apellido}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                      {p.telefono && <span>📞 {p.telefono}</span>}
                      {p.honorario_por_clase && (
                        <span className="text-violet-400">${p.honorario_por_clase.toLocaleString('es-AR')}/clase</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => verActividades(p)}
                      className="text-gray-400 hover:text-white text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
                    >
                      Actividades
                    </button>
                    {permisos?.editarProfesores && (
                      <button
                        onClick={() => abrirEditar(p)}
                        className="text-violet-400 hover:text-white text-xs px-2.5 py-1.5 rounded-lg bg-violet-900/30 hover:bg-violet-900/60 transition"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal nuevo/editar */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">{editandoId ? 'Editar profesor' : 'Nuevo profesor'}</h2>
                <button onClick={() => setModal(false)} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Nombre *</label>
                  <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Apellido *</label>
                  <input value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500" />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Teléfono</label>
                <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                  placeholder="223 555 1234" type="tel"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500" />
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  type="email"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500" />
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Honorario por clase ($)</label>
                <input value={form.honorario_por_clase} onChange={e => setForm(f => ({ ...f, honorario_por_clase: e.target.value }))}
                  type="number" placeholder="Ej: 5000"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500" />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button onClick={guardar} disabled={guardando}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {/* Panel actividades del profesor */}
        {profSelec && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold">
                  {profSelec.nombre} {profSelec.apellido}
                </h2>
                <button onClick={() => setProfSelec(null)} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
              </div>
              <p className="text-gray-400 text-xs mb-3 uppercase tracking-wider">Actividades asignadas</p>
              {actividades.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">Sin actividades asignadas</p>
              ) : (
                <div className="space-y-2">
                  {actividades.map(a => (
                    <div key={a.id} className="bg-gray-900 rounded-xl p-3 flex items-center gap-3">
                      <span className="text-violet-400 text-lg">🏃</span>
                      <div>
                        <p className="text-white text-sm font-medium">{a.nombre}</p>
                        <p className="text-gray-500 text-xs">
                          {a.dias?.map(d => DIAS_ABREV[d] ?? d).join('·')}
                          {a.horario_inicio && ` · ${a.horario_inicio}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setProfSelec(null); router.push('/liquidaciones') }}
                className="w-full mt-4 py-2.5 bg-violet-900/40 text-violet-300 rounded-xl text-sm font-medium"
              >
                Ver liquidación →
              </button>
            </div>
          </div>
        )}

      </div>
    </PlanGuard>
    </RouteGuard>
  )
}
