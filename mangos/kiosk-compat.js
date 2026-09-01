/* Mango's Dashboard 3.4.2 — compatibiliteit voor oudere Android/Fully Kiosk WebViews */
(function () {
  if (!String.prototype.replaceAll) {
    Object.defineProperty(String.prototype, 'replaceAll', {
      configurable: true,
      writable: true,
      value: function (search, replacement) {
        var source = String(this);
        if (search instanceof RegExp) {
          if (!search.global) throw new TypeError('replaceAll requires a global RegExp');
          return source.replace(search, replacement);
        }
        return source.split(String(search)).join(String(replacement));
      }
    });
  }

  function showError(prefix, value) {
    var target = document.getElementById('connectionText');
    if (!target) return;
    var text = value && value.message ? value.message : String(value || 'onbekende fout');
    target.textContent = prefix + ': ' + text.slice(0, 90);
  }

  window.addEventListener('error', function (event) {
    showError('JS-fout', event.error || event.message);
  });

  window.addEventListener('unhandledrejection', function (event) {
    showError('Datafout', event.reason);
  });
})();
