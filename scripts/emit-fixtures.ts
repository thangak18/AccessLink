import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSnapshotS4, buildSnapshotS1, buildSnapshotS2, expectedPlans } from "../fixtures/demo-a/expected";
import { buildSnapshotS0 } from "../fixtures/demo-a/model";
import { featureCollection } from "../src/modules/places/catalog";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "demo-a");

function write(name: string, value: unknown): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const s0 = buildSnapshotS0();
write("s0.snapshot.json", s0);
write("s1.snapshot.json", buildSnapshotS1());
write("s2.snapshot.json", buildSnapshotS2());
write("s4.snapshot.json", buildSnapshotS4());
write("expected-plans.json", expectedPlans());
write("s0.layer.geojson", { type: "FeatureCollection", features: featureCollection(s0) });

console.log(`Đã ghi fixture vào ${root}`);
