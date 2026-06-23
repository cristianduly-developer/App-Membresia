'use client'
import { useSession } from '@/lib/sessionStore'

export function DemoBanner() {
  const { estadoSuscripcion, diasRestantes } = useSession()

  if (estadoSuscripcion !== 'demo') return null
  if (diasRestantes !== null && diasRestantes <= 0) return null

  const urgente = diasRestantes !== null && diasRestantes <= 3

  return (
    <div className={`w-full text-center text-sm font-medium py-1.5 px-4 ${
      urgente ? 'bg-red-600 text-white' : 'bg-amber-500 text-amber-950'
    }`}>
      {urgente
        ? `⚠️ Demo vence en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} — suscribite para no perder tus datos`
        : `Modo demo — quedan ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}`
      }
    </div>
  )
}
