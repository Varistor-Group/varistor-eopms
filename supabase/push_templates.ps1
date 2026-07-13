# push_templates.ps1 - Run migration 002 against the live Supabase project
$token      = "sbp_8da2c34047998a1512d7e5de29d5130f36fbefae"
$projectRef = "vghttoqhflmbjztsphjy"
$url        = "https://api.supabase.com/v1/projects/$projectRef/database/query"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

function Run-SQL($label, $sql) {
    $body = [ordered]@{ query = $sql }
    $json = $body | ConvertTo-Json -Depth 5 -Compress
    try {
        $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $json -ContentType "application/json"
        Write-Host "[$label] SUCCESS"
    } catch {
        Write-Host "[$label] ERROR: $($_.ErrorDetails.Message)"
    }
}

# Step 1: Create document_templates table
Run-SQL "Create document_templates table" @"
CREATE TABLE IF NOT EXISTS public.document_templates (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"@

# Step 2: Enable RLS on document_templates
Run-SQL "Enable RLS on document_templates" "ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;"

# Step 3: RLS Policies for document_templates
Run-SQL "templates select policy" "CREATE POLICY templates_select_auth ON public.document_templates FOR SELECT TO authenticated USING (TRUE);"
Run-SQL "templates insert policy" "CREATE POLICY templates_insert_hr_admin ON public.document_templates FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('HR', 'Admin'));"
Run-SQL "templates update policy" "CREATE POLICY templates_update_hr_admin ON public.document_templates FOR UPDATE TO authenticated USING (public.current_user_role() IN ('HR', 'Admin'));"
Run-SQL "templates delete policy" "CREATE POLICY templates_delete_hr_admin ON public.document_templates FOR DELETE TO authenticated USING (public.current_user_role() IN ('HR', 'Admin'));"

# Step 4: Create employee_document_slots table
Run-SQL "Create employee_document_slots table" @"
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
"@

# Step 5: Indexes
Run-SQL "Create slot indexes" @"
CREATE INDEX IF NOT EXISTS slots_employee_id_idx ON public.employee_document_slots(employee_id);
CREATE INDEX IF NOT EXISTS slots_template_id_idx ON public.employee_document_slots(template_id);
"@

# Step 6: RLS on employee_document_slots
Run-SQL "Enable RLS on slots" "ALTER TABLE public.employee_document_slots ENABLE ROW LEVEL SECURITY;"
Run-SQL "slots select policy" "CREATE POLICY slots_select ON public.employee_document_slots FOR SELECT TO authenticated USING (employee_id = public.current_employee_id() OR public.current_user_role() IN ('HR', 'Admin'));"
Run-SQL "slots insert policy" "CREATE POLICY slots_insert ON public.employee_document_slots FOR INSERT TO authenticated WITH CHECK (employee_id = public.current_employee_id() OR public.current_user_role() IN ('HR', 'Admin'));"
Run-SQL "slots update policy" "CREATE POLICY slots_update ON public.employee_document_slots FOR UPDATE TO authenticated USING (employee_id = public.current_employee_id() OR public.current_user_role() IN ('HR', 'Admin'));"
Run-SQL "slots delete policy" "CREATE POLICY slots_delete_hr_admin ON public.employee_document_slots FOR DELETE TO authenticated USING (public.current_user_role() IN ('HR', 'Admin'));"

# Step 7: Seed default document templates
Run-SQL "Seed default document templates" @"
INSERT INTO public.document_templates (id, name, description, is_required, is_active, sort_order) VALUES
('tmpl-aadhaar', 'Aadhaar Card',             'Government-issued Aadhaar identity card (front and back)',     TRUE,  TRUE, 1),
('tmpl-pan',     'PAN Card',                 'Permanent Account Number card issued by Income Tax Department', TRUE,  TRUE, 2),
('tmpl-photo',   'Passport Photo',           'Recent passport-sized photograph (JPEG or PNG)',                TRUE,  TRUE, 3),
('tmpl-exp',     'Experience Letter',        'Experience letter from previous employer (if applicable)',      FALSE, TRUE, 4),
('tmpl-offer',   'Offer Letter (Signed)',    'Signed copy of Varistor offer letter',                         TRUE,  TRUE, 5),
('tmpl-edu',     'Educational Certificates', 'Degree or diploma certificates (highest qualification)',        TRUE,  TRUE, 6)
ON CONFLICT (name) DO NOTHING;
"@

# Step 8: Create the seed RPC function
Run-SQL "Create seed_employee_document_slots RPC" @"
CREATE OR REPLACE FUNCTION public.seed_employee_document_slots(p_employee_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS \$\$
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
\$\$;
"@

# Step 9: Seed slots for all existing employees
Run-SQL "Seed slots for all existing employees" @"
DO \$\$
DECLARE
  emp RECORD;
BEGIN
  FOR emp IN SELECT id FROM public.employees LOOP
    PERFORM public.seed_employee_document_slots(emp.id);
  END LOOP;
END;
\$\$;
"@

Write-Host "`nMigration 002 complete."
