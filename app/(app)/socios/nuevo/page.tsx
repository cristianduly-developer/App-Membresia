'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

const ESTADOS = ['activo', 'inactivo', 'suspendido']

function NuevoSocioInner() {
  const { localId } = useSession()
  const router = useRouter()

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    email: '',
    direccion: '',
    fecha_nacimiento: '',
    observaciones: '',
    estado: 'activo',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const guardar = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setError('Nombre y apellido son obligatorios')
      return
    }
    if (!localId) return
    setGuardando(true)
    setError(null)

    const payload: Record<string, any> = {
      org_id: localId,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      estado: form.estado,
    }
    if (form.dni) payload.dni = form.dni.trim()
    if (form.telefono) payload.telefono = form.telefono.trim()
    if (form.email) payload.email = form.email.trim()
    if (form.direccion) payload.direccion = form.direccion.trim()
    if (form.fecha_nacimiento) payload.fecha_nacimiento = form.fecha_nacimiento
    if (form.observaciones) payload.observaciones = form.observaciones.trim()

    const { data, error: err } = await supabaseApp
      .from('socios')
      .insert(payload)
      .select('id')
      .single()

    if (err) {
      setError(err.message)
      setGuardando(false)
      return
    }

    router.push(`/socios/${data.id}`)
  }

  return (
    <RouteGuard permiso="editarSocios">
      <div className="max-w-lg mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-2xl leading-none">‹</button>
          <h1 className="text-xl font-bold text-white">Nuevo socio</h1>
        </div>

        <div className="space-y-4">

          {/* Nombre + Apellido */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1">Nombre *</label>
              <input
                value={form.nombre}
                onChange={e => set('nombre', e.target.value)}
                placeholder="Juan"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Apellido *</label>
              <input
                value={form.apellido}
                onChange={e => set('apellido', e.target.value)}
                placeholder="García"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* DNI */}
          <div>
            <label className="text-gray-400 text-xs block mb-1">DNI</label>
            <input
              value={form.dni}
              onChange={e => set('dni', e.target.value)}
              placeholder="30.123.456"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="text-gray-400 text-xs block mb-1">Teléfono</label>
            <input
              value={form.telefono}
              onChange={e => set('telefono', e.target.value)}
              placeholder="223 555 1234"
              type="tel"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-gray-400 text-xs block mb-1">Email</label>
            <input
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="juan@mail.com"
              type="email"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Fecha de nacimiento */}
          <div>
            <label className="text-gray-400 text-xs block mb-1">Fecha de nacimiento</label>
            <input
              value={form.fecha_nacimiento}
              onChange={e => set('fecha_nacimiento', e.target.value)}
              type="date"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Dirección */}
          <div>
            <label className="text-gray-400 text-xs block mb-1">Dirección</label>
            <input
              value={form.direccion}
              onChange={e => set('direccion', e.target.value)}
              placeholder="Av. Colón 1234"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Estado */}
          <div>
            <label className="text-gray-400 text-xs block mb-2">Estado inicial</label>
            <div className="flex gap-2">
              {ESTADOS.map(e => (
                <button
                  key={e}
                  onClick={() => set('estado', e)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition
                    ${form.estado === e
                      ? e === 'activo' ? 'bg-green-600 text-white' : e === 'suspendido' ? 'bg-red-700 text-white' : 'bg-gray-600 text-white'
                      : 'bg-gray-800 text-gray-400'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="text-gray-400 text-xs block mb-1">Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={e => set('observaciones', e.target.value)}
              placeholder="Notas adicionales..."
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-base transition"
          >
            {guardando ? 'Guardando...' : 'Guardar socio'}
          </button>

        </div>
      </div>
    </RouteGuard>
  )
}

export default function NuevoSocioPage() {
  return (
    <Suspense>
      <NuevoSocioInner />
    </Suspense>
  )
}
