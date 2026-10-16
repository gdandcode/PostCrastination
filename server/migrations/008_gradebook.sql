ALTER TABLE app.community_profiles ADD COLUMN full_name text NOT NULL DEFAULT '' CHECK(length(full_name)<=160);
ALTER TABLE app.assignment_results ADD COLUMN grade_revision integer NOT NULL DEFAULT 0;
