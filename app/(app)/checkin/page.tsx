'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface ResultadoCheckin {
  socioId: string
  nombre: string
  apellido: string
  foto_url: string | null
  estadoMembresia: 'activa' | 'proxima_vencer' | 'vencida' | 'sin_membresia' | 'congelada'
  diasRestantes: number | null
  actividad: string | null
  yaRegistrado: boolean
}

function calcularDias(fecha: string): number {
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
}

export default function CheckinPage() {
  const { localId } = useSession()
  const router = useRouter()

  const [modo, setModo] = useState<'scan' | 'manual'>('scan')
  const [busqueda, setBusqueda] = useState('')
  const [socios, setSocios] = useState<{ id: string; nombre: string; apellido: string }[]>([])
  const [resultado, setResultado] = useState<ResultadoCheckin | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [scannerActivo, setScannerActivo] = useState(false)
  const [errorCamara, setErrorCamara] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<any>(null)
  const activeRef = useRef(false)

  const detenerScanner = useCallback(() => {
    activeRef.current = false
    if (readerRef.current) {
      try { readerRef.current.reset() } catch {}
      readerRef.current = null
    }
    setScannerActivo(false)
  }, [])

  const iniciarScanner = useCallback(async () => {
    if (activeRef.current) return
    activeRef.current = true
    setErrorCamara(false)
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const reader = new BrowserQRCodeReader()
      readerRef.current = reader
      setScannerActivo(true)
      const result = await reader.decodeOnceFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!
      )
      if (!activeRef.current) return
      detenerScanner()
      procesarCheckin(result.getText())
    } catch (err: any) {
      if (!activeRef.current) return
      console.error('[QR] Error:', err)
      setErrorCamara(true)
      setScannerActivo(false)
    }
  }, [detenerScanner])

  useEffect(() => {
    return () => { detenerScanner() }
  }, [detenerScanner])

  useEffect(() => {
    if (modo === 'scan' && !resultado) {
      iniciarScanner()
    } else {
      detenerScanner()
    }
  }, [modo, resultado])

  const procesarCheckin = async (socioId: string) => {
    if (!localId || procesando) return
    setProcesando(true)

    const [{ data: socio }, { data: membresias }] = await Promise.all([
      supabaseApp.from('socios').select('id, nombre, apellido, foto_url').eq('id', socioId).eq('org_id', localId).single(),
      supabaseApp.from('membresias').select('estado, fecha_vencimiento, actividades_ids').eq('socio_id', socioId).eq('org_id', localId).order('fecha_vencimiento', { ascending: false }).limit(1),
    ])

    if (!socio) {
      setProcesando(false)
      return
    }

    // Verificar si ya hizo check-in hoy
    const hoy = new Date().toISOString().split('T')[0]
    const { data: asistHoy } = await supabaseApp
      .from('asistencias')
      .select('id')
      .eq('socio_id', socioId)
      .eq('org_id', localId)
      .eq('fecha', hoy)
      .limit(1)

    const yaRegistrado = (asistHoy?.length ?? 0) > 0

    const membresia = membresias?.[0] ?? null
    let estadoMembresia: ResultadoCheckin['estadoMembresia'] = 'sin_membresia'
    let diasRestantes: number | null = null

    if (membresia) {
      estadoMembresia = membresia.estado as any
      diasRestantes = calcularDias(membresia.fecha_vencimiento)
      if (diasRestantes < 0) estadoMembresia = 'vencida'
      else if (diasRestantes <= 7) estadoMembresia = 'proxima_vencer'
      else estadoMembresia = 'activa'
    }

    // Registrar asistencia si membresía activa y no registrado hoy
    if (!yaRegistrado && (estadoMembresia === 'activa' || estadoMembresia === 'proxima_vencer')) {
      await supabaseApp.from('asistencias').insert({
        org_id: localId,
        socio_id: socioId,
        actividad_id: membresia?.actividades_ids?.[0] ?? null,
        fecha: hoy,
        modo: 'qr',
      })
    }

    // Obtener nombre de actividad
    let actividad: string | null = null
    if (membresia?.actividades_ids?.[0]) {
      const { data: act } = await supabaseApp
        .from('actividades')
        .select('nombre')
        .eq('id', membresia.actividades_ids[0])
        .single()
      actividad = act?.nombre ?? null
    }

    setResultado({
      socioId,
      nombre: socio.nombre,
      apellido: socio.apellido,
      foto_url: socio.foto_url,
      estadoMembresia,
      diasRestantes,
      actividad,
      yaRegistrado,
    })
    setProcesando(false)
  }

  const buscarSocio = async (q: string) => {
    setBusqueda(q)
    if (!q.trim() || !localId) { setSocios([]); return }
    const { data } = await supabaseApp
      .from('socios')
      .select('id, nombre, apellido')
      .eq('org_id', localId)
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%`)
      .limit(8)
    setSocios((data ?? []) as any)
  }

  const resetear = () => {
    setResultado(null)
    setBusqueda('')
    setSocios([])
    setProcesando(false)
  }

  // ─── Pantalla de resultado ────────────────────────────────────────────────
  if (resultado) {
    const config: Record<ResultadoCheckin['estadoMembresia'], {
      bg: string; border: string; icon: string; titulo: string; subtitulo: string
    }> = {
      activa: {
        bg: 'bg-green-950',
        border: 'border-green-500',
        icon: '✅',
        titulo: 'ACCESO OK',
        subtitulo: resultado.diasRestantes !== null
          ? `Membresía vence en ${resultado.diasRestantes} días`
          : 'Membresía activa',
      },
      proxima_vencer: {
        bg: 'bg-yellow-950',
        border: 'border-yellow-500',
        icon: '⚠️',
        titulo: 'PRÓXIMO A VENCER',
        subtitulo: `Vence en ${resultado.diasRestantes} días`,
      },
      vencida: {
        bg: 'bg-red-950',
        border: 'border-red-500',
        icon: '🚫',
        titulo: 'MEMBRESÍA VENCIDA',
        subtitulo: 'Debe renovar para acceder',
      },
      congelada: {
        bg: 'bg-blue-950',
        border: 'border-blue-500',
        icon: '❄️',
        titulo: 'MEMBRESÍA CONGELADA',
        subtitulo: 'Contactar al responsable',
      },
      sin_membresia: {
        bg: 'bg-red-950',
        border: 'border-red-500',
        icon: '❌',
        titulo: 'SIN MEMBRESÍA',
        subtitulo: 'No tiene membresía registrada',
      },
    }

    const c = config[resultado.estadoMembresia]

    return (
      <RouteGuard permiso="verCheckin">
        <div className={`fixed inset-0 ${c.bg} flex flex-col items-center justify-center p-6 z-50`}>

          {/* Icono gigante */}
          <div className="text-8xl mb-6">{c.icon}</div>

          {/* Avatar + nombre */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gray-800 border-4 border-white/20 flex items-center justify-center overflow-hidden mb-4">
              {resultado.foto_url
                ? <img src={resultado.foto_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-white font-bold text-3xl">
                    {resultado.nombre[0]}{resultado.apellido[0]}
                  </span>
              }
            </div>
            <h2 className="text-white text-3xl font-bold text-center">
              {resultado.nombre} {resultado.apellido}
            </h2>
            {resultado.actividad && (
              <p className="text-white/60 text-sm mt-1">{resultado.actividad}</p>
            )}
          </div>

          {/* Estado */}
          <div className={`border-2 ${c.border} rounded-2xl px-8 py-4 text-center mb-4`}>
            <p className="text-white text-2xl font-black tracking-wide">{c.titulo}</p>
            <p className="text-white/70 text-sm mt-1">{c.subtitulo}</p>
          </div>

          {resultado.yaRegistrado && (
            <p className="text-white/50 text-sm mb-4">Ya registró asistencia hoy</p>
          )}

          {/* Acciones contextuales */}
          <div className="flex gap-3 w-full max-w-xs mt-2">
            {resultado.estadoMembresia === 'vencida' && (
              <button
                onClick={() => router.push(`/cobros/nuevo?socio=${resultado.socioId}`)}
                className="flex-1 py-3 bg-white/10 rounded-xl text-white text-sm font-semibold"
              >
                💰 Cobrar ahora
              </button>
            )}
            <button
              onClick={resetear}
              className="flex-1 py-3 bg-white/10 rounded-xl text-white text-sm font-semibold"
            >
              Siguiente
            </button>
          </div>

        </div>
      </RouteGuard>
    )
  }

  // ─── Pantalla de scan ─────────────────────────────────────────────────────
  return (
    <RouteGuard permiso="verCheckin">
      <div className="max-w-lg mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-xl font-bold text-white flex-1">Check-in</h1>
          <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
            <button
              onClick={() => setModo('scan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${modo === 'scan' ? 'bg-violet-600 text-white' : 'text-gray-400'}`}
            >
              📷 QR
            </button>
            <button
              onClick={() => setModo('manual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${modo === 'manual' ? 'bg-violet-600 text-white' : 'text-gray-400'}`}
            >
              🔍 Manual
            </button>
          </div>
        </div>

        {procesando && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">Verificando socio...</p>
          </div>
        )}

        {!procesando && modo === 'scan' && (
          <div>
            <div className="rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 aspect-square relative">
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Marco guía */}
              {scannerActivo && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-violet-400 rounded-2xl opacity-70" />
                </div>
              )}
            </div>
            {errorCamara ? (
              <div className="mt-3 text-center">
                <p className="text-red-400 text-sm mb-2">No se pudo acceder a la cámara</p>
                <p className="text-gray-500 text-xs">Verificá que el navegador tenga permiso de cámara, o usá el modo manual</p>
                <button
                  onClick={() => { setErrorCamara(false); setModo('manual') }}
                  className="mt-3 px-4 py-2 bg-gray-800 rounded-xl text-sm text-white"
                >
                  Usar modo manual
                </button>
              </div>
            ) : (
              <p className="text-center text-gray-500 text-sm mt-3">
                Apuntá la cámara al código QR del socio
              </p>
            )}
          </div>
        )}

        {!procesando && modo === 'manual' && (
          <div>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">🔍</span>
              <input
                autoFocus
                value={busqueda}
                onChange={e => buscarSocio(e.target.value)}
                placeholder="Buscar socio por nombre..."
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl pl-10 pr-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="space-y-2">
              {socios.map(s => (
                <button
                  key={s.id}
                  onClick={() => procesarCheckin(s.id)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3 hover:border-violet-700 transition text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-violet-900 flex items-center justify-center shrink-0">
                    <span className="text-violet-300 font-bold">{s.nombre[0]}{s.apellido[0]}</span>
                  </div>
                  <p className="text-white font-medium">{s.apellido}, {s.nombre}</p>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </RouteGuard>
  )
}
