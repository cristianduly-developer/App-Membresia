-- ══════════════════════════════════════════════════════════════
-- Membresías — Espejo de acceso/plan por tenant
-- STAGE 1: solo crea tablas y funciones. NO enforca nada.
-- Correr en el Supabase de Membresías.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenant_access (
  tenant_id   UUID PRIMARY KEY,
  plan        TEXT,
  valid_until TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '3650 days'
);
ALTER TABLE tenant_access ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS plan_limites (
  plan               TEXT PRIMARY KEY,
  max_socios         INT,
  max_actividades    INT,
  usa_apto_medico    BOOLEAN NOT NULL DEFAULT FALSE,
  usa_profesores     BOOLEAN NOT NULL DEFAULT FALSE,
  usa_liquidaciones  BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO plan_limites (plan, max_socios, max_actividades, usa_apto_medico, usa_profesores, usa_liquidaciones) VALUES
  ('basico',      100,  3,    FALSE, FALSE, FALSE),
  ('profesional', 300,  NULL, TRUE,  TRUE,  TRUE),
  ('premium',     NULL, NULL, TRUE,  TRUE,  TRUE),
  ('sincargo',    300,  NULL, TRUE,  TRUE,  TRUE)
ON CONFLICT (plan) DO UPDATE SET
  max_socios        = EXCLUDED.max_socios,
  max_actividades   = EXCLUDED.max_actividades,
  usa_apto_medico   = EXCLUDED.usa_apto_medico,
  usa_profesores    = EXCLUDED.usa_profesores,
  usa_liquidaciones = EXCLUDED.usa_liquidaciones;

CREATE OR REPLACE FUNCTION tiene_acceso(tid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT valid_until > now() FROM tenant_access WHERE tenant_id = tid), FALSE);
$$;

CREATE OR REPLACE FUNCTION plan_tenant(tid UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT plan FROM tenant_access WHERE tenant_id = tid),
    (auth.jwt() -> 'app_metadata' ->> 'plan'),
    'basico'
  );
$$;

CREATE OR REPLACE FUNCTION plan_permite(tid UUID, feature TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT CASE feature
      WHEN 'apto_medico'   THEN usa_apto_medico
      WHEN 'profesores'    THEN usa_profesores
      WHEN 'liquidaciones' THEN usa_liquidaciones
      ELSE TRUE END
    FROM plan_limites WHERE plan = plan_tenant(tid)
  ), FALSE);
$$;

-- ══════════════════════════════════════════════════════════════
-- FIN STAGE 1. Verificar: SELECT * FROM tenant_access;
-- ══════════════════════════════════════════════════════════════
