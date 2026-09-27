CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS datasets (
  id text PRIMARY KEY,
  name text NOT NULL,
  environment text NOT NULL,
  current_version integer
);

CREATE TABLE IF NOT EXISTS dataset_versions (
  dataset_id text NOT NULL REFERENCES datasets (id),
  version integer NOT NULL,
  published_at timestamptz NOT NULL,
  changeset_id text,
  snapshot jsonb NOT NULL,
  PRIMARY KEY (dataset_id, version)
);

CREATE TABLE IF NOT EXISTS changesets (
  id text PRIMARY KEY,
  dataset_id text NOT NULL REFERENCES datasets (id),
  base_version integer NOT NULL,
  status text NOT NULL,
  published_version integer,
  document jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id text PRIMARY KEY,
  dataset_id text NOT NULL REFERENCES datasets (id),
  data_version integer NOT NULL,
  document jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_entries (
  id text PRIMARY KEY,
  dataset_id text NOT NULL REFERENCES datasets (id),
  document jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS place_geometries (
  dataset_id text NOT NULL,
  version integer NOT NULL,
  place_id text NOT NULL,
  name text NOT NULL,
  geom geometry(Point, 4326) NOT NULL,
  PRIMARY KEY (dataset_id, version, place_id)
);

CREATE INDEX IF NOT EXISTS place_geometries_gix ON place_geometries USING GIST (geom);
