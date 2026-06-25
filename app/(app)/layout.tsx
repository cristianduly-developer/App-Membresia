'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'
import { BottomNav } from '@/components/BottomNav'
import { DemoBanner } from '@/components/DemoBanner'
import { DemoExpirada } from '@/components/DemoExpirada'
import { useSession } from '@/lib/sessionStore'
import { useAppUpdate } from '@/hooks/useAppUpdate'

function UpdateBanner() {
  const { updateReady, aplicarUpdate } = useAppUpdate()
  const [actualizando, setActualizando] = useState(false)

  if (!updateReady) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] md:left-64">
      {!actualizando ? (
        <div className="py-2 px-4 flex items-center justify-between gap-2 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-base">🆕</span>
            <span>Nueva versión disponible</span>
          </div>
          <button
            onClick={() => { setActualizando(true); aplicarUpdate() }}
            className="bg-white text-blue-700 px-3 py-1.5 rounded-lg font-bold text-xs active:scale-95 transition-all shadow-sm"
          >
            Actualizar ahora
          </button>
        </div>
      ) : (
        <div className="py-2 px-4 flex items-center justify-center gap-2 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Actualizando...</span>
        </div>
      )}
    </div>
  )
}

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
      <UpdateBanner />
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
