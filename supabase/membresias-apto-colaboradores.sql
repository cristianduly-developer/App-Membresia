-- ============================================================
-- APP MEMBRESÍAS — Apto médico + Colaboradores
-- Ejecutar en Supabase (app-membresias)
-- ============================================================

-- Apto médico por socio
CREATE TABLE IF NOT EXISTS apto_medico (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL,
  socio_id         UUID NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  fecha_emision    DATE,
  fecha_vencimiento DATE NOT NULL,
  observaciones    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, socio_id)
);

ALTER TABLE apto_medico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apto_org" ON apto_medico
  USING (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

CREATE INDEX IF NOT EXISTS idx_apto_org ON apto_medico(org_id, fecha_vencimiento);

-- Colaboradores (usuarios adicionales por org)
CREATE TABLE IF NOT EXISTS colaboradores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL,
  email      TEXT NOT NULL,
  nombre     TEXT NOT NULL,
  rol        TEXT NOT NULL CHECK (rol IN ('recepcionista', 'profesor')),
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, email)
);

ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colaboradores_org" ON colaboradores
  USING (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

CREATE INDEX IF NOT EXISTS idx_colaboradores_org ON colaboradores(org_id) WHERE activo = TRUE;
