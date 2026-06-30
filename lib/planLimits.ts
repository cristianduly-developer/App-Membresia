export type Plan = 'basico' | 'profesional' | 'premium' | 'sincargo'

export interface PlanLimits {
  maxSocios: number | null        // null = ilimitado
  maxActividades: number | null
  maxColaboradores: number        // 0 = sin multiusuario
  usaAptoMedico: boolean
  usaProfesores: boolean
  usaLiquidaciones: boolean
  usaAlertaDesercion: boolean
  usaReportesAvanzados: boolean
  usaCierreCaja: boolean
}

export interface PlanInfo extends PlanLimits {
  nombre: string
  precio: number                  // ARS/mes
}

export const PLAN_INFO: Record<Exclude<Plan, 'sincargo'>, PlanInfo> = {
  basico: {
    nombre: 'Básico',
    precio: 25000,
    maxSocios: 100,
    maxActividades: 3,
    maxColaboradores: 0,
    usaAptoMedico: false,
    usaProfesores: false,
    usaLiquidaciones: false,
    usaAlertaDesercion: false,
    usaReportesAvanzados: false,
    usaCierreCaja: true,
  },
  profesional: {
    nombre: 'Profesional',
    precio: 35000,
    maxSocios: 300,
    maxActividades: null,
    maxColaboradores: 2,
    usaAptoMedico: true,
    usaProfesores: true,
    usaLiquidaciones: true,
    usaAlertaDesercion: true,
    usaReportesAvanzados: false,
    usaCierreCaja: true,
  },
  premium: {
    nombre: 'Premium',
    precio: 50000,
    maxSocios: null,
    maxActividades: null,
    maxColaboradores: 5,
    usaAptoMedico: true,
    usaProfesores: true,
    usaLiquidaciones: true,
    usaAlertaDesercion: true,
    usaReportesAvanzados: true,
    usaCierreCaja: true,
  },
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  basico: {
    maxSocios: 100,
    maxActividades: 3,
    maxColaboradores: 0,
    usaAptoMedico: false,
    usaProfesores: false,
    usaLiquidaciones: false,
    usaAlertaDesercion: false,
    usaReportesAvanzados: false,
    usaCierreCaja: true,
  },
  profesional: {
    maxSocios: 300,
    maxActividades: null,
    maxColaboradores: 2,
    usaAptoMedico: true,
    usaProfesores: true,
    usaLiquidaciones: true,
    usaAlertaDesercion: true,
    usaReportesAvanzados: false,
    usaCierreCaja: true,
  },
  premium: {
    maxSocios: null,
    maxActividades: null,
    maxColaboradores: 5,
    usaAptoMedico: true,
    usaProfesores: true,
    usaLiquidaciones: true,
    usaAlertaDesercion: true,
    usaReportesAvanzados: true,
    usaCierreCaja: true,
  },
  sincargo: {
    maxSocios: 300,
    maxActividades: null,
    maxColaboradores: 2,
    usaAptoMedico: true,
    usaProfesores: true,
    usaLiquidaciones: true,
    usaAlertaDesercion: true,
    usaReportesAvanzados: false,
    usaCierreCaja: true,
  },
}

export function getLimites(plan: Plan | null): PlanLimits {
  return PLAN_LIMITS[plan ?? 'basico'] ?? PLAN_LIMITS.basico
}
