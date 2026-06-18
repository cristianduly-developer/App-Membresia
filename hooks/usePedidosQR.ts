'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

export interface PedidoQR {
  id: string
  mesa_nombre: string
  items: { nombre: string; cantidad: number; observacion: string | null }[]
  total: number
  created_at: string
}

export function usePedidosQR() {
  const { localId } = useSession()
  const [pendientes, setPendientes] = useState<PedidoQR[]>([])
  const [nuevoPedido, setNuevoPedido] = useState<PedidoQR | null>(null)

  const cargar = useCallback(async () => {
    if (!localId) return
    const { data } = await supabaseApp
      .from('pedidos_qr')
      .select('id, mesa_nombre, items, total, created_at')
      .eq('local_id', localId)
      .eq('estado', 'pendiente')
      .order('created_at')
    setPendientes(data ?? [])
  }, [localId])

  useEffect(() => {
    if (!localId) return
    cargar()

    const channel = supabaseApp
      .channel('pedidos-qr-hook')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos_qr' },
        (payload) => {
          const nuevo = payload.new as PedidoQR
          setPendientes((prev) => [...prev, nuevo])
          setNuevoPedido(nuevo)
          // Sonido de notificación
          try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.setValueAtTime(880, ctx.currentTime)
            osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1)
            gain.gain.setValueAtTime(0.3, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.4)
          } catch {
            // silencioso si el browser bloquea audio
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos_qr' },
        () => cargar()
      )
      .subscribe()

    return () => { supabaseApp.removeChannel(channel) }
  }, [localId, cargar])

  const cerrarNuevo = () => setNuevoPedido(null)

  return { pendientes, nuevoPedido, cerrarNuevo, total: pendientes.length }
}
