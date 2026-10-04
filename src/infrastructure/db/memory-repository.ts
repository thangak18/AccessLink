import type { AuditEntry, ChangeSet, DatasetSnapshot, Report } from "@/contracts/types";
import { DomainError } from "@/domain/errors";
import type { DatasetLock, DatasetRepository } from "@/infrastructure/db/repository";

type Bag = {
  currentVersion: number;
  versions: Map<number, DatasetSnapshot>;
  changesets: Map<string, ChangeSet>;
  reports: Report[];
  audit: AuditEntry[];
};

function bagFrom(seed: DatasetSnapshot): Bag {
  return {
    currentVersion: seed.version,
    versions: new Map([[seed.version, structuredClone(seed)]]),
    changesets: new Map(),
    reports: [],
    audit: [],
  };
}

export class MemoryDatasetRepository implements DatasetRepository {
  private bags = new Map<string, Bag>();
  private tail: Promise<void> = Promise.resolve();

  constructor(seed: DatasetSnapshot) {
    this.bags.set(seed.dataset_id, bagFrom(seed));
  }

  private require(datasetId: string): Bag {
    const bag = this.bags.get(datasetId);
    if (!bag) throw new DomainError("DATASET_NOT_FOUND", `Không có dataset ${datasetId}.`, 404);
    return bag;
  }

  async hasDataset(id: string): Promise<boolean> {
    return this.bags.has(id);
  }

  async currentVersion(id: string): Promise<number | null> {
    return this.bags.get(id)?.currentVersion ?? null;
  }

  async getSnapshot(datasetId: string, version: number): Promise<DatasetSnapshot | null> {
    const snapshot = this.require(datasetId).versions.get(version);
    return snapshot ? structuredClone(snapshot) : null;
  }

  async getChangeset(id: string): Promise<ChangeSet | null> {
    for (const bag of this.bags.values()) {
      const found = bag.changesets.get(id);
      if (found) return structuredClone(found);
    }
    return null;
  }

  async insertChangeset(changeset: ChangeSet): Promise<void> {
    const bag = this.require(changeset.dataset_id);
    if (bag.changesets.has(changeset.id)) {
      throw new DomainError("CHANGESET_EXISTS", `ChangeSet ${changeset.id} đã tồn tại.`, 409);
    }
    bag.changesets.set(changeset.id, structuredClone(changeset));
  }

  async saveChangeset(changeset: ChangeSet): Promise<void> {
    const bag = this.require(changeset.dataset_id);
    if (!bag.changesets.has(changeset.id)) {
      throw new DomainError("CHANGESET_NOT_FOUND", `Không có ChangeSet ${changeset.id}.`, 404);
    }
    bag.changesets.set(changeset.id, structuredClone(changeset));
  }

  async listReports(datasetId: string): Promise<Report[]> {
    return structuredClone(this.require(datasetId).reports);
  }

  async insertReport(report: Report): Promise<void> {
    this.require(report.dataset_id).reports.push(structuredClone(report));
  }

  async withDatasetLock<T>(datasetId: string, fn: (lock: DatasetLock) => Promise<T>): Promise<T> {
    this.require(datasetId);
    let release: () => void = () => undefined;
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn(this.lockFor(datasetId));
    } finally {
      release();
    }
  }

  async reset(seed: DatasetSnapshot): Promise<void> {
    await this.withDatasetLock(seed.dataset_id, async () => {
      this.bags.set(seed.dataset_id, bagFrom(seed));
    });
  }

  private lockFor(datasetId: string): DatasetLock {
    const bag = () => this.require(datasetId);
    return {
      get currentVersion() {
        return bag().currentVersion;
      },
      getSnapshot: async (version) => {
        const snapshot = bag().versions.get(version);
        return snapshot ? structuredClone(snapshot) : null;
      },
      getChangeset: async (id) => {
        const found = bag().changesets.get(id);
        return found ? structuredClone(found) : null;
      },
      saveChangeset: async (changeset) => {
        bag().changesets.set(changeset.id, structuredClone(changeset));
      },
      commitPublication: async (snapshot, changeset, audit) => {
        const current = bag();
        current.versions.set(snapshot.version, structuredClone(snapshot));
        current.currentVersion = snapshot.version;
        current.changesets.set(changeset.id, structuredClone(changeset));
        current.audit.push(structuredClone(audit));
      },
    };
  }
}
