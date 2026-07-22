-- ============================================================
-- Varistor EOPMS — Supabase PostgreSQL Schema
-- Migration: 001_schema.sql
-- RLS policies use auth_id UUID column (matches auth.uid())
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- EMPLOYEES (must be first — helpers reference this table)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employees (
  id                TEXT PRIMARY KEY,           -- e.g. "VAR-001"
  auth_id           UUID UNIQUE,                -- Supabase auth.users.id
  full_name         TEXT NOT NULL,
  employee_id       TEXT NOT NULL UNIQUE,
  username          TEXT NOT NULL UNIQUE,
  personal_email    TEXT NOT NULL UNIQUE,
  phone             TEXT DEFAULT '',
  department        TEXT NOT NULL,
  reporting_manager TEXT DEFAULT '',
  role              TEXT NOT NULL DEFAULT 'Employee',
  temp_password     TEXT DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'Active',
  vari_points       INTEGER NOT NULL DEFAULT 0,
  is_field_employee BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url        TEXT DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- HELPER: get current user's role from employees table
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT role FROM public.employees WHERE auth_id = auth.uid() LIMIT 1);
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- HELPER: get current user's employee record id
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT id FROM public.employees WHERE auth_id = auth.uid() LIMIT 1);
END;
$$;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select_all_auth"
  ON public.employees FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "employees_insert_hr_admin"
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "employees_update"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (
    auth_id = auth.uid()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "employees_delete_admin"
  ON public.employees FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() = 'Admin'
  );

-- ──────────────────────────────────────────────────────────────
-- ACTIVITY LOG
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_log (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  action       TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  details      TEXT DEFAULT '',
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_select"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (
    performed_by = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "activity_log_insert_auth"
  ON public.activity_log FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- ──────────────────────────────────────────────────────────────
-- DOCUMENTS (Vault)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.documents (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  employee_id  TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'PDF',
  size         TEXT DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'Pending',
  storage_path TEXT DEFAULT '',
  upload_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_employee_id_idx ON public.documents(employee_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "documents_insert"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "documents_update"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

-- ──────────────────────────────────────────────────────────────
-- POLICIES (Company Policy documents)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.policies (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title          TEXT NOT NULL,
  target         TEXT NOT NULL DEFAULT 'Both',
  content        TEXT NOT NULL DEFAULT '',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policies_select_all_auth"
  ON public.policies FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "policies_write_hr_admin"
  ON public.policies FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'))
  WITH CHECK (public.current_user_role() IN ('HR', 'Admin'));

-- ──────────────────────────────────────────────────────────────
-- ANNOUNCEMENTS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.announcements (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'HR',
  type        TEXT NOT NULL DEFAULT 'Standard',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select_auth"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "announcements_insert_hr_admin"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('HR', 'Admin'));

CREATE POLICY "announcements_delete_hr_admin"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'));

-- ──────────────────────────────────────────────────────────────
-- ANNOUNCEMENT REACTIONS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.announcement_reactions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  announcement_id TEXT NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  emoji_type      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (announcement_id, user_id, emoji_type)
);

CREATE INDEX IF NOT EXISTS announcement_reactions_ann_idx ON public.announcement_reactions(announcement_id);

ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcement_reactions_select_auth"
  ON public.announcement_reactions FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "announcement_reactions_insert_auth"
  ON public.announcement_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = public.current_employee_id());

CREATE POLICY "announcement_reactions_delete_own"
  ON public.announcement_reactions FOR DELETE
  TO authenticated
  USING (user_id = public.current_employee_id());

-- ──────────────────────────────────────────────────────────────
-- ANNOUNCEMENT READS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  announcement_id TEXT NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS announcement_reads_ann_idx ON public.announcement_reads(announcement_id);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcement_reads_select_own"
  ON public.announcement_reads FOR SELECT
  TO authenticated
  USING (user_id = public.current_employee_id());

CREATE POLICY "announcement_reads_insert_own"
  ON public.announcement_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = public.current_employee_id());

-- ──────────────────────────────────────────────────────────────
-- LEAVE REQUESTS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  employee_id       TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name     TEXT NOT NULL,
  department        TEXT NOT NULL,
  type              TEXT NOT NULL,
  from_date         DATE NOT NULL,
  to_date           DATE NOT NULL,
  days              INTEGER NOT NULL DEFAULT 1,
  reason            TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'Pending',
  reviewer_id       TEXT REFERENCES public.employees(id),
  reviewer_name     TEXT DEFAULT '',
  rejection_comment TEXT DEFAULT '',
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS leave_requests_employee_id_idx ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx ON public.leave_requests(status);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_requests_select"
  ON public.leave_requests FOR SELECT
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin', 'Reporting Manager')
  );

CREATE POLICY "leave_requests_insert_own"
  ON public.leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = public.current_employee_id());

