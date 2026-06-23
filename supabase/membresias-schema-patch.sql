-- ============================================================
-- PATCH — Agrega columnas faltantes en tablas pre-existentes
-- Ejecutar si membresias-schema.sql dio error de columna "fecha"
-- ============================================================

ALTER TABLE cobros      ADD COLUMN IF NOT EXISTS fecha DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS fecha DATE NOT NULL DEFAULT CURRENT_DATE;

-- Índices que dependen de fecha (ignorar si ya existen)
CREATE INDEX IF NOT EXISTS idx_cobros_org_fecha      ON cobros(org_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_cobros_socio          ON cobros(socio_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_org_fecha ON asistencias(org_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_asistencias_socio     ON asistencias(socio_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_asistencias_actividad ON asistencias(actividad_id, fecha);
