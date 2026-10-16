ALTER TABLE app.community_profiles DROP CONSTRAINT community_profiles_account_role_check;
ALTER TABLE app.community_profiles ADD CONSTRAINT community_profiles_account_role_check CHECK (account_role IN ('student','teacher','sysadmin'));
