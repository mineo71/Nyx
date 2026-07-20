// Sets --accent from the ?accent=RRGGBB query param the main process passes per window.
(function () {
  const a = new URLSearchParams(location.search).get('accent') || '7C8CF8';
  document.documentElement.style.setProperty('--accent', '#' + a);
})();
