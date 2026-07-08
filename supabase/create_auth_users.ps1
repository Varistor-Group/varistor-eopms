$token = "sbp_8da2c34047998a1512d7e5de29d5130f36fbefae"
$projectRef = "vghttoqhflmbjztsphjy"
$dbUrl = "https://api.supabase.com/v1/projects/$projectRef/database/query"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

function Run-SQL($label, $sql) {
    $body = @{ query = $sql } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod -Uri $dbUrl -Method POST -Headers $headers -Body $body -ContentType "application/json" | Out-Null
        Write-Host "[$label] SUCCESS"
    } catch {
        Write-Host "[$label] ERROR: $($_.ErrorDetails.Message)"
    }
}

$users = @(
    @{ email = "admin@varistor.in";    password = "Admin@2026!";    employeeId = "VAR-001" },
    @{ email = "hr@varistor.in";       password = "Hr@2026!";       employeeId = "VAR-002" },
    @{ email = "employee@varistor.in"; password = "Employee@2026!"; employeeId = "VAR-003" }
)

foreach ($user in $users) {
    # Create user via SQL using pgcrypto - insert directly into auth.users
    $sql = @"
DO `$`$
DECLARE
  new_uid uuid := gen_random_uuid();
BEGIN
  -- Only insert if not already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = '$($user.email)') THEN
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
      '$($user.email)',
      crypt('$($user.password)', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(), NOW(), '', '', '', ''
    );
    -- Link auth_id to employee record
    UPDATE public.employees SET auth_id = new_uid WHERE id = '$($user.employeeId)';
    RAISE NOTICE 'Created user % with id %', '$($user.email)', new_uid;
  ELSE
    -- Already exists - just link auth_id
    UPDATE public.employees
    SET auth_id = (SELECT id FROM auth.users WHERE email = '$($user.email)' LIMIT 1)
    WHERE id = '$($user.employeeId)';
    RAISE NOTICE 'User % already exists, linked auth_id', '$($user.email)';
  END IF;
END
`$`$;
"@
    Run-SQL "Auth user: $($user.email)" $sql
}

Write-Host "`nAuth user setup complete."
