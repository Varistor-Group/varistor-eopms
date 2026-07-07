-- Function to create both Auth user and Employee profile in one transaction
-- Uses SECURITY DEFINER to bypass RLS and allow HR/Admin to write to auth.users

CREATE OR REPLACE FUNCTION public.create_employee_with_auth(
  p_employee_id text,
  p_full_name text,
  p_username text,
  p_personal_email text,
  p_phone text,
  p_department text,
  p_reporting_manager text,
  p_role text,
  p_temp_password text,
  p_is_field_employee boolean,
  p_avatar_url text DEFAULT ''
) RETURNS json AS $$
DECLARE
  new_uid uuid := gen_random_uuid();
BEGIN
  -- 1. Check if employee ID already exists
  IF EXISTS (SELECT 1 FROM public.employees WHERE employee_id = p_employee_id) THEN
    RETURN json_build_object('success', false, 'error', 'Employee ID already exists.');
  END IF;

  -- 1b. Check if personal email already exists in employees table
  IF EXISTS (SELECT 1 FROM public.employees WHERE personal_email = p_personal_email) THEN
    RETURN json_build_object('success', false, 'error', 'An employee with this personal email already exists.');
  END IF;

  -- 1c. Check if username already exists in employees table
  IF EXISTS (SELECT 1 FROM public.employees WHERE username = p_username) THEN
    RETURN json_build_object('success', false, 'error', 'An employee with this username already exists.');
  END IF;

  -- 2. Check if email already exists in Auth
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_personal_email) THEN
    RETURN json_build_object('success', false, 'error', 'An account with this email already exists.');
  END IF;

  -- 3. Insert into auth.users securely
  INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_uid,
      'authenticated',
      'authenticated',
      p_personal_email,
      crypt(p_temp_password, gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(), NOW(), '', '', '', ''
    );

  -- 4. Insert into public.employees
  INSERT INTO public.employees (
    id, auth_id, employee_id, full_name, username, personal_email, 
    phone, department, reporting_manager, role, temp_password, 
    status, vari_points, is_field_employee, avatar_url
  ) VALUES (
    p_employee_id, new_uid, p_employee_id, p_full_name, p_username, p_personal_email,
    p_phone, p_department, p_reporting_manager, p_role, p_temp_password,
    'Active', 0, p_is_field_employee, p_avatar_url
  );

  RETURN json_build_object('success', true, 'employee_id', p_employee_id, 'auth_id', new_uid);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
