import assert from 'node:assert/strict';
import console from 'node:console';
import { chromium, webkit } from 'playwright';

const base = globalThis.process.env.PORTAL_TEST_URL || 'http://127.0.0.1:3001';
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const width of [360, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await page.goto(`${base}/tests/fixtures/tailwind-migration.html`);
      const open = page.getByRole('button', { name: 'فتح النافذة', exact: true });
      await open.waitFor();
      for (const dark of [false, true]) {
        await page.evaluate((value) => globalThis.document.documentElement.classList.toggle('dark', value), dark);
        const styles = await page.getByTestId('primary').evaluate((element) => {
          const style = globalThis.getComputedStyle(element);
          return { color: style.color, height: style.height, font: style.fontFamily, background: style.backgroundColor };
        });
        assert.equal(styles.color, 'rgb(255, 255, 255)');
        assert.ok(Number.parseFloat(styles.height) >= 44);
        assert.match(styles.font, /Cairo/);
        assert.notEqual(styles.background, 'rgba(0, 0, 0, 0)');
        const border = await open.evaluate((element) => globalThis.getComputedStyle(element).borderTopWidth);
        assert.equal(border, '1px');
        const face = await page.getByTestId('face').boundingBox();
        assert.ok(Math.abs(face.width / face.height - 13 / 24) < 0.001);
        assert.equal(await page.getByTestId('face').evaluate((element) => globalThis.getComputedStyle(element).borderRadius), '12px');
        await open.click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        assert.equal(await dialog.getAttribute('dir'), 'rtl');
        const bounds = await dialog.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
        await dialog.getByRole('button', { name: 'إغلاق النافذة', exact: true }).focus();
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        await page.waitForFunction(() => globalThis.document.activeElement?.textContent === 'فتح النافذة');
        assert.equal(await open.evaluate((element) => element === globalThis.document.activeElement), true);
        assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true);
      }
      await page.close();
    }
    console.log(`${name}: Tailwind migration passed at 360, 768 and 1440px in both themes.`);
  } finally {
    await browser.close();
  }
}
