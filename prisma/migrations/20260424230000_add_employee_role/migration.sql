-- Add employee role so requester-only staff accounts can use institutional module
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'employee'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'employee';
  END IF;
END $$;

