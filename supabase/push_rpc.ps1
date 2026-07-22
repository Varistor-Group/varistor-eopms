$token = "sbp_8da2c34047998a1512d7e5de29d5130f36fbefae"
$projectRef = "vghttoqhflmbjztsphjy"
$dbUrl = "https://api.supabase.com/v1/projects/$projectRef/database/query"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

$sql = [string](Get-Content -Path "supabase\rpc_create_employee.sql" -Raw)
$body = @{ query = $sql } | ConvertTo-Json -Depth 5 -Compress

Write-Host "Deploying RPC function..."
try {
    Invoke-RestMethod -Uri $dbUrl -Method POST -Headers $headers -Body $body -ContentType "application/json" | Out-Null
    Write-Host "RPC function deployed successfully!"
} catch {
    Write-Host "Error deploying RPC function: $($_.ErrorDetails.Message)"
}
