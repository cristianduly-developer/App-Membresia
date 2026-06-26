'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession, type RubroOrg } from '@/lib/sessionStore'
import { getLimites } from '@/lib/planLimits'

interface Colaborador {
  id: string
  email: string
  nombre: string
  rol: 'recepcionista' | 'profesor'
  activo: boolean
}

const RUBROS = [
  { key: 'gimnasio', label: 'Gimnasio', icon: '🏋️' },
  { key: 'futbol', label: 'Fútbol', icon: '⚽' },
  { key: 'danza', label: 'Danza', icon: '💃' },
  { key: 'natatorio', label: 'Natatorio', icon: '🏊' },
  { key: 'artes_marciales', label: 'Artes marciales', icon: '🥋' },
  { key: 'tenis', label: 'Tenis / Pádel', icon: '🎾' },
  { key: 'cultural', label: 'Cultural', icon: '🎭' },
  { key: 'otro', label: 'Otro', icon: '🏢' },
]

const PLAN_LABEL: Record<string, string> = {
  basico: 'Básico',
  profesional: 'Profesional',
  premium: 'Premium',
  sincargo: 'Sin cargo',
}

const PLAN_COLOR: Record<string, string> = {
  basico: 'text-gray-300',
  profesional: 'text-violet-400',
  premium: 'text-yellow-400',
  sincargo: 'text-green-400',
}

