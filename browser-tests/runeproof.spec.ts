import { test as base, expect, type Page } from '@playwright/test';

// Playwright supplies isolated contexts; no user preview storage is accessed.
const test = base.extend<{ runtimeGuard: void }>({
  runtimeGuard: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue() : route.fulfill({ status: 200, body: '' }));
    await use();
    expect(errors, 'Unexpected runtime or error-boundary activation').toEqual([]);
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
  }, { auto: true }],
});

async function startChunked(page: Page) {
  await page.goto('./');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Enter The Void', exact: true }).click();
  const mode = page.getByRole('dialog', { name: 'Choose game mode' });
  const news = page.getByRole('button', { name: "Close What's New" });
  await expect(mode.or(news).first()).toBeVisible();
  if (await news.isVisible()) await news.click();
  await mode.getByRole('button', { name: /^Chunked/ }).click();
  await mode.getByRole('button', { name: 'Apply mode', exact: true }).click();
  if (await news.isVisible()) await news.click();
  await expect(page.getByText('Progress saved.', { exact: true })).toBeVisible();
  // The lazy news dialog can appear after the mode save has completed.
  await page.addLocatorHandler(news, async () => { await news.click(); });
}
async function accountUnlocks(page: Page) {
  return page.evaluate(() => {
    const metadata = JSON.parse(localStorage.getItem('FATE_PROFILES')!);
    return JSON.parse(localStorage.getItem('FATE_PROFILE_' + metadata.activeProfileId)!).unlocks;
  });
}
async function guideSave(page: Page, questId: string) {
  return page.evaluate(id => {
    const key = Object.keys(localStorage).find(key => key.startsWith('FATE_RUNEPROOF_2:') && !key.startsWith('FATE_RUNEPROOF_2:last:') && key.endsWith(':' + encodeURIComponent(id)));
    return key ? JSON.parse(localStorage.getItem(key)!) : null;
  }, questId);
}
async function expectWikiArt(page: Page) {
  const images = page.getByRole('dialog', { name: 'RuneProof', exact: true }).locator('.rp-wiki-image:visible');
  await expect.poll(() => images.count(), { message: 'RuneProof should display local Wiki artwork' }).toBeGreaterThan(0);
  await expect.poll(() => images.evaluateAll(elements => elements.every(element => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 1 && image.src.includes('/runeproof/');
  })), { message: 'Every visible Wiki image must load from the local artwork directory' }).toBe(true);
}

