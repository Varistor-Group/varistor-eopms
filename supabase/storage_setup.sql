-- Storage buckets (run in Supabase SQL editor)
-- Creates all 4 required storage buckets with appropriate RLS policies

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('employee-documents', 'employee-documents', false, 52428800, ARRAY['application/pdf','image/jpeg','image/png','image/jpg','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('attendance-photos',  'attendance-photos',  false, 10485760, ARRAY['image/jpeg','image/png','image/jpg','image/webp']),
  ('training-videos',    'training-videos',    false, 524288000, ARRAY['video/mp4','video/webm','video/ogg']),
  ('avatars',            'avatars',            true,  5242880,  ARRAY['image/jpeg','image/png','image/jpg','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: employee-documents
CREATE POLICY "documents_upload_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[1] = public.current_employee_id()
  );

CREATE POLICY "documents_read_own_or_hr"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = public.current_employee_id()
      OR public.current_user_role() IN ('HR', 'Admin')
    )
  );

CREATE POLICY "documents_delete_own_or_hr"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = public.current_employee_id()
      OR public.current_user_role() IN ('HR', 'Admin')
    )
  );

-- Storage RLS: attendance-photos
CREATE POLICY "attendance_photos_upload_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-photos'
    AND (storage.foldername(name))[1] = public.current_employee_id()
  );

CREATE POLICY "attendance_photos_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND (
      (storage.foldername(name))[1] = public.current_employee_id()
      OR public.current_user_role() IN ('HR', 'Admin')
    )
  );

-- Storage RLS: avatars (public bucket - anyone can read)
CREATE POLICY "avatars_upload_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.current_employee_id()
  );

CREATE POLICY "avatars_read_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Storage RLS: training-videos (HR/Admin upload, all auth users can read)
CREATE POLICY "training_videos_upload_hr_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'training-videos'
    AND public.current_user_role() IN ('HR', 'Admin')
  );

CREATE POLICY "training_videos_read_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-videos');
