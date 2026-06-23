-- ============================================================
-- APP MEMBRESÍAS — Schema completo (idempotente)
-- Seguro para ejecutar múltiples veces y sobre tablas ya existentes
-- Orden: este archivo → membresias-caja.sql → membresias-apto-colaboradores.sql
-- ============================================================

-- ─── SOCIOS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS socios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL,
  nombre           TEXT NOT NULL,
  apellido         TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE socios ADD COLUMN IF NOT EXISTS dni              TEXT;
ALTER TABLE socios ADD COLUMN IF NOT EXISTS telefono         TEXT;
ALTER TABLE socios ADD COLUMN IF NOT EXISTS email            TEXT;
ALTER TABLE socios ADD COLUMN IF NOT EXISTS direccion        TEXT;
ALTER TABLE socios ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
ALTER TABLE socios ADD COLUMN IF NOT EXISTS foto_url         TEXT;
ALTER TABLE socios ADD COLUMN IF NOT EXISTS estado           TEXT NOT NULL DEFAULT 'activo';
ALTER TABLE socios ADD COLUMN IF NOT EXISTS observaciones    TEXT;
ALTER TABLE socios ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE socios ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "socios_org" ON socios
    USING (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
    WITH CHECK (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_socios_org         ON socios(org_id, estado);
CREATE INDEX IF NOT EXISTS idx_socios_org_apellido ON socios(org_id, apellido);

-- ─── PROFESORES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profesores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL,
  nombre     TEXT NOT NULL,
  apellido   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE profesores ADD COLUMN IF NOT EXISTS telefono            TEXT;
ALTER TABLE profesores ADD COLUMN IF NOT EXISTS email               TEXT;
ALTER TABLE profesores ADD COLUMN IF NOT EXISTS honorario_por_clase NUMERIC(10,2);
ALTER TABLE profesores ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE profesores ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "profesores_org" ON profesores
    USING (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
    WITH CHECK (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_profesores_org ON profesores(org_id);

-- ─── ACTIVIDADES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actividades (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL,
  nombre     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS dias           TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS horario_inicio TIME;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS horario_fin    TIME;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS cupo_maximo    INT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS profesor_id    UUID REFERENCES profesores(id) ON DELETE SET NULL;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "actividades_org" ON actividades
    USING (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
    WITH CHECK (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_actividades_org ON actividades(org_id);

-- ─── MEMBRESÍAS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS membresias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL,
  socio_id   UUID NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL DEFAULT 'mensual',
  precio     NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE membresias ADD COLUMN IF NOT EXISTS fecha_inicio      DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE membresias ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE membresias ADD COLUMN IF NOT EXISTS estado            TEXT NOT NULL DEFAULT 'activa';
ALTER TABLE membresias ADD COLUMN IF NOT EXISTS actividades_ids   UUID[];
ALTER TABLE membresias ADD COLUMN IF NOT EXISTS congelado_desde   DATE;
ALTER TABLE membresias ADD COLUMN IF NOT EXISTS dias_congelados   INT NOT NULL DEFAULT 0;
ALTER TABLE membresias ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE membresias ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "membresias_org" ON membresias
    USING (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
    WITH CHECK (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_membresias_org        ON membresias(org_id, estado);
CREATE INDEX IF NOT EXISTS idx_membresias_socio      ON membresias(socio_id);
CREATE INDEX IF NOT EXISTS idx_membresias_vencimiento ON membresias(org_id, fecha_vencimiento);

-- ─── COBROS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cobros (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL,
  socio_id   UUID NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  monto      NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE cobros ADD COLUMN IF NOT EXISTS membresia_id UUID REFERENCES membresias(id) ON DELETE SET NULL;
ALTER TABLE cobros ADD COLUMN IF NOT EXISTS metodo_pago  TEXT NOT NULL DEFAULT 'efectivo';
ALTER TABLE cobros ADD COLUMN IF NOT EXISTS concepto     TEXT;
ALTER TABLE cobros ADD COLUMN IF NOT EXISTS estado       TEXT NOT NULL DEFAULT 'cobrado';
ALTER TABLE cobros ADD COLUMN IF NOT EXISTS fecha        DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE cobros ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "cobros_org" ON cobros
    USING (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
    WITH CHECK (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_cobros_org_fecha ON cobros(org_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_cobros_socio     ON cobros(socio_id);

-- ─── ASISTENCIAS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asistencias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL,
  socio_id   UUID NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS actividad_id UUID REFERENCES actividades(id) ON DELETE SET NULL;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS fecha        DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS modo         TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "asistencias_org" ON asistencias
    USING (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
    WITH CHECK (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UNIQUE por socio por día (ignorar si ya existe)
DO $$ BEGIN
  ALTER TABLE asistencias ADD CONSTRAINT asistencias_org_socio_fecha_unique UNIQUE (org_id, socio_id, fecha);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_asistencias_org_fecha ON asistencias(org_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_asistencias_socio     ON asistencias(socio_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_asistencias_actividad ON asistencias(actividad_id, fecha);

-- ─── LIQUIDACIONES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS liquidaciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL,
  profesor_id UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  periodo     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE liquidaciones ADD COLUMN IF NOT EXISTS periodo     TEXT NOT NULL DEFAULT '';
ALTER TABLE liquidaciones ADD COLUMN IF NOT EXISTS clases_dadas INT NOT NULL DEFAULT 0;
ALTER TABLE liquidaciones ADD COLUMN IF NOT EXISTS monto_base   NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE liquidaciones ADD COLUMN IF NOT EXISTS ajuste       NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE liquidaciones ADD COLUMN IF NOT EXISTS total        NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE liquidaciones ADD COLUMN IF NOT EXISTS liquidado    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE liquidaciones ADD COLUMN IF NOT EXISTS liquidado_en TIMESTAMPTZ;

ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "liquidaciones_org" ON liquidaciones
    USING (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
    WITH CHECK (org_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE liquidaciones ADD CONSTRAINT liquidaciones_org_profesor_periodo_unique UNIQUE (org_id, profesor_id, periodo);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_liquidaciones_org ON liquidaciones(org_id, periodo DESC);
