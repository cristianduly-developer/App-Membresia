import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const SOCIOS_BASE = [
  { nombre: 'Lucas',      apellido: 'Fernández',  dni: '38123456', telefono: '2235001111', email: 'lucas.f@gmail.com',        fecha_nacimiento: '1992-03-15' },
  { nombre: 'Valentina',  apellido: 'López',       dni: '40234567', telefono: '2235002222', email: 'vale.lopez@gmail.com',      fecha_nacimiento: '1998-07-22' },
  { nombre: 'Martín',     apellido: 'García',      dni: '35345678', telefono: '2235003333', email: 'martin.g@gmail.com',       fecha_nacimiento: '1988-11-05' },
  { nombre: 'Sofía',      apellido: 'Rodríguez',   dni: '42456789', telefono: '2235004444', email: 'sofi.rod@gmail.com',       fecha_nacimiento: '2001-04-18' },
  { nombre: 'Diego',      apellido: 'Martínez',    dni: '37567890', telefono: '2235005555', email: 'diego.m@gmail.com',        fecha_nacimiento: '1990-09-30' },
  { nombre: 'Camila',     apellido: 'González',    dni: '41678901', telefono: '2235006666', email: 'cami.gonz@gmail.com',      fecha_nacimiento: '2000-01-12' },
  { nombre: 'Nicolás',    apellido: 'Pérez',       dni: '36789012', telefono: '2235007777', email: 'nico.p@gmail.com',         fecha_nacimiento: '1994-06-08' },
  { nombre: 'Julieta',    apellido: 'Sánchez',     dni: '43890123', telefono: '2235008888', email: 'juli.sanchez@gmail.com',   fecha_nacimiento: '2003-12-25' },
  { nombre: 'Tomás',      apellido: 'Herrera',     dni: '39001234', telefono: '2235009991', email: 'tomas.h@gmail.com',        fecha_nacimiento: '1995-08-14' },
  { nombre: 'Agustina',   apellido: 'Moreno',      dni: '44112345', telefono: '2235009992', email: 'agus.moreno@gmail.com',    fecha_nacimiento: '2002-05-30' },
  { nombre: 'Facundo',    apellido: 'Torres',      dni: '37223456', telefono: '2235009993', email: 'facu.torres@gmail.com',    fecha_nacimiento: '1991-02-17' },
  { nombre: 'Lucía',      apellido: 'Ramírez',     dni: '45334567', telefono: '2235009994', email: 'luci.ramirez@gmail.com',   fecha_nacimiento: '2004-09-03' },
  { nombre: 'Rodrigo',    apellido: 'Vega',        dni: '36445678', telefono: '2235009995', email: 'rodri.vega@gmail.com',     fecha_nacimiento: '1989-12-22' },
  { nombre: 'Florencia',  apellido: 'Castro',      dni: '43556789', telefono: '2235009996', email: 'flor.castro@gmail.com',    fecha_nacimiento: '2000-07-09' },
  { nombre: 'Matías',     apellido: 'Ruiz',        dni: '38667890', telefono: '2235009997', email: 'mati.ruiz@gmail.com',      fecha_nacimiento: '1993-04-25' },
  { nombre: 'Antonella',  apellido: 'Ibáñez',      dni: '46778901', telefono: '2235009998', email: 'anto.ibanez@gmail.com',    fecha_nacimiento: '2005-11-11' },
  { nombre: 'Sebastián',  apellido: 'Medina',      dni: '35889012', telefono: '2235009981', email: 'seba.medina@gmail.com',    fecha_nacimiento: '1987-06-19' },
  { nombre: 'Carolina',   apellido: 'Silva',       dni: '42990123', telefono: '2235009982', email: 'caro.silva@gmail.com',     fecha_nacimiento: '1999-03-07' },
  { nombre: 'Ezequiel',   apellido: 'Aguirre',     dni: '40101234', telefono: '2235009983', email: 'eze.aguirre@gmail.com',    fecha_nacimiento: '1996-10-14' },
  { nombre: 'Micaela',    apellido: 'Blanco',      dni: '47212345', telefono: '2235009984', email: 'mica.blanco@gmail.com',    fecha_nacimiento: '2006-01-28' },
  { nombre: 'Ignacio',    apellido: 'Ríos',        dni: '36323456', telefono: '2235009985', email: 'nacho.rios@gmail.com',     fecha_nacimiento: '1986-08-31' },
  { nombre: 'Natalia',    apellido: 'Muñoz',       dni: '44434567', telefono: '2235009986', email: 'nati.munoz@gmail.com',     fecha_nacimiento: '2001-06-15' },
  { nombre: 'Leandro',    apellido: 'Vargas',      dni: '37545678', telefono: '2235009987', email: 'lean.vargas@gmail.com',    fecha_nacimiento: '1992-11-02' },
  { nombre: 'Bianca',     apellido: 'Acosta',      dni: '45656789', telefono: '2235009988', email: 'bianca.acosta@gmail.com',  fecha_nacimiento: '2003-04-21' },
]

