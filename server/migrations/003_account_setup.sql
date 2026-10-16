ALTER TABLE app.community_profiles
  ADD COLUMN study_location text NOT NULL DEFAULT '' CHECK (length(study_location)<=120),
  ADD COLUMN onboarding_complete boolean NOT NULL DEFAULT false;
