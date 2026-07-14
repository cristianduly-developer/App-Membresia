'use client'
import { useSession } from '@/lib/sessionStore'
import { supabaseApp } from '@/lib/supabaseApp'
import { useRouter } from 'next/navigation'

const WHATSAPP_NUMERO = '5492236965481'
const WHATSAPP_MENSAJE = encodeURIComponent('Hola, quiero suscribirme a SocioApp. Venía usando el demo.')

const PLANES = [
  {
    key: 'basico',
    nombre: 'Básico',
    precio: '$8.500/mes',
    color: 'border-gray-600',
    badge: '',
    items: ['Hasta 100 socios', '3 actividades', 'Cobros y caja', 'Rentabilidad'],
  },
  {
    key: 'profesional',
    nombre: 'Profesional',
    precio: '$14.900/mes',
    color: 'border-violet-500',
    badge: 'Más elegido',
    items: ['Hasta 300 socios', 'Actividades ilimitadas', '2 colaboradores', 'Profesores y liquidaciones', 'Alertas de deserción', 'Apto médico'],
  },
  {
    key: 'premium',
    nombre: 'Premium',
    precio: '$22.900/mes',
    color: 'border-yellow-500',
    badge: 'Todo incluido',
    items: ['Socios ilimitados', 'Actividades ilimitadas', '5 colaboradores', 'Reportes avanzados', 'Cierre de caja'],
  },
]

export function DemoExpirada() {
  const { estadoSuscripcion, diasRestantes, nombreNegocio, clearSession } = useSession()
  const router = useRouter()

  const mostrar =
    estadoSuscripcion === 'demo' && diasRestantes !== null && diasRestantes <= 0

  if (!mostrar) return null

  const cerrarSesion = async () => {
    await supabaseApp.auth.signOut()
    clearSession()
    router.push('/login')
  }

  return (
    <div className="fixed inset-0 z-[100] bg-gray-950 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-3xl font-black text-white mb-2">Tu demo venció</h1>
          <p className="text-gray-400 text-lg">
            {nombreNegocio ? `Gracias por probar SocioApp con ${nombreNegocio}.` : 'Gracias por probar SocioApp.'}
          </p>
          <p className="text-gray-500 mt-1">
            Elegí un plan para seguir usando todos tus datos.
          </p>
        </div>

        {/* Planes */}
        <div className="space-y-3 mb-8">
          {PLANES.map(plan => (
            <div
              key={plan.key}
              className={`border-2 rounded-2xl p-5 relative ${plan.color} ${
                plan.key === 'profesional' ? 'bg-violet-900/10' : 'bg-gray-900'
              }`}
            >
              {plan.badge && (
                <span className={`absolute -top-3 left-4 text-xs font-bold px-3 py-1 rounded-full ${
                  plan.key === 'profesional' ? 'bg-violet-600 text-white' : 'bg-yellow-500 text-gray-900'
                }`}>
                  {plan.badge}
                </span>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-bold text-lg">{plan.nombre}</h3>
                  <p className={`font-black text-2xl mt-0.5 ${
                    plan.key === 'profesional' ? 'text-violet-300' :
                    plan.key === 'premium' ? 'text-yellow-300' : 'text-gray-300'
                  }`}>{plan.precio}</p>
                </div>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMERO}?text=${WHATSAPP_MENSAJE}%20Plan%20${plan.nombre}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`shrink-0 ml-4 px-4 py-2 rounded-xl text-sm font-bold transition ${
                    plan.key === 'profesional'
                      ? 'bg-violet-600 hover:bg-violet-500 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  Elegir
                </a>
              </div>
              <ul className="space-y-1">
                {plan.items.map(item => (
                  <li key={item} className="text-gray-400 text-sm flex items-center gap-2">
                    <span className="text-green-500 text-xs">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA principal */}
        <a
          href={`https://wa.me/${WHATSAPP_NUMERO}?text=${WHATSAPP_MENSAJE}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-2xl text-center text-lg transition mb-3"
        >
          💬 Hablar con soporte por WhatsApp
        </a>

        <p className="text-center text-gray-600 text-xs mb-6">
          Tus datos están guardados y disponibles al activar tu suscripción.
        </p>

        <button
          onClick={cerrarSesion}
          className="w-full py-3 text-gray-600 hover:text-gray-400 text-sm transition"
        >
          Cerrar sesión
        </button>

      </div>
    </div>
  )
}
