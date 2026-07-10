-- 1. Create the function that contains the logic
CREATE OR REPLACE FUNCTION check_and_apply_late_penalty()
RETURNS trigger AS $$
DECLARE
  total_hours numeric;
BEGIN
  -- Only execute if both punch_in and punch_out are present
  IF NEW.punch_in IS NOT NULL AND NEW.punch_out IS NOT NULL THEN
    
    -- Calculate difference in hours
    total_hours := EXTRACT(EPOCH FROM (NEW.punch_out::timestamp - NEW.punch_in::timestamp)) / 3600;
    
    -- Assign the calculated hours to the row
    NEW.work_hours := ROUND(total_hours, 2);

    -- Apply the penalty rule
    IF total_hours < 9.0 THEN
      -- Only apply to present/late, don't overwrite authorized leaves, half-days, or absent
      IF NEW.status IN ('Present', 'Late') THEN
        NEW.status := 'Late';
      END IF;
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Bind the function to trigger before an update on the attendance_ledger table
DROP TRIGGER IF EXISTS attendance_penalty_trigger ON attendance_ledger;
CREATE TRIGGER attendance_penalty_trigger
BEFORE UPDATE ON attendance_ledger
FOR EACH ROW
WHEN (NEW.punch_out IS NOT NULL AND OLD.punch_out IS DISTINCT FROM NEW.punch_out)
EXECUTE FUNCTION check_and_apply_late_penalty();
