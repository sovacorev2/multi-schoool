-- Feature toggles for two per-school features managed from super-admin:
-- the timetable generator (already built) and the exam/resources hub
-- (planned - the column is added now so both toggles ship together, the
-- Exam Hub UI itself will gate on this once it exists).
--
-- Both default to false: existing schools don't suddenly get a new nav tab
-- they haven't been onboarded onto.
ALTER TABLE schools ADD COLUMN IF NOT EXISTS feature_timetabling boolean NOT NULL DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS feature_exam_hub boolean NOT NULL DEFAULT false;
