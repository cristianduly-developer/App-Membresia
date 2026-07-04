'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'
import { mensajeErrorGuardado } from '@/lib/errores'

interface Socio { id: string; nombre: string; apellido: string }
interface Actividad { id: string; nombre: string; horario_inicio: string | null; horario_fin: string | null }

const TIPOS = [
  { key: 'mensual', label: 'Mensual', dias: 30 },
  { key: 'trimestral', label: 'Trimestral', dias: 90 },
  { key: 'semestral', label: 'Semestral', dias: 180 },
  { key: 'anual', label: 'Anual', dias: 365 },
]

function sumarDias(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

function NuevaMembresiaInner() {
  const { localId } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const socioParam = searchParams.get('socio')

  const [socios, setSocios] = useState<Socio[]>([])
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [form, setForm] = useState({
    socio_id: socioParam ?? '',
    tipo: 'mensual',
    precio: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_vencimiento: sumarDias(30),
    actividades_ids: [] as string[],
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!localId) return
    cargarDatos()
  }, [localId])

  const cargarDatos = async () => {
    const [{ data: s }, { data: a }] = await Promise.all([
      supabaseApp.from('socios').select('id, nombre, apellido').eq('org_id', localId).eq('estado', 'activo').order('apellido'),
      supabaseApp.from('actividades').select('id, nombre, horario_inicio, horario_fin').eq('org_id', localId).order('nombre'),
    ])
    setSocios((s ?? []) as Socio[])
    setActividades((a ?? []) as Actividad[])
  }

  const setTipo = (tipo: string) => {
    const t = TIPOS.find(x => x.key === tipo)!
    setForm(f => ({
      ...f,
      tipo,
      fecha_vencimiento: sumarDias(t.dias),
    }))
  }

  const toggleActividad = (id: string) => {
    setForm(f => ({
      ...f,
      actividades_ids: f.actividades_ids.includes(id)
        ? f.actividades_ids.filter(x => x !== id)
        : [...f.actividades_ids, id],
    }))
  }

  const guardar = async () => {
    if (!form.socio_id) { setError('Seleccioná un socio'); return }
    if (!form.precio || isNaN(Number(form.precio))) { setError('Ingresá el precio'); return }
    setGuardando(true)
    setError(null)

    const { error: err } = await supabaseApp.from('membresias').insert({
      org_id: localId,
      socio_id: form.socio_id,
      tipo: form.tipo,
      precio: parseFloat(form.precio),
      fecha_inicio: form.fecha_inicio,
      fecha_vencimiento: form.fecha_vencimiento,
      estado: 'activa',
      actividades_ids: form.actividades_ids.length > 0 ? form.actividades_ids : null,
    })

    if (err) { setError(mensajeErrorGuardado(err) || err.message); setGuardando(false); return }

    if (socioParam) {
      router.push(`/socios/${socioParam}`)
    } else {
      router.push('/membresias')
    }
  }

  return (
    <RouteGuard permiso="editarMembresias">
      <div className="max-w-lg mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-2xl leading-none">‹</button>
          <h1 className="text-xl font-bold text-white">Nueva membresía</h1>
        </div>

        <div className="space-y-4">

          {/* Socio */}
          <div>
            <label className="text-gray-400 text-xs block mb-1">Socio *</label>
            <select
              value={form.socio_id}
              onChange={e => setForm(f => ({ ...f, socio_id: e.target.value }))}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500"
            >
              <option value="">Seleccionar socio...</option>
              {socios.map(s => (
                <option key={s.id} value={s.id}>{s.apellido}, {s.nombre}</option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label className="text-gray-400 text-xs block mb-2">Tipo *</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTipo(t.key)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition
                    ${form.tipo === t.key ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Precio */}
          <div>
            <label className="text-gray-400 text-xs block mb-1">Precio *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
              <input
                type="number"
                value={form.precio}
                onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
                placeholder="0"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-7 pr-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1">Fecha inicio</label>
              <input
                type="date"
                value={form.fecha_inicio}
                onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Vencimiento</label>
              <input
                type="date"
                value={form.fecha_vencimiento}
                onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Actividades */}
          {actividades.length > 0 && (
            <div>
              <label className="text-gray-400 text-xs block mb-2">Actividades incluidas</label>
              <div className="space-y-2">
                {actividades.map(act => (
                  <button
                    key={act.id}
                    onClick={() => toggleActividad(act.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left
                      ${form.actividades_ids.includes(act.id)
                        ? 'border-violet-500 bg-violet-900/20'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-600'}`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition
                      ${form.actividades_ids.includes(act.id) ? 'border-violet-500 bg-violet-500' : 'border-gray-600'}`}>
                      {form.actividades_ids.includes(act.id) && <span className="text-white text-xs">✓</span>}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{act.nombre}</p>
                      {act.horario_inicio && (
                        <p className="text-gray-500 text-xs">{act.horario_inicio} – {act.horario_fin}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-base transition"
          >
            {guardando ? 'Guardando...' : 'Crear membresía'}
          </button>

        </div>
      </div>
    </RouteGuard>
  )
}

export default function NuevaMembresiaPage() {
  return (
    <Suspense>
      <NuevaMembresiaInner />
    </Suspense>
  )
}
