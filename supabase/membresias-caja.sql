-- ============================================================
-- APP MEMBRESÍAS — Caja chica
-- Ejecutar en Supabase (app-membresias)
-- ============================================================

CREATE TABLE IF NOT EXISTS gastos_caja (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL,
  descripcion TEXT NOT NULL,
  monto       NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  categoria   TEXT NOT NULL DEFAULT 'otros',
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gastos_caja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gastos_org" ON gastos_caja
  USING (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

CREATE INDEX IF NOT EXISTS idx_gastos_org_fecha ON gastos_caja(org_id, fecha DESC);
