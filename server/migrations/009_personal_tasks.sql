CREATE TABLE app.personal_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_uid text NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 due_date date, date_set date NOT NULL, description text NOT NULL DEFAULT '' CHECK(length(description)<=20000),
 completed boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.personal_tasks(owner_uid,created_at);
GRANT SELECT,INSERT,UPDATE,DELETE ON app.personal_tasks TO rptpc_app;
ALTER TABLE app.attachments ADD COLUMN task_id uuid REFERENCES app.personal_tasks(id) ON DELETE CASCADE;
ALTER TABLE app.attachments DROP CONSTRAINT attachments_owner_check;
ALTER TABLE app.attachments ADD CONSTRAINT attachments_owner_check CHECK(num_nonnulls(assignment_id,post_id,work_id,attempt_id,task_id)=1);
CREATE INDEX ON app.attachments(task_id);
