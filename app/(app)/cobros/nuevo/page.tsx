'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Socio {
  id: string
  nombre: string
  apellido: string
  foto_url: string | null
  membresia?: {
    id: string
    tipo: string
    precio: number
    fecha_vencimiento: string
  } | null
}

const METODOS = [
  { key: 'efectivo', label: 'Efectivo', icon: '💵' },
  { key: 'transferencia', label: 'Transferencia', icon: '📲' },
  { key: 'debito', label: 'Débito', icon: '💳' },
  { key: 'credito', label: 'Crédito', icon: '💳' },
]

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha)
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

function NuevoCobroInner() {
  const { localId } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const socioParam = searchParams.get('socio')

  const [socios, setSocios] = useState<Socio[]>([])
  const [socioSeleccionado, setSocioSeleccionado] = useState<Socio | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarSelector, setMostrarSelector] = useState(!socioParam)

  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  const [concepto, setConcepto] = useState('Cuota mensual')
  const [renovarMembresia, setRenovarMembresia] = useState(true)

  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!localId) return
    cargarSocios()
  }, [localId])

  const cargarSocios = async () => {
    const { data } = await supabaseApp
      .from('socios')
      .select(`
        id, nombre, apellido, foto_url,
        membresias(id, tipo, precio, fecha_vencimiento, estado)
      `)
      .eq('org_id', localId)
      .eq('estado', 'activo')
      .order('apellido')

    const sociosConMemb = (data ?? []).map((s: any) => ({
      ...s,
      membresia: s.membresias?.find((m: any) => ['activa','proxima_vencer','vencida'].includes(m.estado))
        ?? s.membresias?.[0] ?? null,
    })) as Socio[]

    setSocios(sociosConMemb)

    if (socioParam) {
      const encontrado = sociosConMemb.find(s => s.id === socioParam)
      if (encontrado) seleccionarSocio(encontrado)
    }
  }

  const seleccionarSocio = (s: Socio) => {
    setSocioSeleccionado(s)
    setMostrarSelector(false)
    if (s.membresia?.precio) {
      setMonto(s.membresia.precio.toString())
    }
  }

  const cobrar = async () => {
    if (!socioSeleccionado) { setError('Seleccioná un socio'); return }
    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) { setError('Ingresá un monto válido'); return }
    setGuardando(true)
    setError(null)

    const hoy = new Date().toISOString().split('T')[0]
    const memb = socioSeleccionado.membresia

    // Calcular nuevo vencimiento para el cobro
    let nuevaFechaVenc = hoy
    if (memb) {
      const base = memb.fecha_vencimiento > hoy ? memb.fecha_vencimiento : hoy
      const dias = memb.tipo === 'trimestral' ? 90 : memb.tipo === 'semestral' ? 180 : memb.tipo === 'anual' ? 365 : 30
      nuevaFechaVenc = sumarDias(base, dias)
    }

    const { error: err } = await supabaseApp.from('cobros').insert({
      org_id: localId,
      socio_id: socioSeleccionado.id,
      membresia_id: memb?.id ?? null,
      monto: parseFloat(monto),
      metodo,
      estado: 'pagado',
      fecha_pago: hoy,
      fecha_vencimiento: nuevaFechaVenc,
      concepto,
    })

    if (err) { setError(err.message); setGuardando(false); return }

    // Renovar membresía automáticamente si corresponde
    if (renovarMembresia && memb?.id) {
      await supabaseApp.from('membresias').update({
        fecha_vencimiento: nuevaFechaVenc,
        estado: 'activa',
      }).eq('id', memb.id)
    }

    setExito(true)
    setGuardando(false)
  }

  // Pantalla de éxito
  if (exito) return (
    <RouteGuard permiso="registrarCobros">
      <div className="max-w-sm mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
          <span className="text-5xl">✅</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">¡Cobro registrado!</h2>
          <p className="text-gray-400">
            ${Number(monto).toLocaleString('es-AR')} · {metodo}
          </p>
          {socioSeleccionado && (
            <p className="text-gray-500 text-sm mt-1">
              {socioSeleccionado.nombre} {socioSeleccionado.apellido}
            </p>
          )}
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={() => {
              setSocioSeleccionado(null)
              setMostrarSelector(true)
              setMonto('')
              setExito(false)
            }}
            className="flex-1 py-3 rounded-xl bg-gray-800 text-white font-semibold text-sm"
          >
            Otro cobro
          </button>
          <button
            onClick={() => socioParam
              ? router.push(`/socios/${socioParam}`)
              : router.push('/cobros')
            }
            className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm"
          >
            Listo
          </button>
        </div>
      </div>
    </RouteGuard>
  )

  const sociosFiltrados = socios.filter(s => {
    const q = busqueda.toLowerCase()
    return !q || s.nombre.toLowerCase().includes(q) || s.apellido.toLowerCase().includes(q)
  })

  return (
    <RouteGuard permiso="registrarCobros">
      <div className="max-w-lg mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-2xl leading-none">‹</button>
          <h1 className="text-xl font-bold text-white">Registrar cobro</h1>
        </div>

        {/* Paso 1: Socio */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs block mb-2">Socio</label>
          {socioSeleccionado && !mostrarSelector ? (
            <button
              onClick={() => setMostrarSelector(true)}
              className="w-full bg-gray-900 border border-violet-700 rounded-2xl p-4 flex items-center gap-3 text-left"
            >
              <div className="w-12 h-12 rounded-full bg-violet-900 flex items-center justify-center shrink-0 overflow-hidden">
                {socioSeleccionado.foto_url
                  ? <img src={socioSeleccionado.foto_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-violet-300 font-bold text-lg">
                      {socioSeleccionado.nombre[0]}{socioSeleccionado.apellido[0]}
                    </span>
                }
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-lg">{socioSeleccionado.nombre} {socioSeleccionado.apellido}</p>
                {socioSeleccionado.membresia && (
                  <p className="text-violet-400 text-sm capitalize">{socioSeleccionado.membresia.tipo}</p>
                )}
              </div>
              <span className="text-gray-500 text-sm">cambiar</span>
            </button>
          ) : (
            <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
              <div className="p-3 border-b border-gray-800">
                <input
                  autoFocus
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar socio..."
                  className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
                />
              </div>
              <div className="max-h-52 overflow-y-auto">
                {sociosFiltrados.slice(0, 20).map(s => (
                  <button
                    key={s.id}
                    onClick={() => seleccionarSocio(s)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-violet-900 flex items-center justify-center shrink-0">
                      <span className="text-violet-300 font-bold text-sm">{s.nombre[0]}{s.apellido[0]}</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{s.apellido}, {s.nombre}</p>
                      {s.membresia && (
                        <p className="text-gray-500 text-xs capitalize">
                          {s.membresia.tipo} · ${s.membresia.precio.toLocaleString('es-AR')}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Paso 2: Monto */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs block mb-2">Monto</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold">$</span>
            <input
              type="number"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              placeholder="0"
              className="w-full bg-gray-900 border border-gray-700 rounded-2xl pl-9 pr-4 py-4 text-white text-2xl font-bold placeholder-gray-700 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Paso 2b: Método de pago — 4 botones grandes */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs block mb-2">Método de pago</label>
          <div className="grid grid-cols-2 gap-2">
            {METODOS.map(m => (
              <button
                key={m.key}
                onClick={() => setMetodo(m.key)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition font-medium text-sm
                  ${metodo === m.key
                    ? 'border-violet-500 bg-violet-900/30 text-white'
                    : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'}`}
              >
                <span className="text-xl">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Concepto */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs block mb-2">Concepto</label>
          <input
            value={concepto}
            onChange={e => setConcepto(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Renovar membresía toggle */}
        {socioSeleccionado?.membresia && (
          <button
            onClick={() => setRenovarMembresia(r => !r)}
            className="w-full flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl p-3.5 mb-5 text-sm"
          >
            <span className="text-gray-300">Renovar membresía automáticamente</span>
            <div className={`w-10 h-6 rounded-full transition-colors ${renovarMembresia ? 'bg-violet-600' : 'bg-gray-700'}`}>
              <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-transform ${renovarMembresia ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </div>
          </button>
        )}

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        {/* Botón cobrar */}
        <button
          onClick={cobrar}
          disabled={guardando || !socioSeleccionado || !monto}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-5 rounded-2xl text-xl transition"
        >
          {guardando ? 'Procesando...' : `💰 Cobrar${monto ? ' $' + Number(monto).toLocaleString('es-AR') : ''}`}
        </button>

      </div>
    </RouteGuard>
  )
}

export default function NuevoCobroPage() {
  return (
    <Suspense>
      <NuevoCobroInner />
    </Suspense>
  )
}
