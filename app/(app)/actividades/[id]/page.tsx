'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Actividad {
  id: string
  nombre: string
  dias: string[]
  horario_inicio: string | null
  horario_fin: string | null
  cupo_maximo: number | null
  profesor_id: string | null
  profesores?: { id: string; nombre: string; apellido: string } | null
}

interface Socio {
  id: string
  nombre: string
  apellido: string
  estado: string
  foto_url: string | null
}

const DIAS_ABREV: Record<string, string> = {
  lunes:'Lunes', martes:'Martes', miercoles:'Miércoles', jueves:'Jueves',
  viernes:'Viernes', sabado:'Sábado', domingo:'Domingo'
}

export default function FichaActividadPage() {
  const { localId, permisos } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [actividad, setActividad] = useState<Actividad | null>(null)
  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ nombre: '', horario_inicio: '', horario_fin: '', cupo_maximo: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!localId || !id) return
    cargar()
  }, [localId, id])

  const cargar = async () => {
    setLoading(true)
    const [{ data: act }, { data: memb }] = await Promise.all([
      supabaseApp
        .from('actividades')
        .select('*, profesores(id, nombre, apellido)')
        .eq('id', id).eq('org_id', localId).single(),
      supabaseApp
        .from('membresias')
        .select('socio_id, socios(id, nombre, apellido, estado, foto_url)')
        .eq('org_id', localId)
        .contains('actividades_ids', [id])
        .in('estado', ['activa', 'proxima_vencer']),
    ])

    setActividad(act as Actividad)
    if (act) setForm({
      nombre: act.nombre,
      horario_inicio: act.horario_inicio ?? '',
      horario_fin: act.horario_fin ?? '',
      cupo_maximo: act.cupo_maximo?.toString() ?? '',
    })

    const sociosUnicos = new Map<string, Socio>()
    ;(memb ?? []).forEach((m: any) => {
      if (m.socios) sociosUnicos.set(m.socios.id, m.socios)
    })
    setSocios(Array.from(sociosUnicos.values()))
    setLoading(false)
  }

  const guardarEdicion = async () => {
    if (!actividad) return
    setGuardando(true)
    await supabaseApp.from('actividades').update({
      nombre: form.nombre.trim(),
      horario_inicio: form.horario_inicio || null,
      horario_fin: form.horario_fin || null,
      cupo_maximo: form.cupo_maximo ? parseInt(form.cupo_maximo) : null,
    }).eq('id', id)
    setEditando(false)
    await cargar()
    setGuardando(false)
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!actividad) return <div className="text-center py-16 text-gray-500">Actividad no encontrada</div>

  return (
    <RouteGuard permiso="verActividades">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-2xl leading-none">‹</button>
          <h1 className="text-xl font-bold text-white flex-1">Actividad</h1>
          {permisos?.editarActividades && !editando && (
            <button onClick={() => setEditando(true)} className="text-violet-400 text-sm hover:underline">Editar</button>
          )}
        </div>

        {/* Datos de la actividad */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
          {editando ? (
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Nombre</label>
                <input
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Hora inicio</label>
                  <input type="time" value={form.horario_inicio} onChange={e => setForm(f => ({ ...f, horario_inicio: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Hora fin</label>
                  <input type="time" value={form.horario_fin} onChange={e => setForm(f => ({ ...f, horario_fin: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500" />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Cupo máximo</label>
                <input type="number" value={form.cupo_maximo} onChange={e => setForm(f => ({ ...f, cupo_maximo: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditando(false)} className="flex-1 py-2 rounded-xl bg-gray-800 text-gray-400 text-sm">Cancelar</button>
                <button onClick={guardarEdicion} disabled={guardando}
                  className="flex-1 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-3">{actividad.nombre}</h2>
              {actividad.dias?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {actividad.dias.map(d => (
                    <span key={d} className="text-xs bg-violet-900/40 text-violet-300 px-2.5 py-1 rounded-lg">
                      {DIAS_ABREV[d] ?? d}
                    </span>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {actividad.horario_inicio && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-sm">Horario</span>
                    <span className="text-white text-sm">{actividad.horario_inicio} – {actividad.horario_fin}</span>
                  </div>
                )}
                {actividad.cupo_maximo && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-sm">Cupo máximo</span>
                    <span className="text-white text-sm">{actividad.cupo_maximo} personas</span>
                  </div>
                )}
                {actividad.profesores && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-sm">Profesor/a</span>
                    <span className="text-violet-400 text-sm">{actividad.profesores.nombre} {actividad.profesores.apellido}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Socios inscriptos */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Socios inscriptos
            </h3>
            <span className="text-gray-500 text-sm">{socios.length}</span>
          </div>

          {socios.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">Ningún socio con membresía activa en esta actividad</p>
          ) : (
            <div className="space-y-2">
              {socios.map(s => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/socios/${s.id}`)}
                  className="w-full flex items-center gap-3 py-2 hover:bg-gray-800 rounded-xl px-2 transition text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-violet-900 flex items-center justify-center shrink-0 overflow-hidden">
                    {s.foto_url
                      ? <img src={s.foto_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-violet-300 font-bold text-sm">{s.nombre[0]}{s.apellido[0]}</span>
                    }
                  </div>
                  <p className="text-white text-sm flex-1">{s.apellido}, {s.nombre}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full
                    ${s.estado === 'activo' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {s.estado}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </RouteGuard>
  )
}
