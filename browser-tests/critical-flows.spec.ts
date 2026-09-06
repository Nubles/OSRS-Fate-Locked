import { test as base, expect, type Page } from '@playwright/test';

// Independent legacy r1 wire fixture, deliberately not importing app modules:
// the production browser must validate and migrate this older save itself.
function encodeSyncCode(state: Record<string, unknown>) {
  const json = JSON.stringify(state);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) hash = Math.imul(hash ^ json.charCodeAt(i), 0x01000193) >>> 0;
  const payload = btoa(Array.from(new TextEncoder().encode(json), byte => String.fromCharCode(byte)).join(''))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return `FLSYNC.r1.${payload}.${hash.toString(16).padStart(8, '0')}`;
}

// Third-party artwork/online services are outside this offline tracker contract.
// Fulfil them deterministically; local requests and all runtime errors stay real.
const test = base.extend<{ runtimeGuard: void }>({
  runtimeGuard: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 200, body: '' });
    });
    await use();
    expect(errors, 'Unexpected browser console errors or uncaught exceptions').toEqual([]);
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
  }, { auto: true }],
});

async function start(page: Page) {
  await page.goto('./');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Enter The Void', exact: true }).click();
  const mode = page.getByRole('button', { name: 'Apply mode', exact: true });
  const news = page.getByRole('button', { name: "Close What's New" });
  await expect(mode.or(news).first()).toBeVisible();
  if (await news.isVisible()) {
    await news.click();
    await mode.click();
  } else {
    await mode.click();
    await news.click();
  }
  await expect(page.getByText('Progress saved.', { exact: true })).toBeVisible();
}

