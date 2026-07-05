-- ══════════════════════════════════════════════════════════════
-- Membresías — ENFORCEMENT (items 8 + 9)
-- Correr DESPUÉS de tenant-access-stage1.sql
-- Gatea ESCRITURA por acceso vigente + features del plan.
-- LECTURA intacta. RESTRICTIVE. Reversible.
-- ══════════════════════════════════════════════════════════════

-- ── A. Gate de ACCESO vigente en escritura ──
DO $$
DECLARE t TEXT;
DECLARE tablas TEXT[] := ARRAY[
  'socios','profesores','actividades','membresias','cobros',
  'asistencias','liquidaciones','gastos_caja','apto_medico',
  'colaboradores','config_org'
];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = t AND column_name = 'org_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS acc_ins_%1$s ON %1$s', t);
      EXECUTE format('DROP POLICY IF EXISTS acc_upd_%1$s ON %1$s', t);
      EXECUTE format('CREATE POLICY acc_ins_%1$s ON %1$s AS RESTRICTIVE FOR INSERT WITH CHECK (tiene_acceso(org_id::uuid))', t);
      EXECUTE format('CREATE POLICY acc_upd_%1$s ON %1$s AS RESTRICTIVE FOR UPDATE WITH CHECK (tiene_acceso(org_id::uuid))', t);
    END IF;
  END LOOP;
END $$;

-- ── B. Límite de SOCIOS por plan ──
CREATE OR REPLACE FUNCTION chk_limite_socios() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_max INT; v_count INT;
BEGIN
  SELECT max_socios INTO v_max FROM plan_limites WHERE plan = plan_tenant(NEW.org_id::uuid);
  IF v_max IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM socios WHERE org_id = NEW.org_id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Límite de socios del plan alcanzado (%). Actualizá el plan.', v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_limite_socios ON socios;
CREATE TRIGGER trg_limite_socios BEFORE INSERT ON socios
  FOR EACH ROW EXECUTE FUNCTION chk_limite_socios();

-- ── C. Límite de ACTIVIDADES por plan ──
CREATE OR REPLACE FUNCTION chk_limite_actividades() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_max INT; v_count INT;
BEGIN
  SELECT max_actividades INTO v_max FROM plan_limites WHERE plan = plan_tenant(NEW.org_id::uuid);
  IF v_max IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM actividades WHERE org_id = NEW.org_id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Límite de actividades del plan alcanzado (%). Actualizá el plan.', v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_limite_actividades ON actividades;
CREATE TRIGGER trg_limite_actividades BEFORE INSERT ON actividades
  FOR EACH ROW EXECUTE FUNCTION chk_limite_actividades();

-- ── D. Gate de FEATURES por plan ──
DROP POLICY IF EXISTS feat_ins_apto ON apto_medico;
CREATE POLICY feat_ins_apto ON apto_medico AS RESTRICTIVE
  FOR INSERT WITH CHECK (plan_permite(org_id::uuid, 'apto_medico'));

DROP POLICY IF EXISTS feat_ins_profesores ON profesores;
CREATE POLICY feat_ins_profesores ON profesores AS RESTRICTIVE
  FOR INSERT WITH CHECK (plan_permite(org_id::uuid, 'profesores'));

DROP POLICY IF EXISTS feat_ins_liquidaciones ON liquidaciones;
CREATE POLICY feat_ins_liquidaciones ON liquidaciones AS RESTRICTIVE
  FOR INSERT WITH CHECK (plan_permite(org_id::uuid, 'liquidaciones'));

-- ══════════════════════════════════════════════════════════════
-- ROLLBACK:
-- DO $$ DECLARE t TEXT; DECLARE tablas TEXT[] := ARRAY['socios','profesores','actividades','membresias','cobros','asistencias','liquidaciones','gastos_caja','apto_medico','colaboradores','config_org'];
-- BEGIN FOREACH t IN ARRAY tablas LOOP
--   EXECUTE format('DROP POLICY IF EXISTS acc_ins_%1$s ON %1$s', t);
--   EXECUTE format('DROP POLICY IF EXISTS acc_upd_%1$s ON %1$s', t);
-- END LOOP; END $$;
-- DROP TRIGGER IF EXISTS trg_limite_socios ON socios;
-- DROP TRIGGER IF EXISTS trg_limite_actividades ON actividades;
-- DROP FUNCTION IF EXISTS chk_limite_socios();
-- DROP FUNCTION IF EXISTS chk_limite_actividades();
-- DROP POLICY IF EXISTS feat_ins_apto ON apto_medico;
-- DROP POLICY IF EXISTS feat_ins_profesores ON profesores;
-- DROP POLICY IF EXISTS feat_ins_liquidaciones ON liquidaciones;
-- ══════════════════════════════════════════════════════════════
