-- Domain tables will be introduced alongside authenticated application features.
-- The web process can read the migration version but cannot change the schema.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO rptpc_app;
GRANT SELECT ON app.schema_migrations TO rptpc_app;
