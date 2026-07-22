$token = "sbp_8da2c34047998a1512d7e5de29d5130f36fbefae"
$projectRef = "vghttoqhflmbjztsphjy"
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

function Create-Bucket($name, $public) {
    $url = "https://api.supabase.com/v1/projects/$projectRef/storage/buckets"
    $body = @{ id = $name; name = $name; public = $public; file_size_limit = 52428800 } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body | Out-Null
        Write-Host "Bucket '$name' created (public=$public)"
    } catch {
        Write-Host "Bucket '$name': $($_.ErrorDetails.Message)"
    }
}

Create-Bucket "employee-documents" $false
Create-Bucket "attendance-photos"  $false
Create-Bucket "training-videos"    $false
Create-Bucket "avatars"            $true

Write-Host "`nStorage buckets done."
