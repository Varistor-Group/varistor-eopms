-- ============================================================
-- Varistor EOPMS — Seed Data
-- Run this AFTER creating users in Supabase Auth dashboard
-- OR use the auth.users insert below (requires service_role key)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- EMPLOYEE PROFILES (auth_id will be filled after auth user creation)
-- Run this first, then update auth_id once auth users are created
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.employees (id, employee_id, full_name, username, personal_email, phone, department, reporting_manager, role, temp_password, status, vari_points, avatar_url)
VALUES
  ('VAR-001', 'VAR-001', 'Admin User',    'admin',        'admin@varistor.in',    '+91 99999 99999', 'Management',      '',           'Admin',    'Admin@2026!',    'Active', 5000, 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=60'),
  ('VAR-002', 'VAR-002', 'Priya Sharma',  'priya.sharma', 'hr@varistor.in',       '+91 88888 88888', 'Human Resources', 'Admin User', 'HR',       'Hr@2026!',       'Active', 2000, 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&fit=crop&q=60'),
  ('VAR-003', 'VAR-003', 'Aarav Patel',   'aarav.patel',  'employee@varistor.in', '+91 98765 43210', 'Operations',      'Admin User', 'Employee', 'Employee@2026!', 'Active', 1800, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60')
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- LEAVE BALANCES for seed employees
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.leave_balances (employee_id, casual_total, casual_used, sick_total, sick_used, earned_total, earned_used, unpaid_taken)
VALUES
  ('VAR-001', 12, 0, 10, 0, 15, 0, 0),
  ('VAR-002', 12, 0, 10, 0, 15, 0, 0),
  ('VAR-003', 12, 0, 10, 0, 15, 0, 0)
ON CONFLICT (employee_id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- HOLIDAYS 2026
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.holidays (date, occasion, type, apply_to_all, created_by)
VALUES
  ('2026-01-26', 'Republic Day',           'National', true, 'VAR-002'),
  ('2026-03-28', 'Holi',                   'Festival', true, 'VAR-002'),
  ('2026-04-10', 'Good Friday',            'National', true, 'VAR-002'),
  ('2026-04-14', 'Dr. Ambedkar Jayanti',   'National', true, 'VAR-002'),
  ('2026-08-15', 'Independence Day',       'National', true, 'VAR-002'),
  ('2026-10-02', 'Gandhi Jayanti',         'National', true, 'VAR-002'),
  ('2026-11-04', 'Diwali',                 'Festival', true, 'VAR-002'),
  ('2026-11-05', 'Diwali (2nd day)',        'Festival', true, 'VAR-002'),
  ('2026-12-25', 'Christmas',              'National', true, 'VAR-002')
ON CONFLICT (date) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- ANNOUNCEMENTS (seed)
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.announcements (id, title, content, author_role, type, created_at)
VALUES
  ('ann-1', 'New POSH policy v2.1 published',
   'We have updated our Prevention of Sexual Harassment (POSH) guidelines. All employees are required to review the document and complete the mandatory training module in the learning panel by the end of the month.',
   'HR', 'Policy', NOW() - INTERVAL '2 hours'),
  ('ann-2', 'Quarterly town-hall this Friday',
   'Join us for our Q2 performance review town-hall this Friday at 3:00 PM in the main conference room.',
   'HR', 'Standard', NOW() - INTERVAL '5 hours'),
  ('ann-3', 'Office closed on 2nd Oct',
   'In observance of Gandhi Jayanti, the office will remain closed on October 2nd.',
   'HR', 'Standard', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- POLICIES (seed)
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.policies (id, title, target, content, effective_date)
VALUES
  ('pol-001', 'Code of Conduct',          'Both',   'Maintain professional behaviour at all times|Harassment or discrimination will result in disciplinary action|Violations should be reported to HR immediately', '2026-01-01'),
  ('pol-002', 'Work From Home Policy',    'Office', 'WFH allowed up to 2 days per week with prior approval|WFH days must be logged in the system by 9:00 AM|Repeated unapproved WFH treated as leave without pay', '2026-02-01'),
  ('pol-003', 'Data Confidentiality NDA', 'Both',   'All employees must adhere to the NDA signed at joining|Sharing proprietary data with external parties is prohibited|Violations are subject to legal action',  '2026-01-01')
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- TRAINING MODULES (seed — the built-in modules)
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.training_modules (id, title, description, track, department, duration_seconds, thumbnail_url, video_url, "order", prerequisite_id, visible_to_roles, is_seed)
VALUES
  ('mod-gen-1', 'Welcome & Company Values',
   'An introduction to Varistor Technologies — our mission, culture, and what we stand for as a team.',
   'General', NULL, 480,
   'https://images.unsplash.com/photo-1552664730-d307ca884978?w=640&fit=crop&q=60',
   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
   1, NULL, '{}', true),

  ('mod-gen-2', 'General Behaviour & POSH',
   'Workplace conduct standards and the Prevention of Sexual Harassment (POSH) policy — mandatory for all employees.',
   'General', NULL, 750,
   'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=640&fit=crop&q=60',
   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
   2, 'mod-gen-1', '{}', true),

  ('mod-gen-3', 'Data Security & IT Policy',
   'How to handle company data responsibly — acceptable use of devices, password hygiene, and incident reporting.',
   'General', NULL, 600,
   'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=640&fit=crop&q=60',
   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
   3, 'mod-gen-2', '{}', true),

  ('mod-dept-1', 'Department Orientation — Operations SOPs',
   'Standard Operating Procedures for the Operations department.',
   'Department', 'Operations', 900,
   'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=640&fit=crop&q=60',
   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
   1, NULL, '{}', true),

  ('mod-dept-2', 'Tool Onboarding — EOPMS Walkthrough',
   'A hands-on walkthrough of the Varistor EOPMS platform.',
   'Department', 'Operations', 660,
   'https://images.unsplash.com/photo-1497366216548-37526070297c?w=640&fit=crop&q=60',
   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
   2, 'mod-dept-1', '{}', true),

  ('mod-tech-1', 'Technical Training — Role Specific',
   'Role-specific technical onboarding covering the tools, frameworks, and internal systems used by your team.',
   'Tech', NULL, 1200,
   'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=640&fit=crop&q=60',
   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
   1, NULL, '{}', true)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- QUIZ QUESTIONS (seed)
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.quiz_questions (id, module_id, question, options, correct_index)
VALUES
  -- mod-gen-1
  ('q1-1', 'mod-gen-1', 'What is the primary mission of Varistor Technologies?',
   ARRAY['Maximize shareholder value','Deliver technology solutions with integrity','Expand to international markets','Reduce operational costs'], 1),
  ('q1-2', 'mod-gen-1', 'Which value is at the core of Varistor''s culture?',
   ARRAY['Speed above all else','Collaboration and transparency','Individual recognition only','Cost minimization'], 1),
  ('q1-3', 'mod-gen-1', 'How many departments does Varistor currently operate?',
   ARRAY['4','5','6','8'], 2),

  -- mod-gen-2
  ('q2-1', 'mod-gen-2', 'According to POSH, what counts as workplace harassment?',
   ARRAY['Constructive performance feedback','Unwelcome conduct of a sexual nature','Requesting deadline extensions','Cross-department collaboration'], 1),
  ('q2-2', 'mod-gen-2', 'Who should you contact first if you witness harassment?',
   ARRAY['The CEO','Your buddy','The HR/Admin team or ICC','A client'], 2),
  ('q2-3', 'mod-gen-2', 'The POSH Act applies to:',
   ARRAY['Only female employees','Only permanent employees','All employees regardless of gender or contract type','Only senior management'], 2),
  ('q2-4', 'mod-gen-2', 'What is the expected professional behaviour when working late?',
   ARRAY['Inform HR and ensure someone else is present','Work alone without informing anyone','Leave early instead','Ask a client to supervise'], 0),

  -- mod-gen-3
  ('q3-1', 'mod-gen-3', 'You receive a suspicious email asking for your EOPMS password. What do you do?',
   ARRAY['Reply with your password','Forward it to HR/IT immediately','Ignore it and continue working','Share it with a colleague to check'], 1),
  ('q3-2', 'mod-gen-3', 'Which of the following is an acceptable password practice?',
   ARRAY['Using your name and birthdate','Sharing passwords with your manager','Using a unique password with >12 characters','Reusing old passwords'], 2),
  ('q3-3', 'mod-gen-3', 'Company data must be stored:',
   ARRAY['On personal Google Drive','On company-approved systems only','On USB drives for easy sharing','Locally only, never in cloud'], 1),

  -- mod-dept-1
  ('q4-1', 'mod-dept-1', 'Daily task updates must be submitted by:',
   ARRAY['9 AM','12 PM (noon)','End of day','Weekly on Friday'], 2),
  ('q4-2', 'mod-dept-1', 'When a vendor delivery is delayed, you should first:',
   ARRAY['Wait and see','Alert your Reporting Manager immediately','Contact the client directly','Ignore it if under 24 hours'], 1),
  ('q4-3', 'mod-dept-1', 'Material tracker pending items must be resolved within:',
   ARRAY['Same day','48 hours','One week','When convenient'], 1),

  -- mod-dept-2
  ('q5-1', 'mod-dept-2', 'On the EOPMS Kanban board, tasks need approval before being marked as:',
   ARRAY['In Progress','Done','Pending','Archived'], 1),
  ('q5-2', 'mod-dept-2', 'Vari Points are awarded when a task is completed:',
   ARRAY['Any time','Before the due date','After manager reviews','At month end'], 1),
  ('q5-3', 'mod-dept-2', 'Leave applications must be submitted:',
   ARRAY['On the day of leave','At least 1 day in advance','Only via email','Only for emergencies'], 1),

  -- mod-tech-1
  ('q6-1', 'mod-tech-1', 'Which version control system does Varistor use?',
   ARRAY['SVN','Mercurial','Git with GitHub','Perforce'], 2),
  ('q6-2', 'mod-tech-1', 'Direct pushes to the main branch are:',
   ARRAY['Encouraged','Only for seniors','Never allowed — always use PRs','Allowed on Fridays'], 2),
  ('q6-3', 'mod-tech-1', 'Which tech stack does the EOPMS frontend use?',
   ARRAY['Vue + Laravel','React + TypeScript + Vite','Angular + Django','Next.js + Go'], 1),
  ('q6-4', 'mod-tech-1', 'API keys and secrets must NEVER be:',
   ARRAY['Stored in .env files','Rotated regularly','Committed to Git','Shared only with leads'], 2)
ON CONFLICT (id) DO NOTHING;
