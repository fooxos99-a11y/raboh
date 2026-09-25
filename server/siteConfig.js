const rabwaSiteConfig = {
  key: 'rabwa',
  registrationNumber: 'platform',
  name: 'ربوة',
  shortName: 'ربوة',
  heroTitle: 'برنامج ربوة',
  heroDescription: 'برنامج قرآني رائد يهدف إلى خدمة كتاب الله تعالى تلاوةً وحفظاً وتدبراً. يضم المجمع مسارات تعليمية متخصصة (مسار الحفظ ومسار الإتقان) تحت إشراف نخبة من المعلمين المتميزين، لتمكين الطلاب من ضبط المصحف وبناء جيل قرآني متميز.',
  description: 'برنامج قرآني رائد يهدف إلى خدمة كتاب الله تعالى تلاوةً وحفظاً وتدبراً. يضم المجمع مسارات تعليمية متخصصة (مسار الحفظ ومسار الإتقان) تحت إشراف نخبة من المعلمين المتميزين، لتمكين الطلاب من ضبط المصحف وبناء جيل قرآني متميز.',
  logo: 'branding/rabwa/rabwa-logo-color.svg',
  squareLogo: 'branding/rabwa/icon-512.png',
  whatsappUrl: '',
  themeColor: '#08A9CE',
  appUrl: 'https://rboh.cc',
  apiUrl: 'https://rboh.cc/api',
  features: { store: false, dailyChallenge: false, summit: false, studentHome: true, culturalCompetition: false, nazem: false, nazemAutomaticAttendance: false },
};

export const siteKey = 'rabwa';
export const siteName = rabwaSiteConfig.name;

export function getSiteConfig() {
  return {
    ...rabwaSiteConfig,
    registrationNumber: process.env.SITE_REGISTRATION_NUMBER ?? rabwaSiteConfig.registrationNumber,
    whatsappUrl: process.env.PUBLIC_WHATSAPP_URL ?? rabwaSiteConfig.whatsappUrl,
  };
}
