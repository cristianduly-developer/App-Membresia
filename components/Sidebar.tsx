'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from '@/lib/sessionStore'
import { usePermisos } from '@/hooks/usePermisos'
import { getLimites, type PlanLimits } from '@/lib/planLimits'
import { supabaseApp } from '@/lib/supabaseApp'

const NAV_ITEMS = [
  { href: '/dashboard',      label: 'Dashboard',      emoji: '📊', permiso: 'verDashboard',    planFeature: null                                    },
  { href: '/socios',         label: 'Socios',         emoji: '👥', permiso: 'verSocios',       planFeature: null                                    },
  { href: '/actividades',    label: 'Actividades',    emoji: '🏃', permiso: 'verActividades',  planFeature: null                                    },
  { href: '/membresias',     label: 'Membresías',     emoji: '🎫', permiso: 'verMembresias',   planFeature: null                                    },
  { href: '/cobros',         label: 'Cobros',         emoji: '💰', permiso: 'verCobros',       planFeature: null                                    },
  { href: '/checkin',        label: 'Check-in',       emoji: '📲', permiso: 'verCheckin',      planFeature: null                                    },
  { href: '/asistencias',    label: 'Asistencias',    emoji: '📋', permiso: 'verAsistencias',  planFeature: null                                    },
  { href: '/profesores',     label: 'Profesores',     emoji: '👨‍🏫', permiso: 'verProfesores',   planFeature: 'usaProfesores' as keyof PlanLimits      },
  { href: '/liquidaciones',  label: 'Liquidaciones',  emoji: '📑', permiso: 'verLiquidaciones',planFeature: 'usaLiquidaciones' as keyof PlanLimits   },
  { href: '/apto-medico',    label: 'Apto médico',    emoji: '🩺', permiso: 'verSocios',       planFeature: 'usaAptoMedico' as keyof PlanLimits      },
  { href: '/caja',           label: 'Caja',           emoji: '🧾', permiso: 'verCaja',         planFeature: null                                    },
  { href: '/rentabilidad',   label: 'Rentabilidad',   emoji: '📈', permiso: 'verRentabilidad', planFeature: 'usaReportesAvanzados' as keyof PlanLimits },
  { href: '/config',         label: 'Configuración',  emoji: '⚙️', permiso: 'verConfig',       planFeature: null                                    },
]

export function Sidebar() {
  const pathname = usePathname()
  const { nombreNegocio, rolSistema, plan } = useSession()
  const permisos = usePermisos()
  const limites = getLimites(plan)

  const handleLogout = async () => {
    await supabaseApp.auth.signOut()
  }

  const items = NAV_ITEMS.filter((item) =>
    permisos[item.permiso as keyof typeof permisos]
  )

  return (
    <aside className="hidden md:flex w-64 bg-gray-900 border-r border-gray-800 flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center text-lg">🏋️</div>
          <div>
            <p className="text-sm font-bold text-white truncate max-w-[140px]">
              {nombreNegocio || 'SocioApp'}
            </p>
            <p className="text-xs text-gray-500 capitalize">{rolSistema}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const locked = item.planFeature ? !limites[item.planFeature] : false
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${active
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              <span className="text-base">{item.emoji}</span>
              <span className="flex-1">{item.label}</span>
              {locked && <span className="text-xs opacity-70">🔒</span>}
            </Link>
          )
        })}
      </nav>

      {/* Soporte + Logout */}
      <div className="p-3 border-t border-gray-800 space-y-1">
        <button
          onClick={async () => {
            const { data: { session } } = await supabaseApp.auth.getSession()
            const mail = session?.user?.email || ''
            const txt = `Hola, soy usuario de App Membresías y necesito soporte.\nMi mail: ${mail}\nMi problema es: `
            window.open(`https://wa.me/5492236965481?text=${encodeURIComponent(txt)}`, '_blank')
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-green-400 hover:text-green-300 hover:bg-gray-800 transition-all"
        >
          <span className="text-base">💬</span>
          Soporte
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
        >
          <span className="text-base">🚪</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
