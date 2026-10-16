CREATE TABLE app.post_reactions (
 post_id uuid NOT NULL REFERENCES app.discussion_posts(id) ON DELETE CASCADE,
 user_uid text NOT NULL,
 emoji text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 32),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(post_id,user_uid,emoji)
);
GRANT SELECT,INSERT,DELETE ON app.post_reactions TO rptpc_app;
