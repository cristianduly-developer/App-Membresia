-- ============================================================
-- Sprint 5 — Menú QR público
-- Ejecutar en SQL Editor de Supabase (app gastronomia)
-- Habilita lectura pública (sin auth) para la carta
-- ============================================================

-- Política de lectura pública para config_local (solo nombre/telefono/tipo)
CREATE POLICY "config_local_public_read" ON config_local
  FOR SELECT
  USING (true);

-- Política de lectura pública para categorias
CREATE POLICY "categorias_public_read" ON categorias
  FOR SELECT
  USING (activo = true);

-- Política de lectura pública para productos
CREATE POLICY "productos_public_read" ON productos
  FOR SELECT
  USING (activo = true);
