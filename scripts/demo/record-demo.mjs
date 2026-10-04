import { chromium } from "@playwright/test";
import { mkdir, rename } from "node:fs/promises";
await mkdir("artifacts/videos", { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: {
    dir: "tmp/demo-recording",
    size: { width: 1440, height: 1000 },
  },
});
const page = await context.newPage();
try {
  await page.goto(process.env.DEMO_URL ?? "http://127.0.0.1:3000");
  await page.getByTestId("walk-distance").waitFor();
  await page.waitForTimeout(3000);
  for (const id of ["S1", "S2", "S3"]) {
    await page.getByLabel("Tình huống demo").selectOption(id);
    await page.waitForTimeout(2500);
  }
  await page.getByRole("button", { name: "↟ Đi bộ", exact: true }).click();
  await page.waitForTimeout(2500);
  await page.getByLabel("Tình huống demo").selectOption("S4");
  await page.getByRole("button", { name: "◉ Xe máy", exact: true }).click();
  await page.waitForTimeout(2500);
  await context.close();
  const videoPath = await page.video().path();
  await rename(videoPath, "artifacts/videos/AccessLink_Thang_UI_Fixture_Demo.webm");
  console.log(
    "Saved display-only fixture demo: artifacts/videos/AccessLink_Thang_UI_Fixture_Demo.webm",
  );
} finally {
  await browser.close();
}
