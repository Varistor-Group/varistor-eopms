-- Function to delete both Auth user and Employee profile in one transaction
-- Uses SECURITY DEFINER to bypass RLS and allow HR/Admin to delete from auth.users

CREATE OR REPLACE FUNCTION public.delete_employee_with_auth(p_employee_id text)
RETURNS json AS $$
DECLARE
  v_auth_id uuid;
BEGIN
  -- 1. Get the auth_id for this employee
  SELECT auth_id INTO v_auth_id FROM public.employees WHERE id = p_employee_id;
  
  IF v_auth_id IS NOT NULL THEN
    -- 2. Delete from auth.users (this requires SECURITY DEFINER)
    DELETE FROM auth.users WHERE id = v_auth_id;
  END IF;

  -- 3. Delete from public.employees
  -- (Cascade will handle related records in public schema like documents, leave_requests etc)
  DELETE FROM public.employees WHERE id = p_employee_id;

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
