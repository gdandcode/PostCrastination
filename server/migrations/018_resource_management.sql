ALTER TABLE app.class_resources ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_root uuid;
DROP INDEX app.class_resource_names;
CREATE UNIQUE INDEX class_resource_names ON app.class_resources(class_id,COALESCE(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(name)) WHERE deleted_at IS NULL;
GRANT UPDATE(name,parent_id,deleted_at,deleted_root) ON app.class_resources TO rptpc_app;
