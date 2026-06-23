'use client'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'
import { BottomNav } from '@/components/BottomNav'
import { DemoBanner } from '@/components/DemoBanner'
import { DemoExpirada } from '@/components/DemoExpirada'
import { useSession } from '@/lib/sessionStore'

function TopBar() {
  const { nombreNegocio, nombreUsuario } = useSession()
  const inicial = (nombreUsuario ?? nombreNegocio ?? 'U')[0].toUpperCase()

  return (
    <div className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
      <span className="text-white font-bold text-base truncate max-w-[200px]">
        {nombreNegocio || 'SocioApp'}
      </span>
      <Link
        href="/config"
        className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0"
      >
        {inicial}
      </Link>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <DemoExpirada />
      <DemoBanner />
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-950 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