async function selectGuide(page: Page, questId: string, overviewPath?: string) {
  const workspace = page.getByRole('dialog', { name: 'RuneProof', exact: true });
  await expect(workspace).toBeVisible();
  const library = workspace.getByRole('navigation', { name: 'Quest library' });
  if (!(await library.isVisible())) await workspace.getByRole('button', { name: 'Quest library', exact: true }).click();
  await expectWikiArt(page);
  await library.getByRole('button').filter({ has: page.getByText(questId, { exact: true }) }).click();
  await expectWikiArt(page);
  if (overviewPath) await page.screenshot({ path: overviewPath, fullPage: false });
  await workspace.locator('summary').filter({ hasText: 'Supporting walkthroughs' }).click();
  await workspace.getByRole('button', { name: /^Open guide/ }).click();
  return workspace.getByRole('region', { name: questId + ' guide', exact: true });
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  test(viewport.name + ' RuneProof supplies, persistence, undo and locked branch', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await startChunked(page);
    const before = await accountUnlocks(page);
    await page.getByRole('button', { name: 'RuneProof', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'RuneProof', exact: true });
    await expect(dialog).toBeVisible();
    await expect.poll(async () => {
      const box = await dialog.boundingBox();
      return box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height;
    }, { message: 'RuneProof must fit the actual viewport, including after Dashboard scrolling' }).toBe(true);
    if (viewport.name === 'mobile') {
      const box = await dialog.boundingBox();
      expect(box).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    }
    let session = await selectGuide(page, "Cook's Assistant", testInfo.outputPath("runeproof-" + viewport.name + "-overview.png"));
    await expect(session.getByRole('heading', { name: 'Speak to the cook', exact: true })).toBeVisible();
    await session.getByRole('tab', { name: 'Prepare', exact: true }).click();
    for (const item of ['Egg', 'Bucket of milk', 'Pot of flour']) await session.getByRole('spinbutton', { name: item + ' quantity', exact: true }).fill('1');
    await expect.poll(async () => (await guideSave(page, "Cook's Assistant"))?.progress.inventory).toEqual({ egg: 1, 'bucket-of-milk': 1, 'pot-of-flour': 1 });
    await expectWikiArt(page);
    await session.getByRole('heading', { name: 'Pack for the journey', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('runeproof-' + viewport.name + '-prepare.png'), fullPage: false });
    await session.getByRole('button', { name: 'Return to your journey' }).click();
    await session.getByRole('button', { name: /Show map/ }).click();
    await expect(session.getByRole('img', { name: /Map centred on Lumbridge Castle kitchen/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('runeproof-' + viewport.name + '-map.png'), fullPage: false });
    await session.getByRole('button', { name: /Hide map/ }).click();
    await expect(session.getByRole('img', { name: /Map centred/ })).toHaveCount(0);
    await session.getByRole('button', { name: 'Mark step done', exact: true }).click();
    await expect(session.getByRole('heading', { name: 'Hand over all three ingredients', exact: true })).toBeVisible();
    await expect.poll(async () => (await guideSave(page, "Cook's Assistant"))?.progress.completed).toEqual(['help-cook']);
    await page.reload();
    await page.getByRole('button', { name: 'RuneProof', exact: true }).click();
    session = await selectGuide(page, "Cook's Assistant");
    await expect(session.getByRole('heading', { name: 'Hand over all three ingredients', exact: true })).toBeVisible();
    await session.getByRole('button', { name: 'Mark step done', exact: true }).click();
    await expect(session.getByRole('heading', { name: 'Your journey is complete', exact: true })).toBeVisible();
    expect(await accountUnlocks(page)).toEqual(before);
    await session.getByText('The full journey', { exact: false }).click();
    await session.getByRole('button', { name: 'Undo Hand over all three ingredients', exact: true }).click();
    await expect(session.getByRole('heading', { name: 'Hand over all three ingredients', exact: true })).toBeVisible();
    await session.getByRole('tab', { name: 'Prepare', exact: true }).click();
    for (const item of ['Egg', 'Bucket of milk', 'Pot of flour']) await expect(session.getByRole('spinbutton', { name: item + ' quantity', exact: true })).toHaveValue('1');
    await session.getByRole('button', { name: 'Return to your journey' }).click();
    await session.getByRole('button', { name: 'Mark step done', exact: true }).click();
    await session.getByRole('button', { name: 'Open quest Journal', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'RuneProof', exact: true })).toHaveCount(0);
    expect((await accountUnlocks(page)).quests).not.toContain("Cook's Assistant");
    await page.getByRole('button', { name: 'RuneProof', exact: true }).click();
    const sheep = await selectGuide(page, 'Sheep Shearer');
    await sheep.getByRole('button', { name: 'I have twenty raw wool to spin', exact: true }).click();
    await expect(sheep.getByRole('heading', { name: 'Spin your prepared wool', exact: true })).toBeVisible();
    await expect(sheep.getByRole('button', { name: 'Mark step done', exact: true })).toBeDisabled();
    await sheep.getByRole('button', { name: 'I have twenty balls of wool', exact: true }).click();
    await sheep.getByRole('tab', { name: 'Prepare', exact: true }).click();
    await sheep.getByRole('spinbutton', { name: 'Ball of wool quantity', exact: true }).fill('20');
    await sheep.getByRole('button', { name: 'Return to your journey' }).click();
    await expect(sheep.getByRole('heading', { name: 'Bring Fred twenty balls of wool', exact: true })).toBeVisible();
    await expect(sheep.getByRole('button', { name: 'Mark step done', exact: true })).toBeDisabled();
    await expect(sheep.locator('.rp-step-blockers')).toContainText("Fred the Farmer's house");
    await expect(sheep.getByRole('button', { name: /Fred the Farmer.*Chunk 49, 51/ })).toBeVisible();
    expect((await guideSave(page, 'Sheep Shearer')).progress.completed).toEqual([]);
    expect(await accountUnlocks(page)).toEqual(before);
    await page.screenshot({ path: testInfo.outputPath('runeproof-' + viewport.name + '-locked.png'), fullPage: false });
  });
}


