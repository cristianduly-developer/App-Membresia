-- ============================================================
-- APP MEMBRESÍAS — Config org
-- Ejecutar en Supabase (app-membresias)
-- ============================================================

CREATE TABLE IF NOT EXISTS config_org (
  org_id              UUID PRIMARY KEY,
  nombre_negocio      TEXT,
  rubro               TEXT,
  telefono            TEXT,
  onboarding_completo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE config_org ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "config_org_policy" ON config_org
    USING (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
    WITH CHECK (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
