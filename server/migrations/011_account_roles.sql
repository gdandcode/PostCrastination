ALTER TABLE app.community_profiles ADD COLUMN account_role text NOT NULL DEFAULT 'student' CHECK (account_role IN ('student','teacher'));
UPDATE app.community_profiles p SET account_role='teacher' WHERE EXISTS(SELECT 1 FROM app.classes c WHERE c.owner_uid=p.firebase_uid);
