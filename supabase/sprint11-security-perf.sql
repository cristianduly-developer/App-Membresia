-- Sprint 11: Seguridad, performance e integridad
-- Ejecutar en Supabase SQL Editor

-- ─── 1. ÍNDICES DE PERFORMANCE ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mesas_local_activo        ON mesas(local_id, activo);
CREATE INDEX IF NOT EXISTS idx_items_comanda_estado       ON items_comanda(estado);
CREATE INDEX IF NOT EXISTS idx_colaboradores_email_local  ON colaboradores(email, local_id);
CREATE INDEX IF NOT EXISTS idx_ventas_local_fecha         ON ventas(local_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comandas_local_estado_fecha ON comandas(local_id, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_local     ON pedidos_delivery(local_id, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_qr_local           ON pedidos_qr(local_id, estado);

-- ─── 2. UNIQUE INDEX CAJA: evitar doble apertura simultánea ──────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_caja_una_abierta
  ON caja(local_id)
  WHERE estado = 'abierta';

-- ─── 3. precio_unitario en items_comanda (nullable para no romper existentes) ─
ALTER TABLE items_comanda
  ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(10,2) DEFAULT NULL;

-- ─── 4. precio_unitario en items_pedido_delivery (historial correcto) ─────────
ALTER TABLE items_pedido_delivery
  ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(10,2) DEFAULT NULL;

-- ─── 5. SEGURIDAD: eliminar policy que expone todos los locales públicamente ──
DROP POLICY IF EXISTS "config_local_public_read" ON config_local;

-- Policy correcta: cada local solo lee la suya (autenticados)
DROP POLICY IF EXISTS "config_local_owner_read" ON config_local;
CREATE POLICY "config_local_owner_read" ON config_local
  FOR SELECT
  USING (
    local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id')
  );

-- ─── 6. FK integridad: items_comanda → ventas ────────────────────────────────
-- Solo agregar si no existe (puede variar según sprint anterior)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'items_venta_venta_id_fkey'
      AND table_name = 'items_venta'
  ) THEN
    ALTER TABLE items_venta
      ADD CONSTRAINT items_venta_venta_id_fkey
      FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── RESUMEN ──────────────────────────────────────────────────────────────────
-- ✓ 7 índices de performance creados
-- ✓ Unique index en caja abierta (previene doble apertura)
-- ✓ precio_unitario en items_comanda e items_pedido_delivery
-- ✓ Policy config_local corregida (ya no expone datos de todos los locales)
-- ✓ FK items_venta → ventas
