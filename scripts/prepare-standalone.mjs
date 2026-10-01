import { cp, access } from "node:fs/promises";
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
try {
  await access("public");
  await cp("public", ".next/standalone/public", { recursive: true });
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
console.log("Standalone server includes static assets. Start with npm start.");
