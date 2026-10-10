CREATE TABLE IF NOT EXISTS rooms (
 id uuid PRIMARY KEY,
 state jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS command_locks (actor text NOT NULL,key uuid NOT NULL,PRIMARY KEY(actor,key));
CREATE TABLE IF NOT EXISTS actor_locks (actor text PRIMARY KEY);
CREATE TABLE IF NOT EXISTS command_results (
 actor text NOT NULL,
 key uuid NOT NULL,
 request_hash text NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (actor,key)
);
CREATE TABLE IF NOT EXISTS resolution_jobs (
 room_id uuid NOT NULL REFERENCES rooms(id),
 round_no integer NOT NULL CHECK(round_no BETWEEN 1 AND 12),
 status text NOT NULL CHECK(status IN ('PENDING','DONE')),
 PRIMARY KEY(room_id,round_no)
);
CREATE TABLE IF NOT EXISTS settlements (
 room_id uuid NOT NULL REFERENCES rooms(id),
 round_no integer NOT NULL,
 input jsonb NOT NULL,
 output jsonb NOT NULL,
 input_hash text NOT NULL,
 output_hash text NOT NULL,
 PRIMARY KEY(room_id,round_no)
);
CREATE TABLE IF NOT EXISTS journal (
 room_id uuid NOT NULL REFERENCES rooms(id),
 round_no integer NOT NULL,
 ordinal integer NOT NULL,
 from_account text NOT NULL,
 to_account text NOT NULL,
 cents numeric(30,0) NOT NULL CHECK(cents >= 0),
 reason text NOT NULL,
 PRIMARY KEY(room_id,round_no,ordinal),
 CHECK(from_account <> to_account)
);
CREATE TABLE IF NOT EXISTS outbox (
 id bigserial PRIMARY KEY,
 room_id uuid NOT NULL REFERENCES rooms(id),
 round_no integer NOT NULL,
 kind text NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(room_id,round_no,kind)
);
CREATE INDEX IF NOT EXISTS rooms_phase_deadline ON rooms ((state->>'phase'),(state->>'deadline'));
CREATE INDEX IF NOT EXISTS rooms_invite ON rooms ((state->>'inviteHash'));
CREATE TABLE IF NOT EXISTS privacy_confirmations (actor text PRIMARY KEY,token_hash text NOT NULL,expires_at timestamptz NOT NULL);
