-- ============================================================
-- Sprint 3 PATCH — Ejecutar en SQL Editor de Supabase
-- Agrega columnas de origen a ventas para vincular con comandas
-- ============================================================

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'directa' CHECK (origen IN ('directa', 'comanda')),
  ADD COLUMN IF NOT EXISTS referencia_id UUID;

CREATE INDEX IF NOT EXISTS idx_ventas_referencia ON ventas(referencia_id) WHERE referencia_id IS NOT NULL;
