CREATE TABLE app.schools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE);
INSERT INTO app.schools(name) VALUES ('Sample Academy');
GRANT SELECT ON app.schools TO rptpc_app;
ALTER TABLE app.community_profiles ADD COLUMN school_id uuid REFERENCES app.schools(id);
