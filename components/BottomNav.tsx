'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePermisos } from '@/hooks/usePermisos'

const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Inicio',       emoji: '📊', permiso: 'verDashboard'  },
  { href: '/socios',      label: 'Socios',       emoji: '👥', permiso: 'verSocios'     },
  { href: '/checkin',     label: 'Check-in',     emoji: '📲', permiso: 'verCheckin'    },
  { href: '/cobros',      label: 'Cobros',       emoji: '💰', permiso: 'verCobros'     },
  { href: '/config',      label: 'Config',       emoji: '⚙️', permiso: 'verConfig'     },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const permisos = usePermisos()

  const items = NAV_ITEMS.filter((item) =>
    permisos[item.permiso as keyof typeof permisos]
  )

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all
                ${active ? 'text-violet-400' : 'text-gray-500'}`}
            >
              <span className="text-xl">{item.emoji}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
