$token = "sbp_8da2c34047998a1512d7e5de29d5130f36fbefae"
$projectRef = "vghttoqhflmbjztsphjy"
$apiKey = (Get-Content .env | Select-String "VITE_SUPABASE_ANON_KEY" | ForEach-Object { $_.ToString().Split("=")[1] }).Trim()

$loginUrl = "https://$projectRef.supabase.co/auth/v1/token?grant_type=password"
$loginBody = @{
    email = "employee@varistor.in"
    password = "Employee@2026!"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri $loginUrl -Method POST -Headers @{ "apikey" = $apiKey } -Body $loginBody -ContentType "application/json"
$jwt = $loginResponse.access_token
$userId = $loginResponse.user.id

Write-Host "JWT length: $($jwt.Length)"

$queryUrl = "https://$projectRef.supabase.co/rest/v1/employees?select=id,full_name,personal_email,department,role,avatar_url&auth_id=eq.$userId"
try {
    $empResponse = Invoke-WebRequest -Uri $queryUrl -Method GET -Headers @{ "apikey" = $apiKey; "Authorization" = "Bearer $jwt" }
    Write-Host "Status: $($empResponse.StatusCode)"
    Write-Host "Content: $($empResponse.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Response.StatusCode) - $($_.Exception.Response.StatusDescription)"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "Error Content: $($reader.ReadToEnd())"
}
