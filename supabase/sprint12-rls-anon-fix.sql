-- Sprint 12: Eliminar policies anon INSERT en delivery y QR
-- Los inserts ahora van por /api/public/* con supabaseAdmin (service role)
-- Estas policies ya no son necesarias y representan un riesgo de spam directo a Supabase

-- ─── pedidos_delivery ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_delivery"        ON pedidos_delivery;
DROP POLICY IF EXISTS "anon insert pedidos_delivery" ON pedidos_delivery;
DROP POLICY IF EXISTS "public_insert_delivery"      ON pedidos_delivery;
DROP POLICY IF EXISTS "Allow anon insert"           ON pedidos_delivery;

-- ─── items_pedido_delivery ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_items_delivery"        ON items_pedido_delivery;
DROP POLICY IF EXISTS "anon insert items_pedido_delivery" ON items_pedido_delivery;
DROP POLICY IF EXISTS "public_insert_items_delivery"      ON items_pedido_delivery;

-- ─── pedidos_qr ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_pedido_qr"  ON pedidos_qr;
DROP POLICY IF EXISTS "anon insert pedidos_qr" ON pedidos_qr;
DROP POLICY IF EXISTS "public_insert_qr"       ON pedidos_qr;
DROP POLICY IF EXISTS "Allow anon insert"      ON pedidos_qr;

-- Verificar qué policies quedaron (correr después para confirmar)
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('pedidos_delivery','items_pedido_delivery','pedidos_qr')
-- ORDER BY tablename, cmd;
