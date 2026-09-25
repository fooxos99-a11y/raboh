import { build } from 'vite';

const target = String(process.argv[2] || 'web').toLowerCase();
const targets = {
  web: { mode: 'rabwa', base: '/', apiBase: '/api', apiRoot: '', outDir: 'dist/rabwa', nativeApp: false },
  path: { mode: 'rabwa-path', base: '/rboh/', apiBase: '/rboh/api', apiRoot: '/rboh', outDir: 'dist/rabwa-path', nativeApp: false },
  mobile: { mode: 'rabwa-mobile', base: '/', apiBase: 'https://rboh.cc/api', apiRoot: 'https://rboh.cc', outDir: 'dist/rabwa-mobile', nativeApp: true },
};

const selected = targets[target];
if (!selected) throw new Error('Use web, path or mobile.');
process.env.VITE_SITE_KEY = 'rabwa';
process.env.VITE_NATIVE_APP = String(selected.nativeApp);
process.env.VITE_API_BASE = selected.apiBase;
process.env.VITE_API_BASE_URL = selected.apiRoot;
process.env.BASE_URL = selected.base;

await build({
  mode: selected.mode,
  base: selected.base,
  build: { outDir: selected.outDir, emptyOutDir: true },
});