CREATE POLICY "leave_requests_update"
  ON public.leave_requests FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin', 'Reporting Manager'));

-- ──────────────────────────────────────────────────────────────
-- LEAVE BALANCES
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  employee_id    TEXT NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  casual_total   INTEGER NOT NULL DEFAULT 12,
  casual_used    INTEGER NOT NULL DEFAULT 0,
  sick_total     INTEGER NOT NULL DEFAULT 10,
  sick_used      INTEGER NOT NULL DEFAULT 0,
  earned_total   INTEGER NOT NULL DEFAULT 15,
  earned_used    INTEGER NOT NULL DEFAULT 0,
  unpaid_taken   INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_balances_select"
  ON public.leave_balances FOR SELECT
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "leave_balances_write"
  ON public.leave_balances FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- ──────────────────────────────────────────────────────────────
-- HOLIDAYS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.holidays (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  date         DATE NOT NULL UNIQUE,
  occasion     TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'National',
  apply_to_all BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   TEXT DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holidays_select_auth"
  ON public.holidays FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "holidays_write_hr_admin"
  ON public.holidays FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'))
  WITH CHECK (public.current_user_role() IN ('HR', 'Admin'));

-- ──────────────────────────────────────────────────────────────
-- ATTENDANCE LEDGER
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attendance_ledger (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  employee_id       TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  punch_in          TIMESTAMPTZ,
  punch_out         TIMESTAMPTZ,
  work_hours        NUMERIC(5,2),
  status            TEXT NOT NULL DEFAULT 'Absent',
  source            TEXT NOT NULL DEFAULT 'device',
  confidence        NUMERIC(5,2),
  photo_url         TEXT DEFAULT '',
  override_reason   TEXT DEFAULT '',
  editor_id         TEXT REFERENCES public.employees(id),
  edited_at         TIMESTAMPTZ,
  is_field_employee BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS attendance_ledger_employee_date_idx ON public.attendance_ledger(employee_id, date);
CREATE INDEX IF NOT EXISTS attendance_ledger_date_idx ON public.attendance_ledger(date);

ALTER TABLE public.attendance_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_ledger_select"
  ON public.attendance_ledger FOR SELECT
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin', 'Reporting Manager')
  );

CREATE POLICY "attendance_ledger_insert"
  ON public.attendance_ledger FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "attendance_ledger_update"
  ON public.attendance_ledger FOR UPDATE
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

-- ──────────────────────────────────────────────────────────────
-- ATTENDANCE EDITS (Audit Trail)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attendance_edits (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  ledger_id     TEXT NOT NULL,
  employee_id   TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  editor_id     TEXT NOT NULL REFERENCES public.employees(id),
  old_punch_in  TIMESTAMPTZ,
  old_punch_out TIMESTAMPTZ,
  old_status    TEXT NOT NULL,
  new_punch_in  TIMESTAMPTZ,
  new_punch_out TIMESTAMPTZ,
  new_status    TEXT NOT NULL,
  reason        TEXT NOT NULL,
  edited_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS attendance_edits_employee_id_idx ON public.attendance_edits(employee_id);

ALTER TABLE public.attendance_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_edits_select_hr_admin"
  ON public.attendance_edits FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'));

CREATE POLICY "attendance_edits_insert_hr_admin"
  ON public.attendance_edits FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('HR', 'Admin'));

-- ──────────────────────────────────────────────────────────────
-- FIELD ATTENDANCE PHOTOS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.field_attendance_photos (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  employee_id         TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  photo_url           TEXT NOT NULL DEFAULT '',
  storage_path        TEXT NOT NULL DEFAULT '',
  punch_type          TEXT NOT NULL DEFAULT 'in',
  verification_status TEXT NOT NULL DEFAULT 'Pending',
  verified_by         TEXT REFERENCES public.employees(id),
  verified_at         TIMESTAMPTZ,
  confidence_score    NUMERIC(5,2),
  latitude            NUMERIC(12,8),
  longitude           NUMERIC(12,8),
  location_accuracy   NUMERIC(8,2),
  punch_time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS field_photos_employee_date_idx ON public.field_attendance_photos(employee_id, date);

ALTER TABLE public.field_attendance_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "field_photos_select"
  ON public.field_attendance_photos FOR SELECT
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "field_photos_insert_own"
  ON public.field_attendance_photos FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = public.current_employee_id());

CREATE POLICY "field_photos_update_hr_admin"
  ON public.field_attendance_photos FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'));

-- ──────────────────────────────────────────────────────────────
-- TRAINING MODULES
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.training_modules (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  track            TEXT NOT NULL DEFAULT 'General',
  department       TEXT DEFAULT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  thumbnail_url    TEXT DEFAULT '',
  video_url        TEXT DEFAULT '',
  "order"          INTEGER NOT NULL DEFAULT 1,
  prerequisite_id  TEXT REFERENCES public.training_modules(id) ON DELETE SET NULL,
  visible_to_roles TEXT[] DEFAULT '{}',
  is_seed          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_modules_select_auth"
  ON public.training_modules FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "training_modules_write_hr_admin"
  ON public.training_modules FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'))
  WITH CHECK (public.current_user_role() IN ('HR', 'Admin'));

-- ──────────────────────────────────────────────────────────────
-- QUIZ QUESTIONS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  module_id      TEXT NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  question       TEXT NOT NULL,
  options        TEXT[] NOT NULL,
  correct_index  INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quiz_questions_module_idx ON public.quiz_questions(module_id);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_questions_select_auth"
  ON public.quiz_questions FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "quiz_questions_write_hr_admin"
  ON public.quiz_questions FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'))
  WITH CHECK (public.current_user_role() IN ('HR', 'Admin'));

-- ──────────────────────────────────────────────────────────────
-- TRAINING PROGRESS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.training_progress (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  employee_id     TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  module_id       TEXT NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, module_id)
);

CREATE INDEX IF NOT EXISTS training_progress_employee_idx ON public.training_progress(employee_id);

ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_progress_select"
  ON public.training_progress FOR SELECT
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "training_progress_insert_own"
  ON public.training_progress FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = public.current_employee_id());

