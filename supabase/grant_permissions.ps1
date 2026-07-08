$token = "sbp_8da2c34047998a1512d7e5de29d5130f36fbefae"
$projectRef = "vghttoqhflmbjztsphjy"
$dbUrl = "https://api.supabase.com/v1/projects/$projectRef/database/query"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

$sql = @"
-- Grant usage on schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant all privileges on all tables in public to anon, authenticated (RLS will restrict actual access)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Grant all privileges on all sequences in public to anon, authenticated
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Grant all privileges on all functions in public to anon, authenticated
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Alter default privileges for future tables/sequences/functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;
"@

$body = @{ query = $sql } | ConvertTo-Json -Compress

Write-Host "Granting permissions..."
try {
    Invoke-RestMethod -Uri $dbUrl -Method POST -Headers $headers -Body $body -ContentType "application/json" | Out-Null
    Write-Host "Permissions granted successfully!"
} catch {
    Write-Host "Error granting permissions: $($_.ErrorDetails.Message)"
}
