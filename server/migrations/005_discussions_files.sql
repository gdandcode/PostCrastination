ALTER TABLE app.classes ADD COLUMN discussions_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE app.classes ADD COLUMN student_posts boolean NOT NULL DEFAULT true;
ALTER TABLE app.classes ADD COLUMN student_replies boolean NOT NULL DEFAULT true;
CREATE TABLE app.discussion_posts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 class_id uuid NOT NULL REFERENCES app.classes(id),
 author_uid text NOT NULL, body text NOT NULL,
 parent_id uuid REFERENCES app.discussion_posts(id),
 deleted boolean NOT NULL DEFAULT false, locked boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.discussion_posts(class_id,created_at);
CREATE TABLE app.attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 assignment_id uuid REFERENCES app.assignments(id) ON DELETE CASCADE,
 post_id uuid REFERENCES app.discussion_posts(id) ON DELETE CASCADE,
 name text NOT NULL, content bytea NOT NULL,
 CHECK ((assignment_id IS NULL) <> (post_id IS NULL)),
 CHECK (octet_length(content) BETWEEN 1 AND 10485760)
);
CREATE INDEX ON app.attachments(assignment_id);
CREATE INDEX ON app.attachments(post_id);
GRANT SELECT,INSERT,UPDATE,DELETE ON app.discussion_posts,app.attachments TO rptpc_app;
