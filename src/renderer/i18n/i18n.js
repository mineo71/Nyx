// Reads ?lang=, exposes window.t(key), applies [data-i18n]/[data-i18n-html] on load.
(function () {
  const lang = new URLSearchParams(location.search).get('lang') || 'en';
  const dict = (window.NYX_STRINGS && (window.NYX_STRINGS[lang] || window.NYX_STRINGS.en)) || {};
  window.NYX_LANG = lang;
  window.t = (key) => (key in dict ? dict[key] : key);
  function apply() {
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = window.t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = window.t(el.getAttribute('data-i18n-html')); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
