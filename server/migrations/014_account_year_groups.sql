ALTER TABLE app.community_profiles ADD COLUMN year_group text CHECK(year_group IS NULL OR year_group ~ '^Y([1-9]|1[0-3])$');
