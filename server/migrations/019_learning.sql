CREATE TABLE app.learning_packs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL,
 owner_uid text NOT NULL, title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 subject text NOT NULL DEFAULT '', year_group text NOT NULL DEFAULT '',
 public boolean NOT NULL DEFAULT false, cards jsonb NOT NULL DEFAULT '[]',
 version integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.learning_packs(owner_uid);
CREATE TABLE app.learning_sessions (
 id uuid PRIMARY KEY, pack_id uuid NOT NULL REFERENCES app.learning_packs ON DELETE CASCADE,
 learner_uid text NOT NULL, method text NOT NULL, questions jsonb NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.learning_sessions(learner_uid,started_at DESC);
CREATE TABLE app.learning_answers (
 session_id uuid NOT NULL REFERENCES app.learning_sessions ON DELETE CASCADE,
 question integer NOT NULL CHECK(question>=0), card_id uuid NOT NULL,
 correct boolean NOT NULL, seconds double precision NOT NULL CHECK(seconds>=0 AND seconds<=3600),
 PRIMARY KEY(session_id,question)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON app.learning_packs,app.learning_sessions,app.learning_answers TO rptpc_app;
