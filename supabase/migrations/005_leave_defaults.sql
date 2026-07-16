-- ============================================================
-- Varistor EOPMS — Leave balance defaults
-- Migration: 005_leave_defaults.sql
--
-- Standardises the per-leave-type balance model used by the leave module
-- (leave_types + employee_leave_balances) and gives every existing employee
-- the default 12-day leave entitlement. New employees are initialised to 12
-- in code (see createEmployee); HR/Admin can adjust afterwards via the
-- Leave Balance Manager.
--
-- Safe to re-run: tables use IF NOT EXISTS, inserts are idempotent.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- LEAVE TYPES
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leave_types (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name               TEXT NOT NULL UNIQUE,
  description        TEXT NOT NULL DEFAULT '',
  default_allocation INTEGER NOT NULL DEFAULT 12,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_types_select_auth" ON public.leave_types;
CREATE POLICY "leave_types_select_auth"
  ON public.leave_types FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "leave_types_write_hr_admin" ON public.leave_types;
CREATE POLICY "leave_types_write_hr_admin"
  ON public.leave_types FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('HR', 'Admin'))
  WITH CHECK (public.current_user_role() IN ('HR', 'Admin'));

-- ──────────────────────────────────────────────────────────────
-- EMPLOYEE LEAVE BALANCES (per leave type)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employee_leave_balances (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  employee_id     TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_name TEXT NOT NULL,
  total           INTEGER NOT NULL DEFAULT 12,
  used            INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, leave_type_name)
);

ALTER TABLE public.employee_leave_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_leave_balances_select" ON public.employee_leave_balances;
CREATE POLICY "employee_leave_balances_select"
  ON public.employee_leave_balances FOR SELECT
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_role() IN ('HR', 'Admin')
  );

DROP POLICY IF EXISTS "employee_leave_balances_write" ON public.employee_leave_balances;
CREATE POLICY "employee_leave_balances_write"
  ON public.employee_leave_balances FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- ──────────────────────────────────────────────────────────────
-- DEFAULT LEAVE TYPE — standard 12-day entitlement
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.leave_types (name, description, default_allocation)
VALUES ('Casual Leave', 'Standard annual paid leave entitlement', 12)
ON CONFLICT (name) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- BACKFILL — every existing employee gets the default 12-day balance
-- (only where they do not already have a Casual Leave balance row).
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.employee_leave_balances (employee_id, leave_type_name, total, used)
SELECT e.id, 'Casual Leave', 12, 0
FROM public.employees e
WHERE NOT EXISTS (
  SELECT 1
  FROM public.employee_leave_balances b
  WHERE b.employee_id = e.id
    AND b.leave_type_name = 'Casual Leave'
);
