'use client'
import { useSession } from '@/lib/sessionStore'
import { getPermisos } from '@/lib/permisos'

export function usePermisos() {
  const { rolSistema } = useSession()
  // Siempre recalcular desde rolSistema para reflejar cambios en permisos.ts
  return getPermisos(rolSistema ?? 'owner')
}
