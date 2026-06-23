'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession, type RubroOrg } from '@/lib/sessionStore'

const RUBROS: { value: RubroOrg; label: string; emoji: string; ejemplos: string }[] = [
  { value: 'gimnasio',        label: 'Gimnasio',        emoji: '🏋️', ejemplos: 'Musculación, cardio, funcional' },
  { value: 'futbol',          label: 'Fútbol',          emoji: '⚽', ejemplos: 'Escuela infantil, amateur' },
  { value: 'danza',           label: 'Danza',           emoji: '💃', ejemplos: 'Ballet, folklore, contemporáneo' },
  { value: 'natatorio',       label: 'Natatorio',       emoji: '🏊', ejemplos: 'Natación, bebés, adultos' },
  { value: 'artes_marciales', label: 'Artes marciales', emoji: '🥋', ejemplos: 'Karate, judo, boxeo' },
  { value: 'tenis',           label: 'Tenis / Pádel',   emoji: '🎾', ejemplos: 'Clases, torneos, escuelas' },
  { value: 'cultural',        label: 'Centro cultural', emoji: '🎭', ejemplos: 'Teatro, música, talleres' },
  { value: 'otro',            label: 'Otro',            emoji: '🏪', ejemplos: 'Cualquier org. con socios' },
]

export default function OnboardingPage() {
  const { localId, setSession } = useSession()
  const router = useRouter()
  const [paso, setPaso] = useState(1)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    rubro: '' as RubroOrg | '',
  })

  const handleFinalizar = async () => {
    if (!localId || !form.nombre || !form.rubro) return
    setLoading(true)

    await supabaseApp.from('config_org').upsert({
      org_id: localId,
      nombre_negocio: form.nombre,
      rubro: form.rubro,
      onboarding_completo: true,
    })

    // Generar datos demo según el rubro seleccionado
    const { data: { session } } = await supabaseApp.auth.getSession()
    if (session?.access_token) {
      await fetch('/api/generar-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ org_id: localId, rubro: form.rubro }),
      })
    }

    setSession({
      nombreNegocio: form.nombre,
      rubroOrg: form.rubro as RubroOrg,
      onboardingCompleto: true,
    })
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Banner bienvenida */}
        <div className="rounded-2xl text-center p-6 mb-6" style={{ background: 'linear-gradient(135deg, #5b21b6, #6c3fc8)', boxShadow: '0 4px 16px rgba(108,63,200,0.35)' }}>
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-white font-extrabold text-xl mb-1">¡Bienvenido/a a SocioApp!</div>
          <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Tu prueba gratuita de <strong>28 días</strong> ya está activa.<br />
            Configurá tu organización en 2 pasos y empezá ahora.
          </div>
        </div>

        {/* Progreso */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map((n) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                ${paso >= n ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                {paso > n ? '✓' : n}
              </div>
              {n < 2 && <div className={`flex-1 h-0.5 ${paso > n ? 'bg-violet-600' : 'bg-gray-800'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-xl">

          {/* Paso 1 — Nombre */}
          {paso === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white">¿Cómo se llama tu organización?</h2>
                <p className="text-gray-400 text-sm mt-1">El nombre que verán en la app</p>
              </div>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Gym Central, Club Atlético, Academia Luna"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                autoFocus
              />
              <button
                onClick={() => setPaso(2)}
                disabled={!form.nombre.trim()}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition"
              >
                Continuar
              </button>
            </div>
          )}

          {/* Paso 2 — Rubro */}
          {paso === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white">¿Qué tipo de organización es?</h2>
                <p className="text-gray-400 text-sm mt-1">Adaptamos la demo a tu rubro</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {RUBROS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setForm((f) => ({ ...f, rubro: r.value }))}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all
                      ${form.rubro === r.value
                        ? 'bg-violet-600 border-violet-500'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
                  >
                    <span className="text-2xl">{r.emoji}</span>
                    <span className="text-sm font-semibold text-white">{r.label}</span>
                    <span className={`text-xs leading-tight ${form.rubro === r.value ? 'text-violet-200' : 'text-gray-500'}`}>
                      {r.ejemplos}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setPaso(1)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl py-3 transition">
                  Atrás
                </button>
                <button
                  onClick={handleFinalizar}
                  disabled={!form.rubro || loading}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Preparando tu demo...
                    </span>
                  ) : 'Empezar a usar'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
