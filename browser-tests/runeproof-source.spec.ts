import { test as base, expect, type Page } from '@playwright/test';

const test = base.extend<{ runtimeGuard: void }>({
  runtimeGuard: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 200, body: '' }));
    await use();
    expect(errors, 'Source reader must not activate an error boundary').toEqual([]);
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
  }, { auto: true }],
});

async function start(page: Page, chunked = true) {
  await page.goto('./');
  for (let index = 0; index < 4; index++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Enter The Void', exact: true }).click();
  const mode = page.getByRole('dialog', { name: 'Choose game mode' });
  const news = page.getByRole('button', { name: "Close What's New" });
  await expect(mode.or(news).first()).toBeVisible();
  if (await news.isVisible()) await news.click();
  await mode.getByRole('button', { name: chunked ? /^Chunked/ : /^Vanilla/ }).click();
  await mode.getByRole('button', { name: 'Apply mode', exact: true }).click();
  if (await news.isVisible()) await news.click();
  await expect(page.getByText('Progress saved.', { exact: true })).toBeVisible();
  // The lazy news dialog can appear after the mode save has completed.
  await page.addLocatorHandler(news, async () => { await news.click(); });
  await page.getByRole('button', { name: 'RuneProof', exact: true }).click();
}
async function selectSource(page: Page, name: string) {
  const dialog = page.getByRole('dialog', { name: 'RuneProof', exact: true });
  await expect(dialog).toBeVisible();
  const library = dialog.getByRole('navigation', { name: 'Quest library' });
  if (!(await library.isVisible())) await dialog.getByRole('button', { name: 'Quest library', exact: true }).click();
  await dialog.getByRole('button', { name: /^All quests/ }).click();
  await dialog.getByRole('textbox', { name: 'Search quests' }).fill(name);
  await library.getByRole('button').filter({ has: page.getByText(name, { exact: true }) }).click();
  await dialog.locator('summary').filter({ hasText: 'Quest walkthrough' }).click();
  await dialog.getByRole('button', { name: /Open Quest Helper walkthrough/ }).click();
  return dialog.getByRole('region', { name: `${name} source walkthrough`, exact: true });
}
async function unlocks(page: Page) {
  return page.evaluate(() => {
    const profiles = JSON.parse(localStorage.getItem('FATE_PROFILES')!);
    return JSON.parse(localStorage.getItem('FATE_PROFILE_' + profiles.activeProfileId)!).unlocks;
  });
}

test('completion access is the default with exact red locked chunks and unresolved supplies', async ({ page }, testInfo) => {
  await start(page);
  const dialog = page.getByRole('dialog', { name: 'RuneProof', exact: true });
  const library = dialog.getByRole('navigation', { name: 'Quest library' });
  await expect(library.getByRole('button')).toHaveCount(210);
  await expect(dialog.getByRole('button', { name: /^All quests/ })).toHaveAttribute('aria-pressed', 'true');
  const choose = async (name: string) => {
    if (!(await library.isVisible())) await dialog.getByRole('button', { name: 'Quest library', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Search quests' }).fill(name);
    await library.getByRole('button').filter({ has: page.getByText(name, { exact: true }) }).click();
  };
  await choose("Cook's Assistant");
  let access = dialog.getByRole('region', { name: 'Quest completion access', exact: true });
  await expect(access).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Open guide/ })).toBeHidden();
  await expect(access.getByRole('heading', { name: 'Items' })).toBeVisible();
  await expect(access.locator('.rp-access-items > li')).not.toHaveCount(0);
  await expect(access.getByText('Not checked yet', { exact: true }).first()).toBeVisible();
  await expect(access.getByRole('heading', { name: 'Completion requirements met', exact: true })).toHaveCount(0);
  await access.locator('.rp-access-items > li').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('runeproof-access-cook-items-desktop.png'), fullPage: false });
  await access.getByText('All required locations', { exact: true }).click();
  await access.getByRole('button', { name: 'Show chunk 50, 50', exact: true }).first().click();
  await expect(access.getByRole('img', { name: 'Quest chunk 50, 50: Unlocked', exact: true })).toBeVisible();
  await choose('Sheep Shearer');
  access = dialog.getByRole('region', { name: 'Quest completion access', exact: true });
  await expect(access.getByRole('img', { name: /Quest chunk/ })).toHaveCount(0);
  await access.getByText('All required locations', { exact: true }).click();
  const fred = access.locator('li.rp-access-node').filter({ has: page.getByRole('button', { name: 'Show chunk 49, 51', exact: true }) }).last();
  await expect(fred).toHaveClass(/rp-access-locked/);
  await expect(fred.getByText('Unlock required', { exact: true })).toBeVisible();
  await access.getByRole('button', { name: 'Show chunk 49, 51', exact: true }).click();
  const lockedMap = access.getByRole('img', { name: 'Quest chunk 49, 51: Unlock required', exact: true });
  await expect(lockedMap).toBeVisible();
  await expect(lockedMap.locator('rect')).toHaveAttribute('stroke', '#f87171');
  await expect(access.getByRole('heading', { name: 'Completion requirements met', exact: true })).toHaveCount(0);
  await access.getByRole('button', { name: 'Close map', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('runeproof-access-locked-chunk.png'), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => dialog.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  await lockedMap.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('runeproof-access-locked-chunk-mobile.png'), fullPage: false });
});

