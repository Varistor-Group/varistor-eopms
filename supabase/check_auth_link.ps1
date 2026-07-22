$token = "sbp_8da2c34047998a1512d7e5de29d5130f36fbefae"
$projectRef = "vghttoqhflmbjztsphjy"
$dbUrl = "https://api.supabase.com/v1/projects/$projectRef/database/query"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

$sql = "SELECT id, employee_id, full_name, personal_email, auth_id FROM public.employees;"
$body = @{ query = $sql } | ConvertTo-Json

$response = Invoke-RestMethod -Uri $dbUrl -Method POST -Headers $headers -Body $body -ContentType "application/json"
$response | ConvertTo-Json -Depth 5
