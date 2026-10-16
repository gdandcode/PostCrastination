CREATE TABLE app.class_resources(
 id uuid PRIMARY KEY, class_id uuid NOT NULL REFERENCES app.classes(id) ON DELETE CASCADE,
 parent_id uuid REFERENCES app.class_resources(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 180),
 kind text NOT NULL CHECK(kind IN ('folder','file')), content bytea,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='folder' AND content IS NULL) OR (kind='file' AND content IS NOT NULL AND octet_length(content)<=10485760)),
 UNIQUE(id,class_id), FOREIGN KEY(parent_id,class_id) REFERENCES app.class_resources(id,class_id)
);
CREATE UNIQUE INDEX class_resource_names ON app.class_resources(class_id,COALESCE(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(name));
CREATE INDEX ON app.class_resources(class_id,parent_id);
GRANT SELECT,INSERT ON app.class_resources TO rptpc_app;
