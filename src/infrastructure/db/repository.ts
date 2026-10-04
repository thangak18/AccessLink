import type {
  AuditEntry,
  ChangeSet,
  DatasetSnapshot,
  Report,
} from "@/contracts/types";

export interface DatasetLock {
  readonly currentVersion: number;
  getSnapshot(version: number): Promise<DatasetSnapshot | null>;
  getChangeset(id: string): Promise<ChangeSet | null>;
  saveChangeset(changeset: ChangeSet): Promise<void>;
  commitPublication(snapshot: DatasetSnapshot, changeset: ChangeSet, audit: AuditEntry): Promise<void>;
}

export interface DatasetRepository {
  hasDataset(id: string): Promise<boolean>;
  currentVersion(id: string): Promise<number | null>;
  getSnapshot(datasetId: string, version: number): Promise<DatasetSnapshot | null>;
  getChangeset(id: string): Promise<ChangeSet | null>;
  insertChangeset(changeset: ChangeSet): Promise<void>;
  saveChangeset(changeset: ChangeSet): Promise<void>;
  listReports(datasetId: string): Promise<Report[]>;
  insertReport(report: Report): Promise<void>;
  withDatasetLock<T>(datasetId: string, fn: (lock: DatasetLock) => Promise<T>): Promise<T>;
  reset(seed: DatasetSnapshot): Promise<void>;
}