test('item alternatives expose separate sources without granting quest completion', async ({ page }, testInfo) => {
  await start(page);
  const dialog = page.getByRole('dialog', { name: 'RuneProof', exact: true });
  await dialog.getByRole('textbox', { name: 'Search quests' }).fill('Murder Mystery');
  await dialog.getByRole('navigation', { name: 'Quest library' }).getByRole('button').filter({ has: page.getByText('Murder Mystery', { exact: true }) }).click();
  const access = dialog.getByRole('region', { name: 'Quest completion access', exact: true });
  const clause = access.locator('.rp-access-items > li').first();
  await clause.getByText('Check source access', { exact: true }).click();
  await expect(clause.getByText('Choose one complete alternative below.', { exact: true })).toBeVisible();
  await expect(clause.locator('.rp-source-route')).toHaveCount(2);
  await clause.getByText('Sources for Pot', { exact: true }).click();
  await expect(clause.locator('.rp-access-source').first()).toBeVisible();
  await expect(clause.locator('.rp-access-source.rp-access-met')).toHaveCount(0);
  const imp = clause.getByRole('button', { name: 'Imp', exact: true });
  await expect(imp).toHaveCount(1);
  await imp.click();
  await expect(clause.getByRole('img', { name: 'Imp source locations' })).toBeVisible();
  await expect(access.getByRole('heading', { name: 'Completion requirements met', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await clause.getByRole('img', { name: 'Imp source locations' }).scrollIntoViewIfNeeded();
  await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('runeproof-item-alternatives-mobile.png'), fullPage: false });
});

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  test(`${viewport.name} source library, branches and bookmark remain separate from quest completion`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await start(page);
    const before = await unlocks(page);
    const dialog = page.getByRole('dialog', { name: 'RuneProof', exact: true });
    await dialog.getByRole('button', { name: /^All quests/ }).click();
    await expect(dialog.getByRole('navigation', { name: 'Quest library' }).getByRole('button')).toHaveCount(210);
    const manifestResponse = await page.request.get('./runeproof/source-guides/index.json');
    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json();
    expect(manifest.entries).toHaveLength(210);
    expect(new Set(manifest.entries.map((entry: { questId: string }) => entry.questId)).size).toBe(210);
    let reader = await selectSource(page, 'Demon Slayer');
    await expect(reader).toBeVisible();
    await expect(reader.getByRole('heading', { name: 'Starting off', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Mark step done', exact: true })).toHaveCount(0);
    await reader.getByRole('button', { name: /Next section/ }).click();
    await expect(reader.getByRole('heading', { name: "Get Rovin's key", exact: true })).toBeVisible();
    await reader.getByRole('button', { name: /Previous section/ }).click();
    await expect(reader.getByRole('heading', { name: 'Starting off', exact: true })).toBeVisible();
    await reader.getByRole('combobox', { name: 'Quest section' }).selectOption({ label: "4. Get Traiborn's key" });
    await expect(reader.getByText('Place saved to this run.', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close RuneProof', exact: true }).click();
    await page.getByRole('button', { name: 'RuneProof', exact: true }).click();
    reader = await selectSource(page, 'Demon Slayer');
    await expect(reader.getByRole('heading', { name: "Get Traiborn's key", exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'RuneProof', exact: true }).click();
    reader = await selectSource(page, 'Demon Slayer');
    await expect(reader.getByRole('heading', { name: "Get Traiborn's key", exact: true })).toBeVisible();
    await reader.getByRole('button', { name: /Next section/ }).click();
    await expect(reader.getByRole('heading', { name: 'Kill Delrith', exact: true })).toBeVisible();
    await expect(reader.getByRole('button', { name: /Next section/ })).toBeDisabled();
    expect(await unlocks(page)).toEqual(before);
    reader = await selectSource(page, 'Shield of Arrav');
    await expect(reader.getByRole('combobox', { name: 'Quest section' }).locator('option')).toHaveCount(6);
    await reader.getByRole('combobox', { name: 'Quest section' }).selectOption({ label: '2. Phoenix Gang · Joining the gang' });
    await expect(reader.getByRole('heading', { name: 'Phoenix Gang · Joining the gang', exact: true })).toBeVisible();
    await reader.getByRole('combobox', { name: 'Quest section' }).selectOption({ label: '5. Black Arm Gang · Get the phoenix crossbows' });
    await expect(reader.getByRole('heading', { name: 'Black Arm Gang · Get the phoenix crossbows', exact: true })).toBeVisible();
    await expect.poll(async () => {
      const box = await dialog.boundingBox();
      return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height;
    }).toBe(true);
    if (viewport.name === 'mobile') expect(await dialog.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
    await reader.getByRole('combobox', { name: 'Quest section' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`runeproof-source-${viewport.name}.png`), fullPage: false });
    expect(await unlocks(page)).toEqual(before);
  });
}

test('a malformed source response shows a recoverable error without granting progress', async ({ page }) => {
  await start(page);
  const before = await unlocks(page);
  // HTTP 200 malformed data exercises validation without intentional browser network errors.
  await page.route('**/runeproof/source-guides/demon-slayer-*.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"questId":"Wrong quest"}' }));
  await selectSource(page, 'Demon Slayer');
  await expect(page.getByRole('alert').filter({ hasText: 'This walkthrough could not be loaded' })).toBeVisible();
  expect(await unlocks(page)).toEqual(before);
  await page.unroute('**/runeproof/source-guides/demon-slayer-*.json');
  await page.getByRole('button', { name: /Quest overview/ }).click();
  await page.locator('summary').filter({ hasText: 'Quest walkthrough' }).click();
  await page.getByRole('button', { name: /Open Quest Helper walkthrough/ }).click();
  await expect(page.getByRole('region', { name: 'Demon Slayer source walkthrough', exact: true })).toBeVisible();
  expect(await unlocks(page)).toEqual(before);
});





test('guaranteed quest supply establishes acquisition without proving completion', async ({ page }) => {
  await start(page);
  const dialog = page.getByRole('dialog', { name: 'RuneProof', exact: true });
  await dialog.getByRole('textbox', { name: 'Search quests' }).fill('Rune Mysteries');
  await dialog.getByRole('navigation', { name: 'Quest library' }).getByRole('button').filter({ has: page.getByText('Rune Mysteries', { exact: true }) }).click();
  await expect(dialog.getByText('Quest acquisition route established', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Duke Horacio gives you the air talisman/)).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Completion requirements met', exact: true })).toHaveCount(0);
});


test('Restless Ghost displays its necklace slot requirement', async ({ page }) => {
  await start(page);
  const dialog = page.getByRole('dialog', { name: 'RuneProof', exact: true });
  await dialog.getByRole('textbox', { name: 'Search quests' }).fill('The Restless Ghost');
  await dialog.getByRole('navigation', { name: 'Quest library' }).getByRole('button').filter({ has: page.getByText('The Restless Ghost', { exact: true }) }).click();
  await expect(dialog.getByText(/Necklace slot T1: wear the ghostspeak amulet/)).toBeVisible();
  await expect(dialog.getByText(/Necklace slot T1: wear the ghostspeak amulet/)).toContainText('Unlock required');
});


test('mandatory disguise equipment is visible as two separate slot gates', async ({ page }) => {
  await start(page);
  const dialog = page.getByRole('dialog', { name: 'RuneProof', exact: true });
  await dialog.getByRole('textbox', { name: 'Search quests' }).fill("Black Knights' Fortress");
  await dialog.getByRole('navigation', { name: 'Quest library' }).getByRole('button').filter({ has: page.getByText("Black Knights' Fortress", { exact: true }) }).click();
  await expect(dialog.getByText(/Head slot T1: wear the bronze med helm disguise/)).toContainText('Unlock required');
  await expect(dialog.getByText(/Body slot T1: wear the iron chainbody disguise/)).toContainText('Unlock required');
});


test('required access map shows green and red chunks on mobile', async ({ page }, testInfo) => {
  await start(page);
  const dialog = page.getByRole('dialog', { name: 'RuneProof', exact: true });
  await dialog.getByRole('textbox', { name: 'Search quests' }).fill('Rune Mysteries');
  await dialog.getByRole('navigation', { name: 'Quest library' }).getByRole('button').filter({ has: page.getByText('Rune Mysteries', { exact: true }) }).click();
  const map = dialog.getByRole('group', { name: 'Required quest chunks map' });
  await expect(map).toBeVisible();
  await expect(map.locator('rect[stroke="#4ade80"]')).not.toHaveCount(0);
  await expect(map.locator('rect[stroke="#f87171"]')).not.toHaveCount(0);
  await map.getByRole('button').first().click();
  await expect(dialog.getByRole('status')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await map.scrollIntoViewIfNeeded();
  await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('required-access-map-mobile.png') });
});


test('Vanilla RuneProof shows quest chunks using area access without changing mode', async ({ page }, testInfo) => {
  await start(page, false);
  const dialog = page.getByRole('dialog', { name: 'RuneProof', exact: true });
  await dialog.getByRole('textbox', { name: 'Search quests' }).fill("Cook's Assistant");
  await dialog.getByRole('navigation', { name: 'Quest library' }).getByRole('button').filter({ has: page.getByText("Cook's Assistant", { exact: true }) }).click();
  const map = dialog.getByRole('group', { name: 'Required quest chunks map' });
  await expect(map).toBeVisible();
  await expect(map.getByRole('button', { name: /Chunk 50,50: Unlocked/ })).toBeVisible();
  await map.getByRole('button', { name: /Chunk 50,50: Unlocked/ }).click();
  await expect(dialog.getByRole('heading', { name: 'What happens here' })).toBeVisible();
  await expect(dialog.getByText("Give the Cook in Lumbridge Castle's kitchen the required items to finish the quest.", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Vanilla mode: map colours follow your area unlocks/)).toBeVisible();
  await map.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('vanilla-required-map.png') });
});
