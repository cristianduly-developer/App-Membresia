import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ─── Datos demo por rubro ─────────────────────────────────────────────────────

const SOCIOS_BASE = [
  { nombre: 'Lucas',    apellido: 'Fernández', dni: '38123456', telefono: '2235001111', email: 'lucas.f@gmail.com',   fecha_nacimiento: '1992-03-15' },
  { nombre: 'Valentina',apellido: 'López',     dni: '40234567', telefono: '2235002222', email: 'vale.lopez@gmail.com', fecha_nacimiento: '1998-07-22' },
  { nombre: 'Martín',   apellido: 'García',    dni: '35345678', telefono: '2235003333', email: 'martin.g@gmail.com',  fecha_nacimiento: '1988-11-05' },
  { nombre: 'Sofía',    apellido: 'Rodríguez', dni: '42456789', telefono: '2235004444', email: 'sofi.rod@gmail.com',  fecha_nacimiento: '2001-04-18' },
  { nombre: 'Diego',    apellido: 'Martínez',  dni: '37567890', telefono: '2235005555', email: 'diego.m@gmail.com',   fecha_nacimiento: '1990-09-30' },
  { nombre: 'Camila',   apellido: 'González',  dni: '41678901', telefono: '2235006666', email: 'cami.gonz@gmail.com', fecha_nacimiento: '2000-01-12' },
  { nombre: 'Nicolás',  apellido: 'Pérez',     dni: '36789012', telefono: '2235007777', email: 'nico.p@gmail.com',    fecha_nacimiento: '1994-06-08' },
  { nombre: 'Julieta',  apellido: 'Sánchez',   dni: '43890123', telefono: '2235008888', email: 'juli.sanchez@gmail.com', fecha_nacimiento: '2003-12-25' },
]

const ACTIVIDADES_POR_RUBRO: Record<string, { nombre: string; dias: string[]; horario_inicio: string; horario_fin: string }[]> = {
  gimnasio: [
    { nombre: 'Musculación',  dias: ['lunes','martes','miercoles','jueves','viernes'], horario_inicio: '07:00', horario_fin: '22:00' },
    { nombre: 'Cardio',       dias: ['lunes','miercoles','viernes'],                   horario_inicio: '08:00', horario_fin: '09:00' },
    { nombre: 'Funcional',    dias: ['martes','jueves'],                               horario_inicio: '19:00', horario_fin: '20:00' },
  ],
  futbol: [
    { nombre: 'Fútbol Infantil (sub-8)',  dias: ['sabado'],                          horario_inicio: '09:00', horario_fin: '10:30' },
    { nombre: 'Fútbol Juvenil (sub-14)', dias: ['sabado'],                           horario_inicio: '11:00', horario_fin: '12:30' },
    { nombre: 'Fútbol Amateur',          dias: ['martes','jueves'],                  horario_inicio: '20:00', horario_fin: '21:30' },
  ],
  danza: [
    { nombre: 'Ballet Clásico',    dias: ['lunes','miercoles','viernes'], horario_inicio: '17:00', horario_fin: '18:30' },
    { nombre: 'Danza Contemporánea', dias: ['martes','jueves'],           horario_inicio: '18:00', horario_fin: '19:30' },
    { nombre: 'Folklore',          dias: ['sabado'],                      horario_inicio: '10:00', horario_fin: '11:30' },
  ],
  natatorio: [
    { nombre: 'Natación Adultos', dias: ['lunes','miercoles','viernes'], horario_inicio: '07:00', horario_fin: '08:00' },
    { nombre: 'Natación Bebés',   dias: ['martes','jueves'],             horario_inicio: '10:00', horario_fin: '11:00' },
    { nombre: 'Natación Infantil',dias: ['martes','jueves','sabado'],    horario_inicio: '16:00', horario_fin: '17:00' },
  ],
  artes_marciales: [
    { nombre: 'Karate',      dias: ['lunes','miercoles','viernes'], horario_inicio: '18:00', horario_fin: '19:30' },
    { nombre: 'Judo',        dias: ['martes','jueves'],             horario_inicio: '18:00', horario_fin: '19:30' },
    { nombre: 'Boxeo',       dias: ['lunes','miercoles','viernes'], horario_inicio: '20:00', horario_fin: '21:30' },
  ],
  tenis: [
    { nombre: 'Tenis Principiantes', dias: ['lunes','miercoles'],      horario_inicio: '09:00', horario_fin: '10:00' },
    { nombre: 'Tenis Intermedios',   dias: ['martes','jueves'],        horario_inicio: '18:00', horario_fin: '19:00' },
    { nombre: 'Pádel Adultos',       dias: ['viernes','sabado'],       horario_inicio: '19:00', horario_fin: '20:00' },
  ],
  cultural: [
    { nombre: 'Teatro',        dias: ['lunes','miercoles'],  horario_inicio: '19:00', horario_fin: '21:00' },
    { nombre: 'Guitarra',      dias: ['martes','jueves'],    horario_inicio: '17:00', horario_fin: '18:00' },
    { nombre: 'Pintura',       dias: ['sabado'],             horario_inicio: '10:00', horario_fin: '12:00' },
  ],
  otro: [
    { nombre: 'Actividad Principal', dias: ['lunes','miercoles','viernes'], horario_inicio: '09:00', horario_fin: '10:00' },
    { nombre: 'Taller Grupal',       dias: ['martes','jueves'],             horario_inicio: '18:00', horario_fin: '19:00' },
    { nombre: 'Clase Especial',      dias: ['sabado'],                      horario_inicio: '10:00', horario_fin: '11:00' },
  ],
}

