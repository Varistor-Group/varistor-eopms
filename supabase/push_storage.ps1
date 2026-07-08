$token = "sbp_8da2c34047998a1512d7e5de29d5130f36fbefae"
$projectRef = "vghttoqhflmbjztsphjy"
$dbUrl = "https://api.supabase.com/v1/projects/$projectRef/database/query"
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

function Run-SQL($label, $sql) {
    $payload = '{"query":' + ($sql | ConvertTo-Json) + '}'
    try {
        Invoke-RestMethod -Uri $dbUrl -Method POST -Headers $headers -Body $payload -ContentType "application/json" | Out-Null
        Write-Host "[$label] OK"
    } catch {
        Write-Host "[$label] ERROR: $($_.ErrorDetails.Message)"
    }
}

Run-SQL "Create buckets" "INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('employee-documents','employee-documents',false,52428800),('attendance-photos','attendance-photos',false,10485760),('training-videos','training-videos',false,524288000),('avatars','avatars',true,5242880) ON CONFLICT (id) DO NOTHING;"

Run-SQL "Documents upload policy" "CREATE POLICY ""documents_upload_own"" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'employee-documents' AND (storage.foldername(name))[1] = public.current_employee_id());"

Run-SQL "Documents read policy" "CREATE POLICY ""documents_read_own_or_hr"" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'employee-documents' AND ((storage.foldername(name))[1] = public.current_employee_id() OR public.current_user_role() IN ('HR','Admin')));"

Run-SQL "Attendance photos upload" "CREATE POLICY ""attendance_photos_upload_own"" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attendance-photos' AND (storage.foldername(name))[1] = public.current_employee_id());"

Run-SQL "Attendance photos read" "CREATE POLICY ""attendance_photos_read"" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attendance-photos' AND ((storage.foldername(name))[1] = public.current_employee_id() OR public.current_user_role() IN ('HR','Admin')));"

Run-SQL "Avatars upload" "CREATE POLICY ""avatars_upload_own"" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = public.current_employee_id());"

Run-SQL "Avatars read public" "CREATE POLICY ""avatars_read_public"" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');"

Run-SQL "Training videos upload" "CREATE POLICY ""training_videos_upload_hr_admin"" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'training-videos' AND public.current_user_role() IN ('HR','Admin'));"

Run-SQL "Training videos read" "CREATE POLICY ""training_videos_read_auth"" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'training-videos');"

Write-Host "Done."