export default function ConfigPage() {
  const { localId, plan, nombreNegocio, rubroOrg, estadoSuscripcion, diasRestantes, rolSistema, setSession } = useSession()
  const router = useRouter()
  const limites = getLimites(plan)

  const [form, setForm] = useState({
    nombre_negocio: nombreNegocio ?? '',
    rubro: rubroOrg ?? 'otro',
    telefono: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [loading, setLoading] = useState(true)

  // Colaboradores
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [formColab, setFormColab] = useState({ email: '', nombre: '', rol: 'recepcionista' as 'recepcionista' | 'profesor' })
  const [guardandoColab, setGuardandoColab] = useState(false)
  const [errorColab, setErrorColab] = useState<string | null>(null)
  const [modalColab, setModalColab] = useState(false)

  useEffect(() => {
    if (!localId) return
    cargar()
  }, [localId])

  const cargar = async () => {
    const [{ data }, { data: colabs }] = await Promise.all([
      supabaseApp.from('config_org').select('nombre_negocio, rubro, telefono').eq('org_id', localId).maybeSingle(),
      supabaseApp.from('colaboradores').select('*').eq('org_id', localId).eq('activo', true).order('nombre'),
    ])
    if (data) {
      setForm({
        nombre_negocio: data.nombre_negocio ?? '',
        rubro: data.rubro ?? 'otro',
        telefono: data.telefono ?? '',
      })
    }
    setColaboradores((colabs ?? []) as Colaborador[])
    setLoading(false)
  }

  const agregarColaborador = async () => {
    if (!formColab.email.trim() || !formColab.nombre.trim()) { setErrorColab('Email y nombre son obligatorios'); return }
    if (colaboradores.length >= limites.maxColaboradores) { setErrorColab(`Tu plan permite hasta ${limites.maxColaboradores} colaboradores`); return }
    setGuardandoColab(true)
    setErrorColab(null)
    const { data: { session } } = await supabaseApp.auth.getSession()
    const res = await fetch('/api/colaboradores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ nombre: formColab.nombre.trim(), email: formColab.email.trim().toLowerCase(), rol: formColab.rol, orgId: localId }),
    })
    if (!res.ok) {
      const d = await res.json()
      setErrorColab(d.error || 'Error al guardar el colaborador')
      setGuardandoColab(false)
      return
    }
    setFormColab({ email: '', nombre: '', rol: 'recepcionista' })
    setModalColab(false)
    await cargar()
    setGuardandoColab(false)
  }

  const desactivarColaborador = async (id: string) => {
    await supabaseApp.from('colaboradores').update({ activo: false }).eq('id', id)
    setColaboradores(c => c.filter(x => x.id !== id))
  }

  const guardar = async () => {
    setGuardando(true)
    await supabaseApp.from('config_org').update({
      nombre_negocio: form.nombre_negocio.trim(),
      rubro: form.rubro,
      telefono: form.telefono || null,
    }).eq('org_id', localId)
    setSession({ nombreNegocio: form.nombre_negocio.trim(), rubroOrg: form.rubro as any })
    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  const cerrarSesion = async () => {
    await supabaseApp.auth.signOut()
    router.push('/login')
  }

  const rubroActual = RUBROS.find(r => r.key === form.rubro)

  return (
    <RouteGuard permiso="verConfig">
      <div className="max-w-lg mx-auto">

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Configuración</h1>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            estadoSuscripcion === 'activo' ? 'bg-green-900/40 text-green-400 border border-green-800' :
            estadoSuscripcion === 'demo'   ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-800' :
            'bg-red-900/40 text-red-400 border border-red-800'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              estadoSuscripcion === 'activo' ? 'bg-green-400' :
              estadoSuscripcion === 'demo'   ? 'bg-yellow-400' : 'bg-red-400'
            }`} />
            {estadoSuscripcion === 'activo' ? 'Activo' :
             estadoSuscripcion === 'demo'   ? `Demo${diasRestantes !== null ? ` · ${diasRestantes}d` : ''}` :
             'Inactivo'}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">

            {/* Datos del negocio */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Negocio</h2>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Nombre del negocio</label>
                <input
                  value={form.nombre_negocio}
                  onChange={e => setForm(f => ({ ...f, nombre_negocio: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Teléfono</label>
                <input
                  value={form.telefono}
                  onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                  placeholder="223 555 1234"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-2">Rubro</label>
                <div className="grid grid-cols-2 gap-2">
                  {RUBROS.map(r => (
                    <button
                      key={r.key}
                      onClick={() => setForm(f => ({ ...f, rubro: r.key as RubroOrg }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition text-left
                        ${form.rubro === r.key
                          ? 'border-violet-500 bg-violet-900/30 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'}`}
                    >
                      <span>{r.icon}</span>
                      <span className="truncate">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={guardar}
                disabled={guardando}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition
                  ${guardado
                    ? 'bg-green-600 text-white'
                    : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50'}`}
              >
                {guardado ? '✓ Guardado' : guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>

            {/* Plan actual */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Suscripción</h2>

              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Plan actual</span>
                <span className={`font-bold text-sm ${PLAN_COLOR[plan ?? 'basico']}`}>
                  {PLAN_LABEL[plan ?? 'basico']}
                </span>
              </div>

              {estadoSuscripcion === 'demo' && diasRestantes !== null && (
                <div className={`rounded-xl p-3 text-sm ${
                  diasRestantes <= 3 ? 'bg-red-900/30 text-red-400 border border-red-800' :
                  'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
                }`}>
                  {diasRestantes > 0
                    ? `⏳ Demo: quedan ${diasRestantes} días`
                    : '⚠️ Demo vencida — contactá soporte para suscribirte'}
                </div>
              )}

              <div className="space-y-2 pt-1">
                {[
                  { label: 'Socios', valor: limites.maxSocios === null ? 'Ilimitados' : `Hasta ${limites.maxSocios}` },
                  { label: 'Actividades', valor: limites.maxActividades === null ? 'Ilimitadas' : `Hasta ${limites.maxActividades}` },
                  { label: 'Colaboradores', valor: limites.maxColaboradores === 0 ? 'No incluido' : `Hasta ${limites.maxColaboradores}` },
                  { label: 'Profesores y liquidaciones', valor: limites.usaProfesores ? '✓ Incluido' : '✗ No incluido' },
                  { label: 'Alertas de deserción', valor: limites.usaAlertaDesercion ? '✓ Incluido' : '✗ No incluido' },
                  { label: 'Apto médico', valor: limites.usaAptoMedico ? '✓ Incluido' : '✗ No incluido' },
                ].map(({ label, valor }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className={`font-medium ${valor.startsWith('✓') ? 'text-green-400' : valor.startsWith('✗') ? 'text-gray-600' : 'text-white'}`}>
                      {valor}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Colaboradores */}
            {rolSistema === 'owner' && limites.maxColaboradores > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    Colaboradores
                  </h2>
                  <span className="text-gray-600 text-xs">{colaboradores.length}/{limites.maxColaboradores}</span>
                </div>

                {colaboradores.length === 0 ? (
                  <p className="text-gray-600 text-sm">Sin colaboradores agregados</p>
                ) : (
                  <div className="space-y-2">
                    {colaboradores.map(c => (
                      <div key={c.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-900 flex items-center justify-center shrink-0">
                          <span className="text-violet-300 font-bold text-xs">{c.nombre[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{c.nombre}</p>
                          <p className="text-gray-500 text-xs capitalize">{c.rol} · {c.email}</p>
                        </div>
                        <button
                          onClick={() => desactivarColaborador(c.id)}
                          className="text-gray-600 hover:text-red-400 transition text-lg shrink-0"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}

                {colaboradores.length < limites.maxColaboradores && (
                  <button
                    onClick={() => { setFormColab({ email: '', nombre: '', rol: 'recepcionista' }); setErrorColab(null); setModalColab(true) }}
                    className="w-full py-2.5 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:border-violet-600 hover:text-violet-400 text-sm transition"
                  >
                    + Agregar colaborador
                  </button>
                )}
              </div>
            )}

            {rolSistema === 'owner' && limites.maxColaboradores === 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Colaboradores</h2>
                <p className="text-gray-600 text-sm">Disponible desde el plan <span className="text-violet-400">Profesional</span></p>
              </div>
            )}

            {/* Soporte */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Soporte</h2>
              <p className="text-gray-500 text-sm">¿Tenés alguna duda o problema? Escribinos por WhatsApp.</p>
              <a
                href="https://wa.me/5492235767784?text=Hola,%20necesito%20ayuda%20con%20App-Membresia"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-700 hover:bg-green-600 text-white font-semibold text-sm transition"
              >
                💬 Contactar soporte por WhatsApp
              </a>
            </div>

            {/* Cuenta */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Cuenta</h2>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Rol</span>
                <span className="text-white capitalize">{rolSistema ?? '—'}</span>
              </div>
              <button
                onClick={cerrarSesion}
                className="w-full py-3 rounded-xl bg-red-900/40 hover:bg-red-900/60 text-red-400 font-semibold text-sm transition border border-red-900"
              >
                🚪 Cerrar sesión
              </button>
            </div>

            {/* Modal agregar colaborador */}
            {modalColab && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
                <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-white font-bold text-lg">Agregar colaborador</h2>
                    <button onClick={() => setModalColab(false)} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Nombre *</label>
                    <input value={formColab.nombre} onChange={e => setFormColab(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Juan García"
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Email *</label>
                    <input type="email" value={formColab.email} onChange={e => setFormColab(f => ({ ...f, email: e.target.value }))}
                      placeholder="juan@mail.com"
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-2">Rol</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['recepcionista', 'profesor'] as const).map(r => (
                        <button key={r} onClick={() => setFormColab(f => ({ ...f, rol: r }))}
                          className={`py-2.5 rounded-xl text-sm font-medium capitalize transition
                            ${formColab.rol === r ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                          {r === 'recepcionista' ? '🧑‍💼 Recepcionista' : '👨‍🏫 Profesor'}
                        </button>
                      ))}
                    </div>
                    <p className="text-gray-600 text-xs mt-2">
                      {formColab.rol === 'recepcionista'
                        ? 'Puede ver socios, registrar cobros y hacer check-in'
                        : 'Puede ver actividades, asistencias y sus liquidaciones'}
                    </p>
                  </div>
                  {errorColab && <p className="text-red-400 text-sm">{errorColab}</p>}
                  <button onClick={agregarColaborador} disabled={guardandoColab}
                    className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
                    {guardandoColab ? 'Guardando...' : 'Agregar'}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </RouteGuard>
  )
}