CREATE POLICY "training_progress_update_own"
  ON public.training_progress FOR UPDATE
  TO authenticated
  USING (employee_id = public.current_employee_id());

-- ──────────────────────────────────────────────────────────────
-- QUIZ ATTEMPTS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  employee_id  TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  module_id    TEXT NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  answers      JSONB NOT NULL DEFAULT '{}',
  score        INTEGER NOT NULL DEFAULT 0,
  passed       BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quiz_attempts_employee_module_idx ON public.quiz_attempts(employee_id, module_id);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_attempts_select"
  ON public.quiz_attempts FOR SELECT
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "quiz_attempts_insert_own"
  ON public.quiz_attempts FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = public.current_employee_id());

-- ──────────────────────────────────────────────────────────────
-- PAYROLL RECORDS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_records (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  employee_id    TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name  TEXT NOT NULL,
  department     TEXT NOT NULL,
  designation    TEXT NOT NULL DEFAULT '',
  month          TEXT NOT NULL,
  ctc            NUMERIC(12,2) NOT NULL DEFAULT 0,
  components     JSONB NOT NULL DEFAULT '{}',
  net_pay        NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft',
  revision       INTEGER NOT NULL DEFAULT 1,
  approved_by    TEXT REFERENCES public.employees(id),
  approved_at    TIMESTAMPTZ,
  auto_formula   BOOLEAN NOT NULL DEFAULT TRUE,
  total_days     INTEGER NOT NULL DEFAULT 0,
  pay_days       NUMERIC(5,2) NOT NULL DEFAULT 0,
  cl_balance     INTEGER NOT NULL DEFAULT 0,
  pf_uan         TEXT DEFAULT '',
  monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, month, revision)
);

CREATE INDEX IF NOT EXISTS payroll_records_employee_idx ON public.payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS payroll_records_month_idx ON public.payroll_records(month);

ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_records_select"
  ON public.payroll_records FOR SELECT
  TO authenticated
  USING (
    (employee_id = public.current_employee_id() AND status = 'approved')
    OR public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "payroll_records_insert_hr_admin"
  ON public.payroll_records FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('HR', 'Admin'));

CREATE POLICY "payroll_records_update_hr_admin"
  ON public.payroll_records FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'));

-- ──────────────────────────────────────────────────────────────
-- PAYROLL AUDIT
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_audit (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  record_id    TEXT NOT NULL REFERENCES public.payroll_records(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  changes      JSONB DEFAULT '{}',
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payroll_audit_record_idx ON public.payroll_audit(record_id);

ALTER TABLE public.payroll_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_audit_select_hr_admin"
  ON public.payroll_audit FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'));

CREATE POLICY "payroll_audit_insert_hr_admin"
  ON public.payroll_audit FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('HR', 'Admin'));

-- ──────────────────────────────────────────────────────────────
-- TRIGGERS: auto-update updated_at
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_progress_updated_at
  BEFORE UPDATE ON public.training_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER payroll_records_updated_at
  BEFORE UPDATE ON public.payroll_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER policies_updated_at
  BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER leave_balances_updated_at
  BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
