const LOCALES = ['en', 'uk'];

function resolveLocale(setting, systemLocale) {
  if (setting === 'en' || setting === 'uk') return setting;
  if (setting !== 'auto') return 'en';
  const sys = String(systemLocale || '').toLowerCase();
  return sys.startsWith('uk') ? 'uk' : 'en';
}

module.exports = { resolveLocale, LOCALES };
