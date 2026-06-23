export type RolSistema = 'owner' | 'recepcionista' | 'profesor'

export interface Permisos {
  verDashboard: boolean
  verSocios: boolean
  editarSocios: boolean
  verActividades: boolean
  editarActividades: boolean
  verMembresias: boolean
  editarMembresias: boolean
  verCobros: boolean
  registrarCobros: boolean
  verCheckin: boolean
  verAsistencias: boolean
  verProfesores: boolean
  editarProfesores: boolean
  verLiquidaciones: boolean
  verCaja: boolean
  verRentabilidad: boolean
  verConfig: boolean
  verColaboradores: boolean
  verReportes: boolean
}

const PERMISOS_POR_ROL: Record<RolSistema, Permisos> = {
  owner: {
    verDashboard: true,
    verSocios: true,
    editarSocios: true,
    verActividades: true,
    editarActividades: true,
    verMembresias: true,
    editarMembresias: true,
    verCobros: true,
    registrarCobros: true,
    verCheckin: true,
    verAsistencias: true,
    verProfesores: true,
    editarProfesores: true,
    verLiquidaciones: true,
    verCaja: true,
    verRentabilidad: true,
    verConfig: true,
    verColaboradores: true,
    verReportes: true,
  },
  recepcionista: {
    verDashboard: true,
    verSocios: true,
    editarSocios: false,
    verActividades: true,
    editarActividades: false,
    verMembresias: true,
    editarMembresias: false,
    verCobros: true,
    registrarCobros: true,
    verCheckin: true,
    verAsistencias: true,
    verProfesores: false,
    editarProfesores: false,
    verLiquidaciones: false,
    verCaja: false,
    verRentabilidad: false,
    verConfig: false,
    verColaboradores: false,
    verReportes: false,
  },
  profesor: {
    verDashboard: false,
    verSocios: false,
    editarSocios: false,
    verActividades: true,
    editarActividades: false,
    verMembresias: false,
    editarMembresias: false,
    verCobros: false,
    registrarCobros: false,
    verCheckin: false,
    verAsistencias: true,
    verProfesores: false,
    editarProfesores: false,
    verLiquidaciones: true,
    verCaja: false,
    verRentabilidad: false,
    verConfig: false,
    verColaboradores: false,
    verReportes: false,
  },
}

export function getPermisos(rol: RolSistema): Permisos {
  return PERMISOS_POR_ROL[rol]
}
