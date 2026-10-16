# Postcrastination local backend

Step 1 provides a real PostgreSQL database and a Node backend connected to it.
Community now uses Firebase-verified accounts and PostgreSQL profiles. School
classes, assignments and discussions still use their existing browser data.
No browser data has been automatically imported or deleted.

## Start and stop

1. Double-click **Start Backend.cmd** in the parent RPTPC folder.
2. Double-click **Start Postcrastination.cmd** to open the frontend.
3. Check http://127.0.0.1:3001/api/health. It should report `database: connected`.

Keep the backend window open. Close it to stop the API. PostgreSQL stays running
until **Stop Database.cmd** is used or the computer shuts down. Both can be
started again without resetting saved data. They do not start automatically
with Windows and are not exposed to your home network or the internet.

## What is installed

- PostgreSQL 17.11, official EDB Windows x64 binaries (project-local).
- Node backend on `127.0.0.1:3001` using the `pg` PostgreSQL client.
- PostgreSQL on `127.0.0.1:55432`, database `postcrastination`.
- Owner role `rptpc_owner` (cannot log in), and restricted login `rptpc_app`.
- SCRAM password authentication, with random local credentials.
- Transactional, checksummed migrations in `migrations/`.
- `GET /api/health`: checks the live database and reports the schema version;
  failures return 503 without exposing database diagnostics or passwords.
- Vite forwards `/api` to the local backend during development.

## Local files — keep private

`server/.local/pgdata/` holds the actual database. Do not delete it to restart.
`server/.local/database.json` holds database credentials. It is ignored by Git,
as are logs, database files and backend `.env` files. Do not share these files
or put credentials into frontend variables prefixed with `VITE_`.
Ignore rules do not encrypt files; people with access to your Windows account
can access this local development setup.

## Commands (from this directory)

```text
npm ci
npm run db:setup     # first-time setup; safe to run again on this managed cluster
npm run db:start
npm run db:migrate
npm start
npm run check        # live API/database/permission checks; start backend first
npm test             # health endpoint behavior, including database outage
npm run db:stop
```

Setup deliberately refuses to replace a database with missing credentials.
Applied migrations must not be edited. Add a numbered SQL migration instead;
new feature migrations will explicitly grant the app role only needed access.
The application cannot create tables or edit migration records.

## Reinstalling the Windows database runtime

Download the Windows x64 ZIP from the official EDB PostgreSQL binary page:
https://www.enterprisedb.com/download-postgresql-binaries

This installation used https://sbp.enterprisedb.com/getfile.jsp?fileid=1260569
(PostgreSQL 17.11). Extract its `pgsql/bin`, `pgsql/lib` and `pgsql/share`
directories into `server/.local/postgres/`, preserving the `pgsql` directory.
Then run `npm ci` and `npm run db:setup`.
Do not point a different major PostgreSQL version at existing database files.

## Moving to the home server later

The API can use a backend-only `DATABASE_URL` instead of local settings; copy
`.env.example` to `.env` to configure it. Provision roles, schema and migrations
on the destination before starting the API. The Windows database manager is
for this local setup, not a Linux deployment installer. Transfer data with a
PostgreSQL dump/restore and verify a backup restore before relying on it.

Before real users: implement sign-in, server-side class/role checks, application
tables and routes, attachment storage, backups, and a production HTTPS setup.
The demo bypass must never authorize real backend access.


## Community accounts

The backend verifies Firebase ID tokens for `FIREBASE_PROJECT_ID` with the official
Firebase Admin SDK. No service-account private key is needed for signature checks.
Revoked sessions/account deletion are not checked until tokens expire; production
account deletion and immediate revocation handling remain follow-up work.

- `POST /api/me`: create a member profile once, or return the existing one.
- `PATCH /api/me`: change your display name and directory visibility.
- `GET /api/community?page=0`: signed-in directory, 24 visible members per page.

Only a public profile UUID, display name and visibility are returned. Email,
Firebase UID, location and study activity are not exposed in the directory.
New profiles default to visible. Existing visibility is preserved on every login.
Accounts created outside the app appear when they next open it while signed in.
Demo bypasses cannot authenticate to these routes. The display name is not a
unique username or an authorization role. Refresh retrieves the current list.

Run `node scripts/check-community.mjs` to test against the local database. Sample
records are created in a transaction and rolled back. The frontend syncs on sign-in,
retries when connectivity returns and every minute, and displays errors for failures.
Both the frontend and backend need to be running for Community.


## External sign-in setup

Google/external accounts complete a one-time username and optional study-location
form. Completion and location are saved to PostgreSQL and returned only by the
owner-scoped account routes. Incomplete profiles do not appear in Community.
Display names are user-selected and are not guaranteed unique. Password accounts
keep the signup form flow. Existing external accounts also complete setup once.