const PROFESORES_POR_RUBRO: Record<string, { nombre: string; apellido: string }[]> = {
  gimnasio:        [{ nombre: 'Pablo', apellido: 'Ruiz' }, { nombre: 'Marina', apellido: 'Vega' }],
  futbol:          [{ nombre: 'Carlos', apellido: 'Ibáñez' }, { nombre: 'Roberto', apellido: 'Silva' }],
  danza:           [{ nombre: 'Florencia', apellido: 'Torres' }, { nombre: 'Agustina', apellido: 'Moreno' }],
  natatorio:       [{ nombre: 'Sebastián', apellido: 'Herrera' }, { nombre: 'Luciana', apellido: 'Castro' }],
  artes_marciales: [{ nombre: 'Sensei Jorge', apellido: 'Yamamoto' }, { nombre: 'Miguel', apellido: 'Ríos' }],
  tenis:           [{ nombre: 'Andrés', apellido: 'Medina' }, { nombre: 'Claudia', apellido: 'Reyes' }],
  cultural:        [{ nombre: 'Romina', apellido: 'Aguirre' }, { nombre: 'Pablo', apellido: 'Blanco' }],
  otro:            [{ nombre: 'Ana', apellido: 'Muñoz' }, { nombre: 'Juan', apellido: 'Díaz' }],
}

function diasAtras(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().split('T')[0]
}

