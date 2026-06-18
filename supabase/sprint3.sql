-- ============================================================
-- APP GASTRONOMÍA — Sprint 3
-- Ejecutar en el SQL Editor de Supabase (app gastronomia)
-- ============================================================

-- ────────────────────────────────────────────
-- TABLA: sectores
-- Agrupadores de mesas (Salón, Terraza, Barra, etc.)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sectores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id    UUID NOT NULL,
  nombre      TEXT NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sectores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sectores_local" ON sectores
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

CREATE TRIGGER trg_sectores_updated_at
  BEFORE UPDATE ON sectores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_sectores_local ON sectores(local_id) WHERE activo = TRUE;

-- ────────────────────────────────────────────
-- TABLA: mesas
-- Mesas dentro de cada sector
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id    UUID NOT NULL,
  sector_id   UUID NOT NULL REFERENCES sectores(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  capacidad   INTEGER DEFAULT 2,
  estado      TEXT NOT NULL DEFAULT 'libre' CHECK (estado IN ('libre', 'ocupada', 'pidio_cuenta', 'reservada')),
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mesas_local" ON mesas
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

CREATE TRIGGER trg_mesas_updated_at
  BEFORE UPDATE ON mesas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_mesas_local ON mesas(local_id) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_mesas_sector ON mesas(sector_id);

-- ────────────────────────────────────────────
-- TABLA: comandas
-- Una comanda por mesa, queda abierta hasta cobrar
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comandas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id        UUID NOT NULL,
  mesa_id         UUID NOT NULL REFERENCES mesas(id) ON DELETE RESTRICT,
  estado          TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  tanda_actual    INTEGER NOT NULL DEFAULT 1,
  observaciones   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrada_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id)
);

ALTER TABLE comandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comandas_local" ON comandas
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

CREATE TRIGGER trg_comandas_updated_at
  BEFORE UPDATE ON comandas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_comandas_local ON comandas(local_id);
CREATE INDEX IF NOT EXISTS idx_comandas_mesa ON comandas(mesa_id);

-- ────────────────────────────────────────────
-- TABLA: items_comanda
-- Cada producto pedido, con tanda y estado
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items_comanda (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id    UUID NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
  producto_id   UUID REFERENCES productos(id) ON DELETE SET NULL,
  nombre        TEXT NOT NULL,
  precio        NUMERIC(10,2) NOT NULL,
  cantidad      INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  subtotal      NUMERIC(10,2) NOT NULL,
  observacion   TEXT,
  tanda         INTEGER NOT NULL DEFAULT 1,
  estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_preparacion', 'listo', 'entregado')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE items_comanda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_comanda_local" ON items_comanda
  USING (
    EXISTS (
      SELECT 1 FROM comandas c
      WHERE c.id = comanda_id
      AND c.local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM comandas c
      WHERE c.id = comanda_id
      AND c.local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id')
    )
  );

CREATE TRIGGER trg_items_comanda_updated_at
  BEFORE UPDATE ON items_comanda
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_items_comanda ON items_comanda(comanda_id);
CREATE INDEX IF NOT EXISTS idx_items_comanda_estado ON items_comanda(estado);

-- Habilitar Realtime para cocina
ALTER PUBLICATION supabase_realtime ADD TABLE items_comanda;
ALTER PUBLICATION supabase_realtime ADD TABLE comandas;
ALTER PUBLICATION supabase_realtime ADD TABLE mesas;
