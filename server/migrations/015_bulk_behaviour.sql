CREATE TABLE app.behaviour_batches (
 teacher_uid text NOT NULL, request_id uuid NOT NULL, payload_hash text NOT NULL,
 result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(teacher_uid,request_id)
);
GRANT SELECT,INSERT ON app.behaviour_batches TO rptpc_app;
