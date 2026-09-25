export const RABWA_ANDROID_APK_URL = '/downloads/rabwa-android-1.0.15.apk';
export const RABWA_APP_STORE_URL = 'https://apps.apple.com/app/id6805284064';

export const getDownloadPlatformLinks = (site = {}) => ({
  android: site.androidDownloadUrl || RABWA_ANDROID_APK_URL,
  ios: site.appStoreUrl || '',
});

export function detectDownloadPlatform(userAgent = '', maxTouchPoints = 0) {
  const normalized = String(userAgent || '');
  if (/Android/i.test(normalized)) return 'android';
  if (/iPhone|iPad|iPod/i.test(normalized) || (/Macintosh/i.test(normalized) && Number(maxTouchPoints) > 1)) return 'ios';
  return 'other';
}
