-- US-first ranking defaults (NextMilestone). ranking_settings was created with India
-- defaults (20250101000021: INR 12 LPA floor, India, English + Hindi, Asia/Kolkata).
-- New rows now start US-first with no salary floor. Existing rows are left alone: their
-- values may be choices the person made, and we can't tell those apart from defaults.

ALTER TABLE ranking_settings
  ALTER COLUMN min_salary SET DEFAULT 0,
  ALTER COLUMN min_salary_currency SET DEFAULT 'USD',
  ALTER COLUMN home_country SET DEFAULT 'United States',
  ALTER COLUMN known_languages SET DEFAULT '{English}',
  ALTER COLUMN timezone SET DEFAULT 'America/New_York';

COMMENT ON COLUMN ranking_settings.min_salary IS
  'Yearly floor in min_salary_currency; 0 means no floor (the default)';
