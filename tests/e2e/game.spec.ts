import { expect, test, type Page } from '@playwright/test';
import { brainById } from '../../src/sim/brains';
import { nextSeed } from '../../src/sim/rng';
import { ARENAS } from '../../src/sim/arenas';
import { arenaForSeed } from '../../src/sim/map';
import { createWorld, stateHash, stepWorld } from '../../src/sim/world';

// A fixed match, reproducible in the browser and in Node.
const BLUE = ['raider', 'rusher', 'sentry'];
const RED = ['picket', 'rusher', 'sentry'];
const MATCH = `seed=7&blue=${BLUE.join(',')}&red=${RED.join(',')}`;

const id = (page: Page, testId: string) => page.getByTestId(testId);
const hook = <T>(page: Page, fn: (h: Window['flagOfDuty']) => T) =>
  page.evaluate(`(${fn.toString()})(window.flagOfDuty)`) as Promise<T>;

async function open(page: Page, query = MATCH): Promise<void> {
  await page.goto(`/?${query}`);
  await expect(id(page, 'tick')).toBeVisible();
  await page.waitForFunction(() => window.flagOfDuty !== undefined);
}

test.describe('behaviour', () => {
  test('loads paused at tick zero with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await open(page);
    await expect(id(page, 'tick')).toHaveText('tick 0');
    await expect(id(page, 'clock')).toHaveText('3:00');
    await expect(id(page, 'play')).toHaveText('Play');
    expect(errors).toEqual([]);
  });

  test('play runs the match and pause stops it', async ({ page }) => {
    await open(page);
    await id(page, 'play').click();
    await expect(id(page, 'play')).toHaveText('Pause');
    await page.waitForFunction(() => window.flagOfDuty.tick() > 5);
    await id(page, 'play').click();
    const stopped = await hook(page, (h) => h.tick());
    await page.waitForTimeout(300);
    expect(await hook(page, (h) => h.tick())).toBe(stopped);
  });

  test('step advances exactly one tick', async ({ page }) => {
    await open(page);
    await id(page, 'step').click();
    await expect(id(page, 'tick')).toHaveText('tick 1');
  });

  test('restart returns to the same opening', async ({ page }) => {
    await open(page);
    const opening = await hook(page, (h) => h.hash());
    await page.evaluate(() => window.flagOfDuty.advance(100));
    await id(page, 'restart').click();
    await expect(id(page, 'tick')).toHaveText('tick 0');
    expect(await hook(page, (h) => h.hash())).toBe(opening);
  });

  test('the browser runs the same simulation as Node, tick for tick', async ({ page }) => {
    await open(page);
    const world = createWorld({ seed: 7, blue: BLUE.map(brainById), red: RED.map(brainById) });
    for (const ticks of [1, 49, 200, 300]) {
      for (let i = 0; i < ticks; i++) stepWorld(world);
      await page.evaluate((n) => window.flagOfDuty.advance(n), ticks);
      expect(await hook(page, (h) => h.hash())).toBe(stateHash(world));
    }
  });

  test('changing a brain restarts the match with that brain', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.flagOfDuty.advance(50));
    await id(page, 'brain-blue-0').selectOption('sentry');
    await expect(id(page, 'tick')).toHaveText('tick 0');
    await expect(id(page, 'state-blue-0')).toHaveText('Patrol');
  });

  test('counts down before kick-off', async ({ page }) => {
    await open(page);
    await id(page, 'play').click();
    await expect(id(page, 'countdown')).toHaveText(/^Kick-off in [123]$/);
    await expect(id(page, 'tick')).toHaveText('tick 0');
    await expect(id(page, 'countdown')).toBeHidden({ timeout: 5000 });
    await page.waitForFunction(() => window.flagOfDuty.tick() > 0);
  });

  test('pausing during the countdown stops kick-off', async ({ page }) => {
    await open(page);
    await id(page, 'play').click();
    await expect(id(page, 'countdown')).toBeVisible();
    await id(page, 'play').click();
    await expect(id(page, 'countdown')).toBeHidden();
    await page.waitForTimeout(3300);
    await expect(id(page, 'tick')).toHaveText('tick 0');
  });

  test('a finished match shows its result, then the next match starts on a new seed', async ({ page }) => {
    await open(page, 'seed=2&blue=sentry,sentry,sentry&red=sentry,sentry,sentry');
    await page.evaluate(() => window.flagOfDuty.advance(1799));
    await id(page, 'play').click();
    await expect(id(page, 'tick')).toHaveText('Draw');
    await expect(id(page, 'countdown')).toHaveText(/^Next match in [123]$/);
    await expect(id(page, 'play')).toHaveText('Pause');

    const seed = nextSeed(2);
    await expect(id(page, 'seed')).toHaveValue(String(seed), { timeout: 5000 });
    await expect(id(page, 'arena-name')).toHaveText(ARENAS[arenaForSeed(seed)].name);
    await page.waitForFunction(() => window.flagOfDuty.tick() > 0);
    await expect(id(page, 'play')).toHaveText('Pause');
  });

  test('restart stops the run of matches', async ({ page }) => {
    await open(page, 'seed=2&blue=sentry,sentry,sentry&red=sentry,sentry,sentry');
    await page.evaluate(() => window.flagOfDuty.advance(1799));
    await id(page, 'play').click();
    await expect(id(page, 'countdown')).toBeVisible();
    await id(page, 'restart').click();
    await expect(id(page, 'countdown')).toBeHidden();
    await page.waitForTimeout(3300);
    await expect(id(page, 'seed')).toHaveValue('2');
    await expect(id(page, 'tick')).toHaveText('tick 0');
  });

  test('shows which arena the seed drew', async ({ page }) => {
    await open(page);
    await expect(id(page, 'arena-name')).toHaveText(ARENAS[arenaForSeed(7)].name);
  });

  test('shows each agent\'s active state', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.flagOfDuty.advance(30));
    await expect(id(page, 'state-blue-1')).toHaveText('Charge');
    await expect(id(page, 'state-red-2')).toHaveText('Patrol');
  });

  test('the layout has no horizontal scroll at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

// Each frame comes from ?tick=, so nothing depends on timing.
test.describe('visual', () => {
  test('arena at kick-off', async ({ page }) => {
    await open(page);
    await expect(id(page, 'arena')).toHaveScreenshot('arena-kickoff.png');
  });

  for (const [index, arena] of ARENAS.entries()) {
    test(`arena layout: ${arena.name}`, async ({ page }) => {
      await open(page, `${MATCH}&arena=${index}`);
      await expect(id(page, 'arena')).toHaveScreenshot(`arena-layout-${index}.png`);
    });
  }

  test('agents mid-stride', async ({ page }) => {
    await open(page, `${MATCH}&tick=31&arena=0`);
    await expect(id(page, 'arena')).toHaveScreenshot('agents-stride.png');
  });

  test('arena mid-match', async ({ page }) => {
    await open(page, `${MATCH}&tick=240`);
    await expect(id(page, 'arena')).toHaveScreenshot('arena-midmatch.png');
  });

  test('whole page mid-match', async ({ page }) => {
    await open(page, `${MATCH}&tick=240`);
    await expect(page).toHaveScreenshot('page-midmatch.png');
  });
});
