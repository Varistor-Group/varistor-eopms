-- ============================================================
-- Varistor EOPMS -- Migration 002: Document Template System
-- Run in the Supabase SQL Editor (or via push_templates.ps1)
-- ============================================================

-- TABLE: document_templates
CREATE TABLE IF NOT EXISTS public.document_templates (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select_auth"
  ON public.document_templates FOR SELECT
  TO authenticated USING (TRUE);

CREATE POLICY "templates_insert_hr_admin"
  ON public.document_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('HR', 'Admin'));

CREATE POLICY "templates_update_hr_admin"
  ON public.document_templates FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'));

CREATE POLICY "templates_delete_hr_admin"
  ON public.document_templates FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'));

-- TABLE: employee_document_slots
CREATE TABLE IF NOT EXISTS public.employee_document_slots (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  employee_id   TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  template_id   TEXT REFERENCES public.document_templates(id) ON DELETE SET NULL,
  document_name TEXT NOT NULL,
  is_required   BOOLEAN NOT NULL DEFAULT TRUE,
  is_custom     BOOLEAN NOT NULL DEFAULT FALSE,
  document_id   TEXT REFERENCES public.documents(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'Pending',
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS slots_employee_id_idx ON public.employee_document_slots(employee_id);
CREATE INDEX IF NOT EXISTS slots_template_id_idx ON public.employee_document_slots(template_id);

ALTER TABLE public.employee_document_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slots_select"
  ON public.employee_document_slots FOR SELECT
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "slots_insert"
  ON public.employee_document_slots FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "slots_update"
  ON public.employee_document_slots FOR UPDATE
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "slots_delete_hr_admin"
  ON public.employee_document_slots FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'));

-- SEED: Default 6 document templates
INSERT INTO public.document_templates (id, name, description, is_required, is_active, sort_order)
VALUES
  ('tmpl-aadhaar', 'Aadhaar Card',          'Government-issued Aadhaar identity card (front & back)',        TRUE,  TRUE, 1),
  ('tmpl-pan',     'PAN Card',              'Permanent Account Number card issued by Income Tax Department', TRUE,  TRUE, 2),
  ('tmpl-photo',   'Passport Photo',        'Recent passport-sized photograph (JPEG/PNG)',                   TRUE,  TRUE, 3),
  ('tmpl-exp',     'Experience Letter',     'Experience letter from previous employer (if applicable)',      FALSE, TRUE, 4),
  ('tmpl-offer',   'Offer Letter (Signed)', 'Signed copy of Varistor offer letter',                         TRUE,  TRUE, 5),
  ('tmpl-edu',     'Educational Certificates', 'Degree/diploma certificates (highest qualification)',        TRUE,  TRUE, 6)
ON CONFLICT (name) DO NOTHING;

-- HELPER RPC: seed_employee_document_slots
CREATE OR REPLACE FUNCTION public.seed_employee_document_slots(p_employee_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.employee_document_slots (employee_id, template_id, document_name, is_required, is_custom)
  SELECT
    p_employee_id,
    t.id,
    t.name,
    t.is_required,
    FALSE
  FROM public.document_templates t
  WHERE t.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_document_slots s
      WHERE s.employee_id = p_employee_id
        AND s.template_id = t.id
    );
END;
$$;