function diasAdelante(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'no_auth' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: 'no_auth' }, { status: 401 })
  }

  const { org_id, rubro } = await req.json()
  if (!org_id || !rubro) {
    return NextResponse.json({ ok: false, error: 'faltan_datos' }, { status: 400 })
  }

  const actividadesTemplate = ACTIVIDADES_POR_RUBRO[rubro] ?? ACTIVIDADES_POR_RUBRO.otro
  const profesoresTemplate  = PROFESORES_POR_RUBRO[rubro]  ?? PROFESORES_POR_RUBRO.otro

  // Idempotencia: si ya hay socios para esta org, no generar de nuevo
  const { count } = await supabaseAdmin
    .from('socios')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org_id)
  if ((count ?? 0) > 0) return NextResponse.json({ ok: true, ya_existe: true })

  // 1. Crear profesores
  const { data: profesores } = await supabaseAdmin
    .from('profesores')
    .insert(profesoresTemplate.map(p => ({ ...p, org_id, telefono: '2235009999', email: `${p.nombre.toLowerCase()}@socioapp.com` })))
    .select('id')

  const profIds = (profesores ?? []).map(p => p.id)

  // 2. Crear actividades
  const { data: actividades } = await supabaseAdmin
    .from('actividades')
    .insert(actividadesTemplate.map((a, i) => ({
      ...a,
      org_id,
      cupo_maximo: 20,
      profesor_id: profIds[i % profIds.length] ?? null,
    })))
    .select('id')

  const actIds = (actividades ?? []).map(a => a.id)

  // 3. Crear socios
  const { data: socios } = await supabaseAdmin
    .from('socios')
    .insert(SOCIOS_BASE.map(s => ({ ...s, org_id, estado: 'activo' })))
    .select('id')

  const socioIds = (socios ?? []).map(s => s.id)
  if (socioIds.length === 0) return NextResponse.json({ ok: true })

  // 4. Crear membresías con distintos estados
  const estadosMembresia = [
    { inicio: diasAtras(20), fin: diasAdelante(8),  estado: 'activa' },     // próxima a vencer
    { inicio: diasAtras(30), fin: diasAdelante(0),  estado: 'vencida' },    // vencida hoy
    { inicio: diasAtras(5),  fin: diasAdelante(25), estado: 'activa' },
    { inicio: diasAtras(10), fin: diasAdelante(20), estado: 'activa' },
    { inicio: diasAtras(60), fin: diasAtras(30),    estado: 'vencida' },    // vencida hace 30 días
    { inicio: diasAtras(3),  fin: diasAdelante(27), estado: 'activa' },
    { inicio: diasAtras(15), fin: diasAdelante(15), estado: 'activa' },
    { inicio: diasAtras(8),  fin: diasAdelante(22), estado: 'activa' },
  ]

  const membresiasData = socioIds.map((socioId, i) => ({
    org_id,
    socio_id: socioId,
    tipo: i % 3 === 0 ? 'trimestral' : 'mensual',
    precio: i % 3 === 0 ? 18000 : 8000,
    fecha_inicio: estadosMembresia[i % estadosMembresia.length].inicio,
    fecha_vencimiento: estadosMembresia[i % estadosMembresia.length].fin,
    estado: estadosMembresia[i % estadosMembresia.length].estado,
    actividades_ids: [actIds[i % actIds.length]],
  }))

  const { data: membresias } = await supabaseAdmin
    .from('membresias')
    .insert(membresiasData)
    .select('id')

  // 5. Crear cobros
  const cobrosData = socioIds.map((socioId, i) => ({
    org_id,
    socio_id: socioId,
    membresia_id: membresias?.[i]?.id ?? null,
    monto: i % 3 === 0 ? 18000 : 8000,
    metodo_pago: ['efectivo','transferencia','debito'][i % 3],
    estado: 'cobrado',
    fecha: diasAtras(i * 3),
    concepto: 'Cuota mensual',
  }))

  await supabaseAdmin.from('cobros').insert(cobrosData)

  // 6. Crear asistencias últimos 15 días (socios activos)
  const asistenciasData: object[] = []
  const sociosActivos = socioIds.slice(0, 6)
  for (let dia = 0; dia < 15; dia++) {
    const fecha = diasAtras(dia)
    sociosActivos.forEach((socioId, i) => {
      // Simular que algunos socios faltaron (socio index 4 hace 15 días que no viene → anti-churn)
      if (i === 4 && dia < 15) return
      if (i === 5 && dia < 7) return
      if (Math.random() > 0.3) {
        asistenciasData.push({
          org_id,
          socio_id: socioId,
          actividad_id: actIds[i % actIds.length] ?? null,
          fecha,
          modo: dia < 3 ? 'qr' : 'manual',
        })
      }
    })
  }

  if (asistenciasData.length > 0) {
    await supabaseAdmin.from('asistencias').insert(asistenciasData)
  }

  return NextResponse.json({ ok: true })
}
