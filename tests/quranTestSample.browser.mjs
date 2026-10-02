import assert from 'node:assert/strict';
import console from 'node:console';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [360, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:3011/tests/fixtures/quran-test-sample.html');
    const finish = page.getByRole('button', { name: 'إنهاء', exact: true });
    const next = page.getByRole('button', { name: 'المقطع التالي', exact: true });
    await finish.waitFor();
    assert.equal(await finish.isDisabled(), true);
    assert.equal(await page.evaluate(() => globalThis.savedTestPayload), undefined);
    await next.click();
    await page.waitForFunction(() => ![...globalThis.document.querySelectorAll('button')].find((button) => button.textContent === 'إنهاء')?.disabled);
    const pages = new Set();
    for (let index = 0; index < 4; index += 1) {
      pages.add(await page.getByLabel(/^رقم الصفحة /).textContent());
      await next.click();
    }
    assert.deepEqual([...pages].toSorted(), ['1', '2']);
    const size = await finish.boundingBox();
    assert.ok(size.width >= 44 && size.height >= 44, JSON.stringify({ width, size }));
    assert.equal(await page.locator('article').getAttribute('dir'), 'rtl');
    assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true);
    await finish.click();
    await page.waitForFunction(() => Boolean(globalThis.savedTestPayload));
    const payload = await page.evaluate(() => globalThis.savedTestPayload);
    assert.deepEqual(payload.samplePages.toSorted(), [1, 2]);
    assert.equal(payload.wordMarks.filter((mark) => mark.markType === 'warning').length, 1);
    assert.equal(payload.wordMarks.filter((mark) => mark.markType === 'mistake').length, 1);
    await page.close();
  }
  console.log('Quran test two-excerpt workflow passed at 360px and 1440px.');
} finally {
  await browser.close();
}
