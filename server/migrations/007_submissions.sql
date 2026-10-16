CREATE TABLE app.submission_work (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 assignment_id uuid NOT NULL REFERENCES app.assignments(id),
 student_uid text NOT NULL,
 status text NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','submitted','returned','changes_requested')),
 answer text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(assignment_id,student_uid)
);
CREATE TABLE app.submission_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 work_id uuid NOT NULL REFERENCES app.submission_work(id),
 number integer NOT NULL,
 answer text NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 review_status text CHECK(review_status IN ('returned','changes_requested')),
 grade text, feedback text NOT NULL DEFAULT '', reviewed_at timestamptz,
 UNIQUE(work_id,number)
);
ALTER TABLE app.attachments ADD COLUMN work_id uuid REFERENCES app.submission_work(id) ON DELETE CASCADE;
ALTER TABLE app.attachments ADD COLUMN attempt_id uuid REFERENCES app.submission_attempts(id) ON DELETE CASCADE;
ALTER TABLE app.attachments DROP CONSTRAINT attachments_check;
ALTER TABLE app.attachments ADD CONSTRAINT attachments_owner_check CHECK(num_nonnulls(assignment_id,post_id,work_id,attempt_id)=1);
CREATE INDEX ON app.attachments(work_id);
CREATE INDEX ON app.attachments(attempt_id);
CREATE TABLE app.school_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_uid text NOT NULL,
 event_key text NOT NULL,assignment_id uuid NOT NULL REFERENCES app.assignments(id),
 message text NOT NULL,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_uid,event_key)
);
CREATE INDEX ON app.school_notifications(user_uid,created_at DESC);
GRANT SELECT,INSERT,UPDATE ON app.submission_work,app.submission_attempts,app.school_notifications TO rptpc_app;
