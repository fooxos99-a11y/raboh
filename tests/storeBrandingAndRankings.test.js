import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('store action uses the shared button theme in light and dark modes', async () => {
  const store = await readFile(new URL('../src/components/dashboard/StoreSection.jsx', import.meta.url), 'utf8');
  const addButton = store.match(/<Button[^>]+onClick=\{\(\) => openProduct\(\)\}[\s\S]*?إضافة منتج[\s\S]*?<\/Button>/)?.[0] || '';
  assert.match(addButton, /className="h-11 rounded-xl"/);
  assert.doesNotMatch(addButton, /bg-white|text-white|text-\[#052e41\]/);
});

test('best committee cards show the full name and allow a wider card', async () => {
  const ranking = await readFile(new URL('../src/components/public/FamilyRankingMarquee.jsx', import.meta.url), 'utf8');
  assert.match(ranking, /w-\[min\(90vw,28rem\)\]/);
  assert.match(ranking, /whitespace-normal break-words[^>]+>\{item\.name\}/);
  assert.doesNotMatch(ranking, /truncate[^>]+>\{item\.name\}/);
});

test('homepage branding keeps the Rabwa lockup', async () => {
  const [config, hero, header] = await Promise.all([
    readFile(new URL('../src/site/siteConfigs.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/public/rawasi/RawasiPublicHero.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/public/rawasi/RawasiPublicHeader.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(config, /organizationName: 'برنامج ربوة'/);
  assert.match(hero, /srcSet=\{site\.logoSmall/);
  assert.match(hero, /sizes="min\(72vw, 320px\)"/);
  assert.match(hero, /site\.organizationName/);
  assert.match(hero, /font-black/);
  assert.match(header, /site\.publicHeaderTitle \|\| site\.name/);
  assert.match(header, /site\.publicHeaderSubtitle \?\? site\.organizationName/);
});
