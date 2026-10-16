CREATE TABLE app.behaviour_points (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid NOT NULL REFERENCES app.classes(id),
 teacher_uid text NOT NULL,student_uid text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('commendation','demerit')),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 description text NOT NULL CHECK(length(description) BETWEEN 1 AND 20000),
 point_date date NOT NULL,subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 100),
 category text,intervention boolean NOT NULL DEFAULT false,intervention_notes text NOT NULL DEFAULT '' CHECK(length(intervention_notes)<=2000),
 request_id uuid NOT NULL,payload_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='commendation' AND category IS NULL AND NOT intervention AND intervention_notes='') OR
 (kind='demerit' AND category IN ('Inappropriate use of devices','Non-compliance with uniform requirements','Failure to complete homework','Academic dishonesty','Inappropriate behaviour','Failure to follow instructions'))),
 UNIQUE(teacher_uid,request_id)
);
CREATE INDEX ON app.behaviour_points(student_uid,point_date DESC);
CREATE INDEX ON app.behaviour_points(teacher_uid,point_date DESC);
GRANT SELECT,INSERT ON app.behaviour_points TO rptpc_app;
