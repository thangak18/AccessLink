import { test, expect } from "@playwright/test";
test("fixture journey, closure, walking and report without opening gate", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("walk-distance")).toContainText("90");
  await expect(page.getByTestId("access-map")).toBeVisible();
  await page.getByLabel("Tình huống demo").selectOption("S1");
  await expect(page.getByTestId("walk-distance")).toContainText("200");
  await expect(page.getByText("P → G3", { exact: true })).toBeVisible();
  await page.getByLabel("Tình huống demo").selectOption("S2");
  await expect(
    page.getByText("Chưa tìm thấy lối phù hợp", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("walk-distance")).toHaveCount(0);
  await page.getByLabel("Tình huống demo").selectOption("S3");
  await page.getByRole("button", { name: "↟ Đi bộ", exact: true }).click();
  await expect(page.getByTestId("walk-distance")).toContainText("190");
  await page.getByLabel("Tình huống demo").selectOption("S5");
  await page.getByRole("button", { name: "◉ Xe máy", exact: true }).click();
  await expect(page.getByTestId("walk-distance")).toContainText("200");
  await page
    .getByLabel("Nội dung phản ánh")
    .fill("G2 đã mở lại, vui lòng kiểm tra.");
  await page.getByRole("button", { name: "Thử phản ánh mẫu →" }).click();
  await expect(
    page.getByText("Phản ánh mẫu đã ghi nhận", { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId("walk-distance")).toContainText("200");
});
test("live API shows missing engine and submits report", async ({ page }) => {
  await page.goto("/?place=place_b");
  await expect(page.getByTestId("walk-distance")).toContainText("105");
  await page.getByRole("button", { name: "API tích hợp", exact: true }).click();
  await expect(
    page.getByText("API tìm phương án chưa được tích hợp.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId("walk-distance")).toHaveCount(0);
  await page
    .getByLabel("Nội dung phản ánh")
    .fill("Kiểm thử giao diện: G2 cần kiểm tra.");
  await page.getByRole("button", { name: "Gửi phản ánh →" }).click();
  await expect(
    page.getByText("Đã tiếp nhận report_", { exact: false }),
  ).toBeVisible();
});
test("360px screen has no horizontal overflow; search empty and deep links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/?place=place_c");
  await expect(page.getByTestId("walk-distance")).toContainText("0");
  await page.getByLabel("Tìm trong khu demo").fill("không tồn tại");
  await expect(
    page.getByText("Không có địa điểm khớp.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page.screenshot({ path: "tmp/thang-mobile.png", fullPage: true });
});
test("late API response cannot replace newer place selection", async ({
  page,
}) => {
  let oldStarted = false;
  await page.route("**/api/v1/access-plans", async (route) => {
    const request = route.request().postDataJSON();
    if (request.place_id === "place_a") {
      oldStarted = true;
      await new Promise((r) => setTimeout(r, 800));
    }
    await route.fulfill({
      json: {
        route_status: "available",
        data_kind: "simulated",
        data_version: 1,
        place_id: request.place_id,
        mode: request.mode,
        walk_length_m: request.place_id === "place_a" ? 999 : 215,
        legs: [],
        limitations: [],
      },
    });
  });
  await page.goto("/");
  await expect(page.getByTestId("walk-distance")).toContainText("90");
  await page.getByRole("button", { name: "API tích hợp", exact: true }).click();
  await expect.poll(() => oldStarted).toBe(true);
  await page.getByRole("button", { name: /Cửa hàng B Thông tin/ }).click();
  await expect(page.getByTestId("walk-distance")).toContainText("215");
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("walk-distance")).toContainText("215");
});
test("version update refreshes both map and plan, mismatched route is hidden", async ({
  page,
}) => {
  let version = 1;
  await page.route("**/api/v1/datasets/demo-a/version", (route) =>
    route.fulfill({ json: { current_version: version } }),
  );
  await page.route("**/api/v1/places?*", async (route) => {
    const response = await route.fetch({
      url: route.request().url().replace("version=2", "version=1"),
    });
    const body = await response.json();
    body.data_version = version;
    await route.fulfill({ json: body });
  });
  await page.route("**/api/v1/access-layer?*", async (route) => {
    const response = await route.fetch({
      url: route.request().url().replace("version=2", "version=1"),
    });
    const body = await response.json();
    body.data_version = version;
    await route.fulfill({ json: body });
  });
  await page.route("**/api/v1/access-plans", (route) =>
    route.fulfill({
      json: {
        route_status: "available",
        data_kind: "simulated",
        data_version: 1,
        place_id: "place_a",
        mode: "motorcycle",
        walk_length_m: 90,
        legs: [],
        limitations: [],
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByTestId("walk-distance")).toContainText("90");
  await page.getByRole("button", { name: "API tích hợp", exact: true }).click();
  await expect(
    page.getByText("Kết quả trả từ API tích hợp.", { exact: false }),
  ).toBeVisible();
  version = 2;
  await expect(page.locator(".route-alert[role=alert]")).toContainText(
    "Đã ẩn tuyến cũ",
    { timeout: 10000 },
  );
  await expect(page.getByTestId("walk-distance")).toHaveCount(0);
});
test("needs verification and network failure are explicit", async ({
  page,
}) => {
  await page.route("**/api/v1/access-plans", (route) =>
    route.fulfill({
      json: {
        route_status: "needs_verification",
        data_kind: "simulated",
        data_version: 1,
        place_id: "place_a",
        mode: "motorcycle",
        walk_length_m: null,
        legs: [],
        limitations: [],
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "API tích hợp", exact: true }).click();
  await expect(
    page.getByText("Cần xác minh thêm", { exact: true }),
  ).toBeVisible();
  await page.route("**/api/v1/datasets/demo-a/version", (route) =>
    route.abort(),
  );
  await page
    .getByRole("button", { name: "↻ Tải lại dữ liệu", exact: true })
    .click();
  await expect(page.locator(".route-alert[role=alert]")).toBeVisible();
  await expect(page.getByTestId("walk-distance")).toHaveCount(0);
});
test("successful version refresh replaces the route and version together", async ({
  page,
}) => {
  let version = 1;
  await page.route("**/api/v1/datasets/demo-a/version", (route) =>
    route.fulfill({ json: { current_version: version } }),
  );
  for (const pattern of ["**/api/v1/places?*", "**/api/v1/access-layer?*"]) {
    await page.route(pattern, async (route) => {
      const url = new URL(route.request().url());
      url.searchParams.set("version", "1");
      const response = await route.fetch({ url: url.href });
      const body = await response.json();
      body.data_version = version;
      await route.fulfill({ json: body });
    });
  }
  await page.route("**/api/v1/access-plans", (route) =>
    route.fulfill({
      json: {
        route_status: "available",
        data_kind: "simulated",
        data_version: version,
        place_id: "place_a",
        mode: "motorcycle",
        walk_length_m: version === 1 ? 90 : 200,
        legs: [],
        limitations: [],
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "API tích hợp", exact: true }).click();
  await expect(
    page.getByText("Kết quả trả từ API tích hợp.", { exact: false }),
  ).toBeVisible();
  version = 2;
  await expect(page.getByTestId("walk-distance")).toContainText("200", {
    timeout: 10000,
  });
  await expect(page.locator(".map-label")).toContainText("v2");
  await expect(page.locator(".version-stamp")).toContainText("v2");
});
test("running demo clock recomputes at the engine-provided time boundary", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-01T10:00:00Z") });
  let lastDeparture = "";
  await page.route("**/api/v1/access-plans", (route) => {
    const query = route.request().postDataJSON();
    lastDeparture = query.depart_at;
    const after =
      Date.parse(query.depart_at) >= Date.parse("2026-10-01T17:00:10+07:00");
    return route.fulfill({
      json: {
        route_status: "available",
        data_kind: "simulated",
        data_version: 1,
        place_id: "place_a",
        mode: "motorcycle",
        walk_length_m: after ? 200 : 90,
        legs: [],
        limitations: [],
        next_recompute_at: after ? null : "2026-10-01T17:00:10+07:00",
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "API tích hợp", exact: true }).click();
  await expect(
    page.getByText("Kết quả trả từ API tích hợp.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Chạy đồng hồ demo (1 phút/phút)").check();
  await page.clock.fastForward(11000);
  await expect(page.getByTestId("walk-distance")).toContainText("200");
  expect(lastDeparture).toBe("2026-10-01T17:00:10+07:00");
});