async function sync(page: Page) {
  await page.getByRole('button', { name: 'Settings & save tools', exact: true }).click();
  await page.getByRole('button', { name: 'Sync code (move device)', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sync Code' })).toBeVisible();
}

async function readSave(page: Page) {
  return page.evaluate(() => {
    const metadata = JSON.parse(localStorage.getItem('FATE_PROFILES')!);
    return JSON.parse(localStorage.getItem(`FATE_PROFILE_${metadata.activeProfileId}`)!);
  });
}

async function importCode(page: Page, code: string) {
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByPlaceholder('FLSYNC.g1.…').fill(code);
  await page.getByRole('button', { name: 'Verify code', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Import & overwrite this profile' })).toBeEnabled();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Import & overwrite this profile' }).click();
  await expect(page.getByText('Progress saved.', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Sync code', exact: true })).toHaveCount(0);
}

test('fresh onboarding, durable save and sync export/import', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Spend Keys', exact: true }).click();
  await page.getByRole('button', { name: 'Roll Skills', exact: true }).click();
  await page.getByRole('button', { name: 'Accept Destiny', exact: true }).click();
  await expect.poll(async () => (await readSave(page)).keys).toBe(2);
  const before = await readSave(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  await sync(page);
  const exported = page.locator('textarea[readonly]');
  await expect(exported).toHaveValue(/^FLSYNC\./);
  const code = await exported.inputValue();
  await importCode(page, code);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  expect((await readSave(page)).unlocks).toEqual(before.unlocks);
  await sync(page);
  await page.getByRole('button', { name: 'Backups', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Restore', exact: true }).first().click();
  await expect(page.getByText('Progress saved.', { exact: true })).toBeVisible();
});

test('mobile navigation and goal planner render without an error boundary', async ({ page }) => {
  await start(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await page.getByRole('button', { name: 'Diaries', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lumbridge Easy diary: locked', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'RuneProof', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Goal Planner', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Goal Planner', exact: true })).toBeVisible();
  await expect(page.getByText("Cook's Assistant", { exact: true }).first()).toBeVisible();
  const planner = page.getByRole('dialog', { name: 'Goal Planner', exact: true });
  await planner.getByRole('button', { name: /Cook's Assistant/ }).click();
  await expect(planner.getByText(/Needs confirmation:|Confirm:/)).toHaveCount(0);
  await expect(planner.getByText(/satisfy the applicable required route legally/)).toHaveCount(0);
  await planner.getByRole('button', { name: /The Restless Ghost/ }).click();
  await expect(planner.getByText('Neck equipment tier 1', { exact: true })).toBeVisible();
  await expect(planner.getByText(/satisfy the applicable required route legally|quest actions and equipment use/)).toHaveCount(0);
});

test('migrated profile preserves attained levels above method tiers and manual diary gates', async ({ page }) => {
  await start(page);
  const state = await readSave(page);
  state.version = 3;
  state.animationsEnabled = false;
  state.unlocks.levels.Cooking = 70;
  state.unlocks.skills.Cooking = 1;
  state.unlocks.levels.Slayer = 70;
  state.unlocks.skills.Slayer = 1;
  state.unlocks.regions = ['Lumbridge'];
  await sync(page);
  await importCode(page, await encodeSyncCode(state));
  await page.reload();
  await page.getByRole('button', { name: 'Continue without compensation', exact: true }).click();
  await page.getByRole('button', { name: "Close What's New", exact: true }).click();
  await expect(page.locator('[data-skill-card="Cooking"]')).toContainText('Lvl 70/99');
  await expect(page.locator('[data-skill-card="Cooking"]')).toContainText('Methods: 1-10');
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await page.getByRole('button', { name: 'Diaries', exact: true }).click();
  await page.getByRole('heading', { name: 'Lumbridge Easy', exact: true }).click();
  await expect(page.getByText('Slay a Cave bug beneath Lumbridge Swamp.', { exact: true })).toBeVisible();
  await expect(page.getByText('A usable light source', { exact: false }).first()).toBeVisible();
  expect((await readSave(page)).unlocks.completedTasks).not.toContain('lum_easy_2');
  const task = page.locator('[data-diary-task-row="lum_easy_2"]');
  await expect(task.getByRole('button', { name: 'Slayer 7', exact: true })).toHaveCount(0);
  page.once('dialog', dialog => {
    expect(dialog.message()).toContain('light source');
    return dialog.dismiss();
  });
  await task.getByRole('button', { name: 'Complete diary task: Slay a Cave bug beneath Lumbridge Swamp.', exact: true }).click();
  expect((await readSave(page)).unlocks.completedTasks).not.toContain('lum_easy_2');
});

test('localStorage quota uses durable recovery and retry restores protection', async ({ page }) => {
  await start(page);
  const state = await readSave(page);
  state.animationsEnabled = false;
  state.unlocks.skills.Hitpoints = 2;
  await sync(page);
  await importCode(page, encodeSyncCode(state));
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).__restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('FATE_PROFILE_') && !key.includes('__')) throw new DOMException('Test quota exhausted', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.locator('[data-skill-card="Hitpoints"]').click();
  await expect(page.getByText('Saved, backup protection unavailable', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).__restoreStorage());
  await page.getByRole('button', { name: 'Retry protection', exact: true }).click();
  await expect(page.getByText('Progress saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-skill-card="Hitpoints"]')).toContainText('Lvl 11/99');
});

test('mobile cold load under throttled CPU and network', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const began = Date.now();
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeInViewport({ ratio: 1 });
  const measurement = await page.evaluate(() => ({
    navigation: performance.getEntriesByType('navigation').map(entry => entry.toJSON()),
    paints: performance.getEntriesByType('paint').map(entry => entry.toJSON()),
  }));
  const onboardingVisibleMs = Date.now() - began;
  await testInfo.attach('mobile-cold-load.json', { body: JSON.stringify({
    profile: '390x844, 4x CPU slowdown, 1.6 Mbps download, 150ms latency, cold cache',
    onboardingVisibleMs, ...measurement,
  }, null, 2), contentType: 'application/json' });
  expect(onboardingVisibleMs).toBeLessThan(20_000);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Step 2 / 5', { exact: true })).toBeVisible();
});

test('conditional quest advice and legacy timelapse remain honest after import', async ({ page }) => {
  // This complete import/reload/advice/history journey can take over 40 seconds
  // with trace recording. Cold-load performance has its own separate test.
  test.setTimeout(60_000);
  await start(page);
  const state = await readSave(page);
  state.advisorsEnabled = true;
  state.animationsEnabled = false;
  state.history = [{ id: 'legacy-audit', timestamp: 1, type: 'ROLL_FAIL', message: 'No Key.' }];
  await sync(page);
  await importCode(page, encodeSyncCode(state));
  await page.reload();
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await page.getByTitle('Switch to High Impact (by unlock count)').click();
  await expect(page.getByText(/Needs confirmation: \d+ checks? - open quest details/).first()).toBeVisible();
  await expect(page.getByText('No available quests to rank — complete some prerequisites first.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'Timelapse', exact: true }).click();
  await expect(page.getByText('LOCAL CONSISTENCY: NEEDS REVIEW', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export History Bundle', exact: true })).toBeVisible();
  await expect(page.getByText('INTEGRITY: OK', { exact: true })).toHaveCount(0);
});
