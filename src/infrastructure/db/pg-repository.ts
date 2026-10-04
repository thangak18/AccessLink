import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { AuditEntry, ChangeSet, DatasetSnapshot, Report } from "@/contracts/types";
import { DomainError } from "@/domain/errors";
import type { DatasetLock, DatasetRepository } from "@/infrastructure/db/repository";

const migrationSql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "migrations", "001_init.sql"),
  "utf8",
);

function json<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

async function writePlaces(client: pg.PoolClient, snapshot: DatasetSnapshot): Promise<void> {
  for (const place of snapshot.places) {
    const [lon, lat] = place.location.coordinates;
    await client.query(
      `INSERT INTO place_geometries (dataset_id, version, place_id, name, geom)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326))
       ON CONFLICT (dataset_id, version, place_id) DO UPDATE SET name = EXCLUDED.name, geom = EXCLUDED.geom`,
      [snapshot.dataset_id, snapshot.version, place.id, place.name, lon, lat],
    );
  }
}

export class PgDatasetRepository implements DatasetRepository {
  constructor(private readonly pool: pg.Pool) {}

  static async open(connectionString: string): Promise<PgDatasetRepository> {
    const pool = new pg.Pool({ connectionString });
    const repo = new PgDatasetRepository(pool);
    await repo.pool.query(migrationSql);
    return repo;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async hasDataset(id: string): Promise<boolean> {
    const result = await this.pool.query("SELECT 1 FROM datasets WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async currentVersion(id: string): Promise<number | null> {
    const result = await this.pool.query<{ current_version: number | null }>(
      "SELECT current_version FROM datasets WHERE id = $1",
      [id],
    );
    return result.rows[0]?.current_version ?? null;
  }

  async getSnapshot(datasetId: string, version: number): Promise<DatasetSnapshot | null> {
    const result = await this.pool.query<{ snapshot: unknown }>(
      "SELECT snapshot FROM dataset_versions WHERE dataset_id = $1 AND version = $2",
      [datasetId, version],
    );
    return result.rows[0] ? json<DatasetSnapshot>(result.rows[0].snapshot) : null;
  }

  async getChangeset(id: string): Promise<ChangeSet | null> {
    const result = await this.pool.query<{ document: unknown }>("SELECT document FROM changesets WHERE id = $1", [id]);
    return result.rows[0] ? json<ChangeSet>(result.rows[0].document) : null;
  }

  async insertChangeset(changeset: ChangeSet): Promise<void> {
    await this.pool.query(
      `INSERT INTO changesets (id, dataset_id, base_version, status, published_version, document)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        changeset.id,
        changeset.dataset_id,
        changeset.base_version,
        changeset.status,
        changeset.published_version,
        JSON.stringify(changeset),
      ],
    );
  }

  async saveChangeset(changeset: ChangeSet): Promise<void> {
    const result = await this.pool.query(
      `UPDATE changesets SET base_version = $2, status = $3, published_version = $4, document = $5::jsonb WHERE id = $1`,
      [changeset.id, changeset.base_version, changeset.status, changeset.published_version, JSON.stringify(changeset)],
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new DomainError("CHANGESET_NOT_FOUND", `Không có ChangeSet ${changeset.id}.`, 404);
    }
  }

  async listReports(datasetId: string): Promise<Report[]> {
    const result = await this.pool.query<{ document: unknown }>(
      "SELECT document FROM reports WHERE dataset_id = $1 ORDER BY id",
      [datasetId],
    );
    return result.rows.map((row) => json<Report>(row.document));
  }

  async insertReport(report: Report): Promise<void> {
    await this.pool.query(
      `INSERT INTO reports (id, dataset_id, data_version, document) VALUES ($1, $2, $3, $4::jsonb)`,
      [report.id, report.dataset_id, report.data_version, JSON.stringify(report)],
    );
  }

  async withDatasetLock<T>(datasetId: string, fn: (lock: DatasetLock) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query<{ current_version: number }>(
        "SELECT current_version FROM datasets WHERE id = $1 FOR UPDATE",
        [datasetId],
      );
      if ((locked.rowCount ?? 0) === 0 || locked.rows[0].current_version === null) {
        throw new DomainError("DATASET_NOT_FOUND", `Không có dataset ${datasetId}.`, 404);
      }
      const lock = new PgLock(client, datasetId, locked.rows[0].current_version);
      const value = await fn(lock);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async reset(seed: DatasetSnapshot): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM datasets WHERE id = $1 FOR UPDATE", [seed.dataset_id]);
      await replaceDataset(client, seed);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async seed(snapshot: DatasetSnapshot): Promise<void> {
    await this.reset(snapshot);
  }
}

class PgLock implements DatasetLock {
  constructor(
    private readonly client: pg.PoolClient,
    private readonly datasetId: string,
    public currentVersion: number,
  ) {}

  async getSnapshot(version: number): Promise<DatasetSnapshot | null> {
    const result = await this.client.query<{ snapshot: unknown }>(
      "SELECT snapshot FROM dataset_versions WHERE dataset_id = $1 AND version = $2",
      [this.datasetId, version],
    );
    return result.rows[0] ? json<DatasetSnapshot>(result.rows[0].snapshot) : null;
  }

  async getChangeset(id: string): Promise<ChangeSet | null> {
    const result = await this.client.query<{ document: unknown }>(
      "SELECT document FROM changesets WHERE id = $1",
      [id],
    );
    return result.rows[0] ? json<ChangeSet>(result.rows[0].document) : null;
  }

  async saveChangeset(changeset: ChangeSet): Promise<void> {
    await this.client.query(
      `UPDATE changesets SET base_version = $2, status = $3, published_version = $4, document = $5::jsonb WHERE id = $1`,
      [changeset.id, changeset.base_version, changeset.status, changeset.published_version, JSON.stringify(changeset)],
    );
  }

  async commitPublication(snapshot: DatasetSnapshot, changeset: ChangeSet, audit: AuditEntry): Promise<void> {
    await this.client.query(
      `INSERT INTO dataset_versions (dataset_id, version, published_at, changeset_id, snapshot)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [snapshot.dataset_id, snapshot.version, snapshot.published_at, changeset.id, JSON.stringify(snapshot)],
    );
    await this.client.query("UPDATE datasets SET current_version = $2 WHERE id = $1", [
      snapshot.dataset_id,
      snapshot.version,
    ]);
    await this.client.query(
      `UPDATE changesets SET status = $2, published_version = $3, document = $4::jsonb WHERE id = $1`,
      [changeset.id, changeset.status, changeset.published_version, JSON.stringify(changeset)],
    );
    await this.client.query(
      `INSERT INTO audit_entries (id, dataset_id, document) VALUES ($1, $2, $3::jsonb)`,
      [audit.id, audit.dataset_id, JSON.stringify(audit)],
    );
    await writePlaces(this.client, snapshot);
    this.currentVersion = snapshot.version;
  }
}

async function replaceDataset(client: pg.PoolClient, snapshot: DatasetSnapshot): Promise<void> {
  await client.query("DELETE FROM audit_entries WHERE dataset_id = $1", [snapshot.dataset_id]);
  await client.query("DELETE FROM reports WHERE dataset_id = $1", [snapshot.dataset_id]);
  await client.query("DELETE FROM changesets WHERE dataset_id = $1", [snapshot.dataset_id]);
  await client.query("DELETE FROM place_geometries WHERE dataset_id = $1", [snapshot.dataset_id]);
  await client.query("DELETE FROM dataset_versions WHERE dataset_id = $1", [snapshot.dataset_id]);
  await client.query("DELETE FROM datasets WHERE id = $1", [snapshot.dataset_id]);
  await client.query(
    `INSERT INTO datasets (id, name, environment, current_version) VALUES ($1, $2, $3, $4)`,
    [snapshot.dataset_id, snapshot.name, snapshot.environment, snapshot.version],
  );
  await client.query(
    `INSERT INTO dataset_versions (dataset_id, version, published_at, changeset_id, snapshot)
     VALUES ($1, $2, $3, NULL, $4::jsonb)`,
    [snapshot.dataset_id, snapshot.version, snapshot.published_at, JSON.stringify(snapshot)],
  );
  await writePlaces(client, snapshot);
}
