-- Migration: create projection_checkpoints and example users_read_model
CREATE TABLE IF NOT EXISTS projection_checkpoints (
  id BIGSERIAL PRIMARY KEY,
  projector_name VARCHAR(200) NOT NULL,
  stream_id VARCHAR(200) NOT NULL,
  position BIGINT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (projector_name, stream_id)
);

CREATE TABLE IF NOT EXISTS users_read_model (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  password_changed_at TIMESTAMP WITH TIME ZONE
);
