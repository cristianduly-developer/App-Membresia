'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Socio {
  id: string
  nombre: string
  apellido: string
  dni: string | null
  fecha_nacimiento: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  observaciones: string | null
  estado: string
  foto_url: string | null
  numero_socio: number | null
}

interface HistorialRapido {
  ultimo_pago: string | null
  monto_ultimo_pago: number | null
  proximo_vencimiento: string | null
  ultima_asistencia: string | null
  actividad: string | null
}

function formatFecha(fecha: string | null) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function diasRestantes(fecha: string | null): { texto: string; color: string } {
  if (!fecha) return { texto: '—', color: 'text-gray-500' }
  const diff = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { texto: `Vencida hace ${Math.abs(diff)} días`, color: 'text-red-400' }
  if (diff === 0) return { texto: 'Vence hoy', color: 'text-yellow-400' }
  if (diff <= 7) return { texto: `Vence en ${diff} días`, color: 'text-yellow-400' }
  return { texto: `Vence ${formatFecha(fecha)}`, color: 'text-green-400' }
}

export default function FichaSocioPage() {
  const { localId, permisos } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { nombreNegocio } = useSession()
  const [socio, setSocio] = useState<Socio | null>(null)
  const [historial, setHistorial] = useState<HistorialRapido | null>(null)
  const [loading, setLoading] = useState(true)
  const [mostrarQR, setMostrarQR] = useState(false)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!localId || !id) return
    cargarDatos()
  }, [localId, id])

  useEffect(() => {
    if (!mostrarQR || !qrCanvasRef.current || !id || !socio) return
    import('qrcode').then(async QRCode => {
      const qrSize = 220
      const paddingTop = 48
      const paddingBottom = 52
      const canvasWidth = qrSize
      const canvasHeight = qrSize + paddingTop + paddingBottom

      const canvas = qrCanvasRef.current!
      canvas.width = canvasWidth
      canvas.height = canvasHeight

      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // QR en canvas temporal
      const tmpCanvas = document.createElement('canvas')
      await QRCode.toCanvas(tmpCanvas, id, { width: qrSize, margin: 1, color: { dark: '#ffffff', light: '#0a0a0a' } })
      ctx.drawImage(tmpCanvas, 0, paddingTop)

      // Nombre del negocio arriba
      ctx.fillStyle = '#a78bfa'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText((nombreNegocio || 'SocioApp').toUpperCase(), canvasWidth / 2, 22)

      // Nombre del socio + "Check-in" abajo
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 13px sans-serif'
      ctx.fillText(`${socio.nombre} ${socio.apellido}`, canvasWidth / 2, qrSize + paddingTop + 20)
      ctx.fillStyle = '#6b7280'
      ctx.font = '11px sans-serif'
      ctx.fillText('Presentá este código en recepción', canvasWidth / 2, qrSize + paddingTop + 38)
    })
  }, [mostrarQR, id, socio, nombreNegocio])

  const cargarDatos = async () => {
    setLoading(true)

    const [{ data: socioData }, { data: cobros }, { data: asistencias }, { data: membresias }] = await Promise.all([
      supabaseApp.from('socios').select('*').eq('id', id).eq('org_id', localId).single(),
      supabaseApp.from('cobros').select('fecha_pago, monto, fecha_vencimiento').eq('socio_id', id).eq('estado', 'pagado').order('fecha_pago', { ascending: false }).limit(1),
      supabaseApp.from('asistencias').select('fecha, actividades(nombre)').eq('socio_id', id).order('fecha', { ascending: false }).limit(1),
      supabaseApp.from('membresias').select('fecha_vencimiento').eq('socio_id', id).in('estado', ['activa', 'proxima_vencer']).order('fecha_vencimiento', { ascending: false }).limit(1),
    ])

    setSocio(socioData)
    setHistorial({
      ultimo_pago: cobros?.[0]?.fecha_pago ?? null,
      monto_ultimo_pago: cobros?.[0]?.monto ?? null,
      proximo_vencimiento: membresias?.[0]?.fecha_vencimiento ?? cobros?.[0]?.fecha_vencimiento ?? null,
      ultima_asistencia: asistencias?.[0]?.fecha ?? null,
      actividad: (asistencias?.[0] as any)?.actividades?.nombre ?? null,
    })
    setLoading(false)
  }

  const cambiarEstado = async (nuevoEstado: string) => {
    if (!socio) return
    await supabaseApp.from('socios').update({ estado: nuevoEstado }).eq('id', id)
    setSocio({ ...socio, estado: nuevoEstado })
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!socio) return (
    <div className="text-center py-16 text-gray-500">Socio no encontrado</div>
  )

  const venc = diasRestantes(historial?.proximo_vencimiento ?? null)

  return (
    <RouteGuard permiso="verSocios">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-2xl leading-none">‹</button>
          <h1 className="text-xl font-bold text-white flex-1">Ficha del socio</h1>
          {permisos?.editarSocios && (
            <button
              onClick={() => router.push(`/socios/${id}/editar`)}
              className="text-violet-400 text-sm hover:underline"
            >
              Editar
            </button>
          )}
        </div>

        {/* Avatar + nombre */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-20 h-20 rounded-2xl bg-violet-900 flex items-center justify-center overflow-hidden shrink-0">
            {socio.foto_url
              ? <img src={socio.foto_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-violet-300 font-bold text-3xl">{socio.nombre[0]}{socio.apellido[0]}</span>
            }
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{socio.nombre} {socio.apellido}</h2>
            {socio.numero_socio && <p className="text-gray-500 text-sm">Socio N° {socio.numero_socio}</p>}
            <span className={`inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full font-medium
              ${socio.estado === 'activo' ? 'bg-green-500/20 text-green-400' :
                socio.estado === 'suspendido' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'}`}>
              {socio.estado}
            </span>
          </div>
        </div>

        {/* Historial rápido */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-xs mb-1">Último pago</p>
            <p className="text-white text-sm font-semibold">
              {historial?.ultimo_pago ? formatFecha(historial.ultimo_pago) : '—'}
            </p>
            {historial?.monto_ultimo_pago && (
              <p className="text-gray-400 text-xs">${historial.monto_ultimo_pago.toLocaleString('es-AR')}</p>
            )}
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Próximo vencimiento</p>
            <p className={`text-sm font-semibold ${venc.color}`}>{venc.texto}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Última asistencia</p>
            <p className="text-white text-sm font-semibold">
              {historial?.ultima_asistencia ? formatFecha(historial.ultima_asistencia) : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Actividad</p>
            <p className="text-white text-sm font-semibold truncate">{historial?.actividad ?? '—'}</p>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="flex gap-2 mb-4">
          {permisos?.registrarCobros && (
            <button
              onClick={() => router.push(`/cobros/nuevo?socio=${id}`)}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-2xl text-base transition flex items-center justify-center gap-2"
            >
              💰 Registrar pago
            </button>
          )}
          <button
            onClick={() => setMostrarQR(true)}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 px-5 rounded-2xl text-xl transition"
            title="Ver QR del socio"
          >
            📱
          </button>
        </div>

        {/* Modal QR */}
        {mostrarQR && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
            onClick={() => setMostrarQR(false)}
          >
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-bold text-lg">{socio.nombre} {socio.apellido}</h3>
              <canvas ref={qrCanvasRef} className="rounded-xl" />
              <p className="text-gray-500 text-xs text-center">Mostrá este código en el check-in</p>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => {
                    const canvas = qrCanvasRef.current
                    if (!canvas) return
                    const link = document.createElement('a')
                    link.download = `qr-${socio.nombre}-${socio.apellido}.png`
                    link.href = canvas.toDataURL()
                    link.click()
                  }}
                  className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-semibold"
                >
                  ⬇️ Descargar
                </button>
                {socio.telefono && (
                  <button
                    onClick={() => {
                      const canvas = qrCanvasRef.current
                      if (!canvas) return
                      canvas.toBlob(blob => {
                        if (!blob) return
                        const file = new File([blob], `qr-${socio.nombre}.png`, { type: 'image/png' })
                        if (navigator.share && navigator.canShare({ files: [file] })) {
                          navigator.share({ files: [file], title: `QR de ${socio.nombre} ${socio.apellido}` })
                        } else {
                          window.open(`https://wa.me/${socio.telefono?.replace(/\D/g, '')}`, '_blank')
                        }
                      })
                    }}
                    className="flex-1 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold"
                  >
                    💬 Enviar
                  </button>
                )}
              </div>
              <button onClick={() => setMostrarQR(false)} className="w-full py-2.5 bg-gray-900 text-gray-400 rounded-xl text-sm">Cerrar</button>
            </div>
          </div>
        )}

        {/* Datos personales */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Datos personales</h3>
          {[
            { label: 'DNI', value: socio.dni },
            { label: 'Teléfono', value: socio.telefono },
            { label: 'Email', value: socio.email },
            { label: 'Dirección', value: socio.direccion },
            { label: 'Nacimiento', value: formatFecha(socio.fecha_nacimiento) },
          ].map(({ label, value }) => value && value !== '—' && (
            <div key={label} className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">{label}</span>
              <span className="text-white text-sm font-medium">{value}</span>
            </div>
          ))}
          {socio.observaciones && (
            <div>
              <span className="text-gray-500 text-sm block mb-1">Observaciones</span>
              <p className="text-gray-300 text-sm">{socio.observaciones}</p>
            </div>
          )}
        </div>

        {/* Cambiar estado */}
        {permisos?.editarSocios && socio.estado === 'activo' && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => cambiarEstado('inactivo')}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 transition"
            >
              Marcar inactivo
            </button>
            <button
              onClick={() => cambiarEstado('suspendido')}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-950 text-red-400 hover:bg-red-900 transition"
            >
              Suspender
            </button>
          </div>
        )}
        {permisos?.editarSocios && socio.estado !== 'activo' && (
          <button
            onClick={() => cambiarEstado('activo')}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-green-950 text-green-400 hover:bg-green-900 transition mt-2"
          >
            Reactivar socio
          </button>
        )}

      </div>
    </RouteGuard>
  )
}
