import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { twMerge } from 'tailwind-merge';

test('Tailwind 4 important modifiers keep only the final override', () => {
  assert.equal(twMerge('text-white!', 'text-red-500!'), 'text-red-500!');
  assert.equal(twMerge('min-h-11', 'min-h-12'), 'min-h-12');
});

test('the native iOS minimum supports the stylesheet browser requirements', async () => {
  const project = await readFile(new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8');
  const versions = [...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = (\d+)\.(\d+);/g)];
  assert.ok(versions.length > 0);
  for (const [, major, minor] of versions) {
    assert.ok(Number(major) > 16 || (Number(major) === 16 && Number(minor) >= 4));
  }
});
