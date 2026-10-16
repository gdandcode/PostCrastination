CREATE TABLE app.community_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL UNIQUE CHECK (length(firebase_uid) BETWEEN 1 AND 128),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_profiles_list ON app.community_profiles(created_at DESC, id) WHERE visible;
GRANT SELECT, INSERT, UPDATE ON app.community_profiles TO rptpc_app;
