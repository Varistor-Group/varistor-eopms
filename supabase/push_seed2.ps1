$token = "sbp_8da2c34047998a1512d7e5de29d5130f36fbefae"
$projectRef = "vghttoqhflmbjztsphjy"
$url = "https://api.supabase.com/v1/projects/$projectRef/database/query"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

function Run-SQL($label, $sql) {
    $body = [ordered]@{ query = $sql }
    $json = $body | ConvertTo-Json -Depth 5 -Compress
    try {
        $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $json -ContentType "application/json"
        Write-Host "[$label] SUCCESS"
    } catch {
        Write-Host "[$label] ERROR: $($_.ErrorDetails.Message)"
    }
}

# Training Modules (no special chars in strings)
Run-SQL "Training Modules" @"
INSERT INTO public.training_modules (id, title, description, track, department, duration_seconds, thumbnail_url, video_url, "order", prerequisite_id, visible_to_roles, is_seed) VALUES
('mod-gen-1','Welcome and Company Values','An introduction to Varistor Technologies - our mission, culture, and what we stand for.','General',NULL,480,'https://images.unsplash.com/photo-1552664730-d307ca884978?w=640&fit=crop&q=60','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',1,NULL,'{}',true),
('mod-gen-2','General Behaviour and POSH','Workplace conduct standards and the Prevention of Sexual Harassment policy - mandatory for all employees.','General',NULL,750,'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=640&fit=crop&q=60','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',2,'mod-gen-1','{}',true),
('mod-gen-3','Data Security and IT Policy','How to handle company data responsibly - acceptable use of devices, password hygiene, and incident reporting.','General',NULL,600,'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=640&fit=crop&q=60','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',3,'mod-gen-2','{}',true),
('mod-dept-1','Department Orientation - Operations SOPs','Standard Operating Procedures for the Operations department. Covers daily workflows and escalation paths.','Department','Operations',900,'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=640&fit=crop&q=60','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',1,NULL,'{}',true),
('mod-dept-2','Tool Onboarding - EOPMS Walkthrough','A hands-on walkthrough of the Varistor EOPMS platform - tasks, Vari Points, leaves, payroll, and chat.','Department','Operations',660,'https://images.unsplash.com/photo-1497366216548-37526070297c?w=640&fit=crop&q=60','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',2,'mod-dept-1','{}',true),
('mod-tech-1','Technical Training - Role Specific','Role-specific technical onboarding covering the tools, frameworks, and internal systems used by your team.','Tech',NULL,1200,'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=640&fit=crop&q=60','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',1,NULL,'{}',true)
ON CONFLICT (id) DO NOTHING;
"@

# Quiz Questions (batched in 2 to stay under size limit)
Run-SQL "Quiz Questions Part 1" @"
INSERT INTO public.quiz_questions (id, module_id, question, options, correct_index) VALUES
('q1-1','mod-gen-1','What is the primary mission of Varistor Technologies?',ARRAY['Maximize shareholder value','Deliver technology solutions with integrity','Expand to international markets','Reduce operational costs'],1),
('q1-2','mod-gen-1','Which value is at the core of Varistor culture?',ARRAY['Speed above all else','Collaboration and transparency','Individual recognition only','Cost minimization'],1),
('q1-3','mod-gen-1','How many departments does Varistor currently operate?',ARRAY['4','5','6','8'],2),
('q2-1','mod-gen-2','According to POSH, what counts as workplace harassment?',ARRAY['Constructive performance feedback','Unwelcome conduct of a sexual nature','Requesting deadline extensions','Cross-department collaboration'],1),
('q2-2','mod-gen-2','Who should you contact first if you witness harassment?',ARRAY['The CEO','Your buddy','The HR/Admin team or ICC','A client'],2),
('q2-3','mod-gen-2','The POSH Act applies to which employees?',ARRAY['Only female employees','Only permanent employees','All employees regardless of gender or contract type','Only senior management'],2),
('q2-4','mod-gen-2','What is the expected professional behaviour when working late?',ARRAY['Inform HR and ensure someone else is present','Work alone without informing anyone','Leave early instead','Ask a client to supervise'],0),
('q3-1','mod-gen-3','You receive a suspicious email asking for your EOPMS password. What do you do?',ARRAY['Reply with your password','Forward it to HR and IT immediately','Ignore it and continue working','Share it with a colleague to check'],1),
('q3-2','mod-gen-3','Which of the following is an acceptable password practice?',ARRAY['Using your name and birthdate','Sharing passwords with your manager','Using a unique password with over 12 characters','Reusing old passwords'],2),
('q3-3','mod-gen-3','Company data must be stored where?',ARRAY['On personal Google Drive','On company-approved systems only','On USB drives for easy sharing','Locally only, never in cloud'],1)
ON CONFLICT (id) DO NOTHING;
"@

Run-SQL "Quiz Questions Part 2" @"
INSERT INTO public.quiz_questions (id, module_id, question, options, correct_index) VALUES
('q4-1','mod-dept-1','Daily task updates must be submitted by which time?',ARRAY['9 AM','12 PM noon','End of day','Weekly on Friday'],2),
('q4-2','mod-dept-1','When a vendor delivery is delayed, you should first:',ARRAY['Wait and see','Alert your Reporting Manager immediately','Contact the client directly','Ignore it if under 24 hours'],1),
('q4-3','mod-dept-1','Material tracker pending items must be resolved within:',ARRAY['Same day','48 hours','One week','When convenient'],1),
('q5-1','mod-dept-2','On the EOPMS Kanban board, tasks need approval before being marked as:',ARRAY['In Progress','Done','Pending','Archived'],1),
('q5-2','mod-dept-2','Vari Points are awarded when a task is completed:',ARRAY['Any time','Before the due date','After manager reviews','At month end'],1),
('q5-3','mod-dept-2','Leave applications must be submitted:',ARRAY['On the day of leave','At least 1 day in advance','Only via email','Only for emergencies'],1),
('q6-1','mod-tech-1','Which version control system does Varistor use?',ARRAY['SVN','Mercurial','Git with GitHub','Perforce'],2),
('q6-2','mod-tech-1','Direct pushes to the main branch are:',ARRAY['Encouraged','Only for seniors','Never allowed - always use PRs','Allowed on Fridays'],2),
('q6-3','mod-tech-1','Which tech stack does the EOPMS frontend use?',ARRAY['Vue + Laravel','React + TypeScript + Vite','Angular + Django','Next.js + Go'],1),
('q6-4','mod-tech-1','API keys and secrets must NEVER be:',ARRAY['Stored in .env files','Rotated regularly','Committed to Git','Shared only with leads'],2)
ON CONFLICT (id) DO NOTHING;
"@

Write-Host "`nRemaining seed operations complete."
