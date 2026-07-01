'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { usePermisos } from '@/hooks/usePermisos'
import { useSession } from '@/lib/sessionStore'
import { getLimites, type PlanLimits } from '@/lib/planLimits'

const MAIN_ITEMS = [
  { href: '/socios',    label: 'Socios',    emoji: '👥', permiso: 'verSocios'    },
  { href: '/cobros',    label: 'Cobros',    emoji: '💰', permiso: 'verCobros'    },
  { href: '/dashboard', label: 'Inicio',    emoji: '📊', permiso: 'verDashboard' },
] as const

const MORE_ITEMS = [
  { href: '/asistencias',  label: 'Asistencias',  emoji: '📋', permiso: 'verAsistencias',   planFeature: null                        },
  { href: '/membresias',   label: 'Membresías',   emoji: '🎫', permiso: 'verMembresias',    planFeature: null                        },
  { href: '/actividades',  label: 'Actividades',  emoji: '🏃', permiso: 'verActividades',   planFeature: null                        },
  { href: '/profesores',   label: 'Profesores',   emoji: '👨‍🏫', permiso: 'verProfesores',    planFeature: 'usaProfesores' as keyof PlanLimits },
  { href: '/liquidaciones',label: 'Liquidaciones',emoji: '📑', permiso: 'verLiquidaciones', planFeature: 'usaLiquidaciones' as keyof PlanLimits },
  { href: '/apto-medico',  label: 'Apto médico',  emoji: '🩺', permiso: 'verSocios',        planFeature: 'usaAptoMedico' as keyof PlanLimits },
  { href: '/caja',         label: 'Caja',         emoji: '🧾', permiso: 'verCaja',          planFeature: null                        },
  { href: '/rentabilidad', label: 'Rentabilidad', emoji: '📈', permiso: 'verRentabilidad',  planFeature: 'usaReportesAvanzados' as keyof PlanLimits },
  { href: '/config',       label: 'Config',       emoji: '⚙️', permiso: 'verConfig',        planFeature: null                        },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const permisos = usePermisos()
  const { plan } = useSession()
  const limites = getLimites(plan)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const mainItems = MAIN_ITEMS.filter(i => permisos[i.permiso as keyof typeof permisos])
  const moreItems = MORE_ITEMS.filter(i => permisos[i.permiso as keyof typeof permisos])

  // Insertar Check-in en el centro (posición 2)
  const leftItems  = mainItems.slice(0, 2)
  const rightItems = mainItems.slice(2)

  const handleMoreNav = (href: string) => {
    setDrawerOpen(false)
    router.push(href)
  }

  return (
    <>
      {/* Drawer "Más" */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute bottom-20 left-0 right-0 mx-3 bg-gray-900 border border-gray-800 rounded-2xl p-4"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3 px-1">Más opciones</p>
            <div className="grid grid-cols-4 gap-2">
              {moreItems.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const locked = item.planFeature ? !limites[item.planFeature] : false
                return (
                  <button
                    key={item.href}
                    onClick={() => handleMoreNav(item.href)}
                    className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all
                      ${active ? 'bg-violet-600/20 text-violet-400' : 'bg-gray-800 text-gray-400 active:bg-gray-700'}`}
                  >
                    <span className="text-2xl">{item.emoji}</span>
                    <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                    {locked && (
                      <span className="absolute top-1.5 right-1.5 text-[10px] leading-none">🔒</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
        <div className="grid grid-cols-5 items-end px-1 pb-2 pt-1">

          {/* Col 1 — Socios */}
          {leftItems[0] ? (() => {
            const item = leftItems[0]
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all
                  ${active ? 'text-violet-400' : 'text-gray-500'}`}>
                <span className="text-xl">{item.emoji}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })() : <div />}

          {/* Col 2 — Cobros */}
          {leftItems[1] ? (() => {
            const item = leftItems[1]
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all
                  ${active ? 'text-violet-400' : 'text-gray-500'}`}>
                <span className="text-xl">{item.emoji}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })() : <div />}

          {/* Col 3 — Check-in FAB (centro exacto) */}
          {permisos.verCheckin ? (
            <Link href="/checkin" className="flex flex-col items-center gap-1 -mt-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all
                ${pathname === '/checkin' ? 'bg-violet-500 scale-95' : 'bg-violet-600 active:scale-95'}`}>
                <span className="text-2xl">📲</span>
              </div>
              <span className={`text-xs font-medium ${pathname === '/checkin' ? 'text-violet-400' : 'text-gray-500'}`}>
                Check-in
              </span>
            </Link>
          ) : <div />}

          {/* Col 4 — Inicio */}
          {rightItems[0] ? (() => {
            const item = rightItems[0]
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all
                  ${active ? 'text-violet-400' : 'text-gray-500'}`}>
                <span className="text-xl">{item.emoji}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })() : <div />}

          {/* Col 5 — Más */}
          {moreItems.length > 0 && (
            <button
              onClick={() => setDrawerOpen(v => !v)}
              className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all
                ${drawerOpen ? 'text-violet-400' : 'text-gray-500'}`}
            >
              <span className="text-xl">☰</span>
              <span className="text-xs font-medium">Más</span>
            </button>
          )}

        </div>
      </nav>
    </>
  )
}
