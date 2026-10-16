CREATE TABLE app.classes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_uid text NOT NULL,
 name text NOT NULL, subject text NOT NULL DEFAULT '', code text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.memberships (
 class_id uuid REFERENCES app.classes(id) ON DELETE CASCADE,
 student_uid text NOT NULL, PRIMARY KEY(class_id,student_uid)
);
CREATE TABLE app.assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid NOT NULL REFERENCES app.classes(id),
 title text NOT NULL, details jsonb NOT NULL, published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.assignment_extras (
 assignment_id uuid REFERENCES app.assignments(id) ON DELETE CASCADE,
 student_uid text NOT NULL, PRIMARY KEY(assignment_id,student_uid)
);
CREATE TABLE app.assignment_results (
 assignment_id uuid REFERENCES app.assignments(id) ON DELETE CASCADE,
 student_uid text NOT NULL, done boolean NOT NULL DEFAULT false,
 completed_at timestamptz, grade text, feedback text NOT NULL DEFAULT '',
 PRIMARY KEY(assignment_id,student_uid)
);
CREATE INDEX ON app.classes(owner_uid);
CREATE INDEX ON app.memberships(student_uid);
CREATE INDEX ON app.assignments(class_id);
CREATE INDEX ON app.assignment_extras(student_uid);
GRANT SELECT,INSERT,UPDATE,DELETE ON app.classes,app.memberships,app.assignments,app.assignment_extras,app.assignment_results TO rptpc_app;