const ACTIVIDADES_POR_RUBRO: Record<string, { nombre: string; dias: string[]; horario_inicio: string; horario_fin: string }[]> = {
  gimnasio: [
    { nombre: 'Musculación',  dias: ['lunes','martes','miercoles','jueves','viernes'], horario_inicio: '07:00', horario_fin: '22:00' },
    { nombre: 'Cardio',       dias: ['lunes','miercoles','viernes'],                   horario_inicio: '08:00', horario_fin: '09:00' },
    { nombre: 'Funcional',    dias: ['martes','jueves'],                               horario_inicio: '19:00', horario_fin: '20:00' },
  ],
  futbol: [
    { nombre: 'Fútbol Infantil (sub-8)',  dias: ['sabado'],           horario_inicio: '09:00', horario_fin: '10:30' },
    { nombre: 'Fútbol Juvenil (sub-14)', dias: ['sabado'],            horario_inicio: '11:00', horario_fin: '12:30' },
    { nombre: 'Fútbol Amateur',          dias: ['martes','jueves'],   horario_inicio: '20:00', horario_fin: '21:30' },
  ],
  danza: [
    { nombre: 'Ballet Clásico',       dias: ['lunes','miercoles','viernes'], horario_inicio: '17:00', horario_fin: '18:30' },
    { nombre: 'Danza Contemporánea',  dias: ['martes','jueves'],             horario_inicio: '18:00', horario_fin: '19:30' },
    { nombre: 'Folklore',             dias: ['sabado'],                      horario_inicio: '10:00', horario_fin: '11:30' },
  ],
  natatorio: [
    { nombre: 'Natación Adultos',  dias: ['lunes','miercoles','viernes'], horario_inicio: '07:00', horario_fin: '08:00' },
    { nombre: 'Natación Bebés',    dias: ['martes','jueves'],             horario_inicio: '10:00', horario_fin: '11:00' },
    { nombre: 'Natación Infantil', dias: ['martes','jueves','sabado'],    horario_inicio: '16:00', horario_fin: '17:00' },
  ],
  artes_marciales: [
    { nombre: 'Karate', dias: ['lunes','miercoles','viernes'], horario_inicio: '18:00', horario_fin: '19:30' },
    { nombre: 'Judo',   dias: ['martes','jueves'],             horario_inicio: '18:00', horario_fin: '19:30' },
    { nombre: 'Boxeo',  dias: ['lunes','miercoles','viernes'], horario_inicio: '20:00', horario_fin: '21:30' },
  ],
  tenis: [
    { nombre: 'Tenis Principiantes', dias: ['lunes','miercoles'],  horario_inicio: '09:00', horario_fin: '10:00' },
    { nombre: 'Tenis Intermedios',   dias: ['martes','jueves'],    horario_inicio: '18:00', horario_fin: '19:00' },
    { nombre: 'Pádel Adultos',       dias: ['viernes','sabado'],   horario_inicio: '19:00', horario_fin: '20:00' },
  ],
  cultural: [
    { nombre: 'Teatro',    dias: ['lunes','miercoles'], horario_inicio: '19:00', horario_fin: '21:00' },
    { nombre: 'Guitarra',  dias: ['martes','jueves'],   horario_inicio: '17:00', horario_fin: '18:00' },
    { nombre: 'Pintura',   dias: ['sabado'],            horario_inicio: '10:00', horario_fin: '12:00' },
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

  // Idempotencia
  const { count } = await supabaseAdmin
    .from('socios')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org_id)
  if ((count ?? 0) > 0) return NextResponse.json({ ok: true, ya_existe: true })

  // 1. Profesores
  const { data: profesores } = await supabaseAdmin
    .from('profesores')
    .insert(profesoresTemplate.map(p => ({
      ...p,
      org_id,
      telefono: '2235009999',
      email: `${p.nombre.toLowerCase().replace(' ', '.')}@socioapp.com`,
    })))
    .select('id')

  const profIds = (profesores ?? []).map(p => p.id)

  // 2. Actividades
  const { data: actividades } = await supabaseAdmin
    .from('actividades')
    .insert(actividadesTemplate.map((a, i) => ({
      ...a,
      org_id,
      cupo_maximo: 25,
      profesor_id: profIds[i % profIds.length] ?? null,
    })))
    .select('id')

  const actIds = (actividades ?? []).map(a => a.id)

  // 3. Socios — 24 socios
  const { data: socios } = await supabaseAdmin
    .from('socios')
    .insert(SOCIOS_BASE.map(s => ({ ...s, org_id, estado: 'activo' })))
    .select('id')

  const socioIds = (socios ?? []).map(s => s.id)
  if (socioIds.length === 0) return NextResponse.json({ ok: true })

  // 4. Membresías — variedad de estados para que el dashboard se vea completo
  //    20 activas, 2 próximas a vencer, 2 vencidas
  const membresiasData = socioIds.map((socioId, i) => {
    let inicio: string, fin: string, estado: string
    if (i < 16) {
      // Activas con distintas fechas (algunas recientes, otras a la mitad)
      const offset = (i % 4) * 7
      inicio = diasAtras(offset + 5)
      fin    = diasAdelante(25 - offset)
      estado = 'activa'
    } else if (i < 20) {
      // Próximas a vencer (menos de 7 días)
      inicio = diasAtras(23)
      fin    = diasAdelante(i - 18)   // 1-3 días
      estado = 'activa'
    } else if (i < 23) {
      // Vencidas
      inicio = diasAtras(35)
      fin    = diasAtras(5)
      estado = 'vencida'
    } else {
      // Trimestral activa
      inicio = diasAtras(10)
      fin    = diasAdelante(80)
      estado = 'activa'
    }

    const esTrimes = i % 5 === 0
    return {
      org_id,
      socio_id: socioId,
      tipo: esTrimes ? 'trimestral' : 'mensual',
      precio: esTrimes ? 22000 : 9500,
      fecha_inicio: inicio,
      fecha_vencimiento: fin,
      estado,
      actividades_ids: [actIds[i % actIds.length]],
    }
  })

  const { data: membresias } = await supabaseAdmin
    .from('membresias')
    .insert(membresiasData)
    .select('id')

  // 5. Cobros — este mes y el anterior para que los totales se vean bien
  const cobrosData: object[] = []
  socioIds.forEach((socioId, i) => {
    // Cobro del mes actual
    cobrosData.push({
      org_id,
      socio_id: socioId,
      membresia_id: membresias?.[i]?.id ?? null,
      monto: i % 5 === 0 ? 22000 : 9500,
      metodo_pago: ['efectivo', 'transferencia', 'debito', 'credito'][i % 4],
      estado: 'cobrado',
      fecha: diasAtras(Math.floor(Math.random() * 20)),
      concepto: 'Cuota mensual',
    })
    // Cobro del mes anterior (para que haya historial)
    cobrosData.push({
      org_id,
      socio_id: socioId,
      membresia_id: membresias?.[i]?.id ?? null,
      monto: i % 5 === 0 ? 22000 : 9500,
      metodo_pago: ['efectivo', 'transferencia', 'debito', 'credito'][i % 4],
      estado: 'cobrado',
      fecha: diasAtras(30 + Math.floor(Math.random() * 10)),
      concepto: 'Cuota mensual',
    })
  })

  await supabaseAdmin.from('cobros').insert(cobrosData)

  // 6. Asistencias — 30 días de historia, alta concurrencia para que el dashboard luzca
  const asistenciasData: object[] = []
  for (let dia = 0; dia < 30; dia++) {
    const fecha = diasAtras(dia)
    socioIds.forEach((socioId, i) => {
      // Socios vencidos (últimos 3) no asisten
      if (i >= 20) return
      // Alta asistencia: 80% de probabilidad cada día
      if (Math.random() < 0.8) {
        asistenciasData.push({
          org_id,
          socio_id: socioId,
          actividad_id: actIds[i % actIds.length] ?? null,
          fecha,
          modo: dia < 5 ? 'qr' : 'manual',
        })
      }
    })
  }

  if (asistenciasData.length > 0) {
    await supabaseAdmin.from('asistencias').insert(asistenciasData)
  }

  return NextResponse.json({ ok: true })
}
