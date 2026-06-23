'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'
import { getPermisos, type RolSistema } from '@/lib/permisos'
import { type Plan } from '@/lib/planLimits'
import { type RubroOrg } from '@/lib/sessionStore'

export function useSessionGuard() {
  const { setSession, clearSession, setHydrated } = useSession()
  const router = useRouter()

  useEffect(() => {
    const syncSession = async () => {
      const { data: { session } } = await supabaseApp.auth.getSession()

      if (!session) {
        clearSession()
        setHydrated()
        return
      }

      const meta = session.user.app_metadata ?? {}
      const localId: string | null = meta.local_id ?? null
      const plan: Plan | null = meta.plan ?? null
      const isOwner: boolean = meta.is_owner ?? true
      const rolSistema: RolSistema = isOwner ? 'owner' : (meta.rol ?? 'recepcionista')

      let nombreNegocio: string | null = null
      let onboardingCompleto = false
      let rubroOrg: RubroOrg | null = null

      if (localId) {
        const { data: cfg } = await supabaseApp
          .from('config_org')
          .select('nombre_negocio, onboarding_completo, rubro')
          .eq('org_id', localId)
          .maybeSingle()
        if (cfg) {
          nombreNegocio = cfg.nombre_negocio ?? null
          onboardingCompleto = cfg.onboarding_completo ?? false
          rubroOrg = cfg.rubro ?? null
        }
      }

      setSession({
        localId,
        plan,
        nombreNegocio,
        onboardingCompleto,
        rubroOrg,
        rol: isOwner ? 'owner' : 'colaborador',
        rolSistema,
        permisos: getPermisos(rolSistema),
        _hydrated: true,
      })
      setHydrated()
    }

    syncSession()

    const interval = setInterval(syncSession, 5 * 60 * 1000)

    const { data: { subscription } } = supabaseApp.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearSession()
        router.push('/login')
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        syncSession()
      }
    })

    return () => {
      clearInterval(interval)
      subscription.unsubscribe()
    }
  }, [])
}
