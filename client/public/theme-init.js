// Applies the saved theme before React loads so there is no flash of the wrong theme.
(function () {
  try {
    var t = localStorage.getItem('cs-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    /* storage unavailable — fall back to system preference */
  }
})();
