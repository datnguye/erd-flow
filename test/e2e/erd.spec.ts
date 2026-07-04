import { expect, test } from "@playwright/test";

// End-to-end tests for <ErdFlow>, driven against the Vite-served demo page
// (demo/main.tsx) in a real browser — the layout + React Flow rendering that
// jsdom unit tests can't exercise. The demo reads ?layout / ?focus / ?collapse
// query params so each state is deep-linkable.

const DEMO = "/demo/index.html";

test.describe("ErdFlow rendering", () => {
  test("renders a table node per model with no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.goto(DEMO);
    const tables = page.locator(".erd-table");
    await expect(tables.first()).toBeVisible();
    await expect(tables).toHaveCount(5);
    expect(errors).toEqual([]);
  });

  test("draws the FK edges between tables", async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.locator(".erd-table").first()).toBeVisible();
    await expect(page.locator(".react-flow__edge")).toHaveCount(3);
  });

  test("renders PK/FK column badges", async ({ page }) => {
    await page.goto(DEMO);
    const orders = page
      .locator(".erd-table")
      .filter({ has: page.locator(".erd-table-name", { hasText: /^orders$/ }) });
    await expect(orders).toBeVisible();
    await expect(orders.locator(".erd-column-badge.badge-pk")).toHaveCount(1);
    await expect(orders.locator(".erd-column-badge.badge-fk")).toHaveCount(1);
  });
});

test.describe("focus windowing", () => {
  test("focusing order_items narrows to its FK neighborhood", async ({ page }) => {
    await page.goto(`${DEMO}?focus=model.jaffle_shop.order_items`);
    const tables = page.locator(".erd-table");
    await expect(tables.first()).toBeVisible();
    // order_items + its two FK neighbors (orders, products); customers/raw are dropped.
    await expect(tables).toHaveCount(3);
    await expect(
      page.locator(".erd-table-name", { hasText: /^customers$/ }),
    ).toHaveCount(0);
  });

  test("the focus dropdown re-windows live", async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.locator(".erd-table")).toHaveCount(5);
    await page.getByTestId("focus").selectOption("model.jaffle_shop.order_items");
    await expect(page.locator(".erd-table")).toHaveCount(3);
  });
});

test.describe("column collapse", () => {
  test("a wide table collapses by default with a 'N more' toggle", async ({ page }) => {
    await page.goto(DEMO);
    const orders = page
      .locator(".erd-table")
      .filter({ has: page.locator(".erd-table-name", { hasText: /^orders$/ }) });
    await expect(orders).toBeVisible();
    // orders has 9 columns (> the 5 threshold) → collapsed with an expand toggle.
    await expect(orders.locator(".erd-table-expand")).toHaveCount(1);
    await expect(orders.locator(".erd-column")).toHaveCount(5);
  });

  test("clicking the toggle expands to all columns", async ({ page }) => {
    await page.goto(DEMO);
    const orders = page
      .locator(".erd-table")
      .filter({ has: page.locator(".erd-table-name", { hasText: /^orders$/ }) });
    await orders.locator(".erd-table-expand").click();
    await expect(orders.locator(".erd-column")).toHaveCount(9);
  });

  test("collapseColumns off shows every column with no toggle", async ({ page }) => {
    await page.goto(`${DEMO}?collapse=off`);
    const orders = page
      .locator(".erd-table")
      .filter({ has: page.locator(".erd-table-name", { hasText: /^orders$/ }) });
    await expect(orders).toBeVisible();
    await expect(orders.locator(".erd-table-expand")).toHaveCount(0);
    await expect(orders.locator(".erd-column")).toHaveCount(9);
  });
});

test.describe("interaction", () => {
  test("clicking a table header activates it", async ({ page }) => {
    await page.goto(DEMO);
    const customers = page
      .locator(".erd-table")
      .filter({ has: page.locator(".erd-table-name", { hasText: /^customers$/ }) });
    await customers.locator(".erd-table-header").click();
    await expect(page.getByTestId("active")).toHaveText("active: customers");
  });

  test("switching layout re-renders without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(DEMO);
    await expect(page.locator(".erd-table").first()).toBeVisible();
    for (const layout of ["hierarchical", "force", "radial"]) {
      await page.getByTestId("layout").selectOption(layout);
      await expect(page.locator(".erd-table").first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});

test.describe("expand-all control", () => {
  test("the host button expands every collapsible table, then collapses", async ({ page }) => {
    await page.goto(DEMO);
    const orders = page
      .locator(".erd-table")
      .filter({ has: page.locator(".erd-table-name", { hasText: /^orders$/ }) });
    // orders (9 cols) starts collapsed to 5.
    await expect(orders.locator(".erd-column")).toHaveCount(5);
    const btn = page.getByTestId("expand-all");
    await expect(btn).toHaveText("Expand all");
    await btn.click();
    await expect(orders.locator(".erd-column")).toHaveCount(9);
    await expect(btn).toHaveText("Collapse all");
    await btn.click();
    await expect(orders.locator(".erd-column")).toHaveCount(5);
  });

  test("onExpandStateChange reports canExpand=false when nothing is collapsible", async ({
    page,
  }) => {
    // collapse off → no table can expand → the host button is disabled.
    await page.goto(`${DEMO}?collapse=off`);
    await expect(page.locator(".erd-table").first()).toBeVisible();
    await expect(page.getByTestId("expand-all")).toBeDisabled();
  });
});

test.describe("interactive lock", () => {
  test("locked canvas keeps the zoom transform fixed on scroll", async ({ page }) => {
    await page.goto(`${DEMO}?locked=on`);
    const viewport = page.locator(".react-flow__viewport");
    await expect(viewport).toBeVisible();
    const before = await viewport.getAttribute("style");
    await page.locator(".react-flow").hover();
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(200);
    const after = await viewport.getAttribute("style");
    // With zoomOnScroll off, the viewport transform must not change.
    expect(after).toBe(before);
  });

  test("interactive canvas zooms on scroll", async ({ page }) => {
    await page.goto(DEMO);
    const viewport = page.locator(".react-flow__viewport");
    await expect(viewport).toBeVisible();
    const before = await viewport.getAttribute("style");
    await page.locator(".react-flow").hover();
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(200);
    const after = await viewport.getAttribute("style");
    expect(after).not.toBe(before);
  });
});
