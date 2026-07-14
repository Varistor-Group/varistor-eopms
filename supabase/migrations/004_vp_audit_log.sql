-- Create VP (Vacation Points) Audit Log Table
CREATE TABLE IF NOT EXISTS vp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id varchar NOT NULL,
  recipient_id varchar,
  points integer NOT NULL,
  type varchar NOT NULL CHECK (type IN ('credit', 'debit')),
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS Policies
ALTER TABLE vp_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read audit logs (or restrict to Admin/HR if desired)
CREATE POLICY "Allow authenticated to read vp_audit_log"
  ON vp_audit_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated (Admin/HR) to insert logs
CREATE POLICY "Allow Admin/HR to insert vp_audit_log"
  ON vp_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
