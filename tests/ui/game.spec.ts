import { test, expect } from "@playwright/test";
test("new player previews and commits a solo month, sees report, and advances", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Your lemon business starts here")).toBeVisible();
  await page.screenshot({ path: "test-results/home.png", fullPage: true });
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(
    page.getByText("Cash and profit are different.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New campaign", exact: true }).click();
  await page
    .getByRole("button", { name: "Start campaign", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your decision" }),
  ).toBeVisible();
  await page.getByLabel("Procurement target (kg)", { exact: true }).fill("400");
  await page.getByLabel("Planned cups", { exact: true }).fill("1600");
  await page.getByRole("button", { name: "Preview outcomes" }).click();
  await expect(
    page.getByRole("heading", { name: "Forecast · estimate" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Commit & lock decision" }).click();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Monthly report" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByText("Operating profit", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start next month" }).click();
  await expect(
    page.getByRole("heading", { name: "Your decision" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Procurement target (kg)", { exact: true }),
  ).toHaveValue("0");
  await page.screenshot({ path: "test-results/decisions.png", fullPage: true });
});
test("360px Hebrew layout supports keyboard and has no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByLabel("Language").selectOption("he");
  await expect(page.locator("main")).toHaveAttribute("dir", "rtl");
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "עסק הלימונים שלך מתחיל כאן" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("playful draft widgets synchronize volume and show exact cash without advancing a round", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Your role", exact: true })
    .selectOption("GROWER");
  await page.getByRole("button", { name: "New campaign", exact: true }).click();
  await page
    .getByRole("button", { name: "Start campaign", exact: true })
    .click();
  await page.getByRole("button", { name: "Plan 800 kg", exact: true }).click();
  await expect(
    page.getByLabel("Planned harvest (kg)", { exact: true }),
  ).toHaveValue("800");
  await expect(
    page.getByRole("slider", { name: "Planned harvest (kg) slider" }),
  ).toHaveValue("800");
  await expect(
    page.getByRole("region", { name: "Live cash budget" }).getByRole("status"),
  ).toContainText("8,700 LE");
  await page
    .getByRole("slider", { name: "Planned harvest (kg) slider" })
    .focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByLabel("Planned harvest (kg)", { exact: true }),
  ).toHaveValue("801");
  await expect(
    page
      .getByRole("list", { name: "12-month journey" })
      .locator('[aria-current="step"]'),
  ).toContainText("Month 1");
  await page.getByLabel("Farm ask (LE/kg)", { exact: true }).fill("4");
  await expect(
    page.getByRole("slider", { name: "Farm ask (LE/kg) slider" }),
  ).toHaveValue("4");
  await page.screenshot({
    path: "test-results/playful-orchard.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByLabel("Planned harvest (kg)", { exact: true }),
  ).toHaveValue("801");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByLabel("Language").selectOption("he");
  await expect(page.getByRole("region", { name: "המטע שלך" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.screenshot({
    path: "test-results/playful-mobile-dark.png",
    fullPage: true,
  });
});

test("seller cups tiles and procurement budget remain independent draft controls", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New campaign", exact: true }).click();
  await page
    .getByRole("button", { name: "Start campaign", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Plan 1600 cups", exact: true })
    .click();
  await expect(page.getByLabel("Planned cups", { exact: true })).toHaveValue(
    "1600",
  );
  await expect(
    page.getByLabel("Procurement target (kg)", { exact: true }),
  ).toHaveValue("0");
  await expect(
    page.getByText("This volume needs 400 kg", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Procurement target (kg)", { exact: true })
    .fill("1000");
  await page.getByLabel("Maximum bid (LE/kg)", { exact: true }).fill("10");
  await expect(
    page.getByRole("region", { name: "Live cash budget" }).getByRole("status"),
  ).toContainText("Over budget by");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("cash", {
    ignoreCase: true,
  });
  await expect(
    page.getByRole("heading", { name: "Your decision" }),
  ).toBeVisible();
});
