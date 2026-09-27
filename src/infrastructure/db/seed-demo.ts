import { buildSnapshotS0 } from "../../../fixtures/demo-a/model";
import { PgDatasetRepository } from "./pg-repository";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log("Không có DATABASE_URL. Bỏ qua PostGIS. Dùng npm run emit:fixtures và bộ nhớ trong npm run dev:api.");
  process.exit(0);
}

const repo = await PgDatasetRepository.open(databaseUrl);
try {
  await repo.seed(buildSnapshotS0());
  console.log("Đã seed Khu demo A, version 1, vào PostGIS.");
} finally {
  await repo.close();
}
