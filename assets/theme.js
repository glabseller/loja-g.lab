/* Loja Clean — scripts do tema */
(function () {
  'use strict';

  var config = window.themeConfig || {};

  /* ---------- Formatar dinheiro no formato da loja ---------- */
  function withDelimiters(cents, precision, thousands, decimal) {
    var number = (cents / 100).toFixed(precision);
    var parts = number.split('.');
    var dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
    var rest = parts[1] ? decimal + parts[1] : '';
    return dollars + rest;
  }

  function formatMoney(cents, format) {
    var fmt = format || 'R$ {{amount_with_comma_separator}}';
    var match = fmt.match(/\{\{\s*(\w+)\s*\}\}/);
    var name = match ? match[1] : 'amount';
    var value;
    switch (name) {
      case 'amount': value = withDelimiters(cents, 2, ',', '.'); break;
      case 'amount_no_decimals': value = withDelimiters(cents, 0, ',', '.'); break;
      case 'amount_with_comma_separator': value = withDelimiters(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator': value = withDelimiters(cents, 0, '.', ','); break;
      case 'amount_with_apostrophe_separator': value = withDelimiters(cents, 2, "'", '.'); break;
      default: value = withDelimiters(cents, 2, '.', ',');
    }
    return fmt.replace(/\{\{\s*\w+\s*\}\}/, value);
  }

  /* ---------- Contagem regressiva ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  document.querySelectorAll('[data-countdown]').forEach(function (box) {
    var end = Date.parse(box.getAttribute('data-countdown'));
    var elH = box.querySelector('[data-cd-h]');
    var elM = box.querySelector('[data-cd-m]');
    var elS = box.querySelector('[data-cd-s]');
    if (isNaN(end) || !elH || !elM || !elS) { return; }

    function tick() {
      var s = Math.floor((end - Date.now()) / 1000);
      if (s <= 0) { box.hidden = true; return false; }
      elH.textContent = pad(Math.floor(s / 3600));
      elM.textContent = pad(Math.floor((s % 3600) / 60));
      elS.textContent = pad(s % 60);
      box.hidden = false;
      return true;
    }

    if (tick()) {
      var timer = setInterval(function () {
        if (!tick()) { clearInterval(timer); }
      }, 1000);
    }
  });

  /* ---------- Carrinho: atualizar ao mudar a quantidade ---------- */
  document.querySelectorAll('[data-cart-qty]').forEach(function (input) {
    input.addEventListener('change', function () {
      if (input.form) { input.form.submit(); }
    });
  });

  /* ---------- Busca: foca no campo ao abrir ---------- */
  document.querySelectorAll('.search-toggle').forEach(function (details) {
    details.addEventListener('toggle', function () {
      if (details.open) {
        var field = details.querySelector('input[type="search"]');
        if (field) { field.focus(); }
      }
    });
  });

  /* ---------- Compre junto ---------- */
  function initBundle(box) {
    var items = box.querySelectorAll('[data-bundle-item]');
    var totalEl = box.querySelector('[data-bundle-total]');
    var countEls = box.querySelectorAll('[data-bundle-count]');
    var addBtn = box.querySelector('[data-bundle-add]');

    function mainInfo() {
      var form = document.querySelector('[data-product] form.product-form input[name="id"]');
      var priceEl = document.querySelector('[data-product] [data-price-cents]');
      return {
        id: form ? form.value : null,
        price: priceEl ? parseInt(priceEl.getAttribute('data-price-cents'), 10) : parseInt(box.getAttribute('data-main-price'), 10)
      };
    }

    function update() {
      var main = mainInfo();
      var total = main.price || 0;
      var count = 1;
      items.forEach(function (input) {
        var card = input.closest('.bundle__item');
        if (input.checked) {
          total += parseInt(input.getAttribute('data-price'), 10);
          count += 1;
          if (card) { card.classList.add('is-on'); }
        } else if (card) {
          card.classList.remove('is-on');
        }
      });
      if (totalEl) { totalEl.textContent = formatMoney(total, config.moneyFormat); }
      countEls.forEach(function (el) { el.textContent = count; });
    }

    items.forEach(function (input) { input.addEventListener('change', update); });

    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var main = mainInfo();
        var list = [];
        if (main.id) { list.push({ id: parseInt(main.id, 10), quantity: 1 }); }
        items.forEach(function (input) {
          if (input.checked) { list.push({ id: parseInt(input.getAttribute('data-variant'), 10), quantity: 1 }); }
        });
        addBtn.disabled = true;
        fetch(config.cartAddUrl || '/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: list })
        }).then(function (r) {
          if (!r.ok) { throw new Error('add'); }
          window.location.href = config.cartUrl || '/cart';
        }).catch(function () {
          addBtn.disabled = false;
        });
      });
    }

    update();
  }

  /* ---------- Seções carregadas depois (recomendações e compre junto) ---------- */
  document.querySelectorAll('[data-recommendations]').forEach(function (box) {
    var url = box.getAttribute('data-url');
    if (!url) { return; }
    fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = doc.querySelector('[data-recommendations]');
        if (fresh && fresh.innerHTML.trim().length) {
          box.innerHTML = fresh.innerHTML;
          box.querySelectorAll('[data-bundle]').forEach(initBundle);
        }
      })
      .catch(function () {});
  });

  /* ---------- Página de produto ---------- */
  document.querySelectorAll('[data-product]').forEach(function (root) {
    var sectionId = root.getAttribute('data-section-id');
    var productUrl = root.getAttribute('data-product-url');
    var variantsEl = root.querySelector('[data-variants]');
    var variants = [];
    try { variants = JSON.parse(variantsEl ? variantsEl.textContent : '[]'); } catch (e) { variants = []; }

    /* Galeria */
    var main = root.querySelector('[data-gallery-main]');
    root.querySelectorAll('[data-large]').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        if (!main) { return; }
        var img = document.createElement('img');
        img.src = thumb.getAttribute('data-large');
        img.alt = thumb.getAttribute('data-alt') || '';
        img.width = 1200;
        img.height = 1200;
        main.innerHTML = '';
        main.appendChild(img);
        root.querySelectorAll('[data-large]').forEach(function (t) { t.removeAttribute('aria-current'); });
        thumb.setAttribute('aria-current', 'true');
      });
    });

    /* Variantes (cor, tamanho etc.) */
    var options = root.querySelectorAll('[data-option] input[type="radio"]');
    if (!options.length) { return; }

    function selectedValues() {
      var values = [];
      root.querySelectorAll('[data-option]').forEach(function (fs) {
        var checked = fs.querySelector('input:checked');
        values.push(checked ? checked.value : null);
        var label = fs.querySelector('[data-option-selected]');
        if (label && checked) { label.textContent = checked.value; }
      });
      return values;
    }

    function findVariant(values) {
      for (var i = 0; i < variants.length; i++) {
        var opts = variants[i].options;
        var match = true;
        for (var j = 0; j < values.length; j++) {
          if (opts[j] !== values[j]) { match = false; break; }
        }
        if (match) { return variants[i]; }
      }
      return null;
    }

    function swap(doc, selector) {
      var fresh = doc.querySelector(selector);
      var current = root.querySelector(selector);
      if (fresh && current) { current.innerHTML = fresh.innerHTML; }
    }

    options.forEach(function (input) {
      input.addEventListener('change', function () {
        var variant = findVariant(selectedValues());
        var buy = root.querySelector('[data-buy-block]');
        if (!variant) {
          if (buy) {
            buy.innerHTML = '<button type="button" class="btn btn--lg btn--block" disabled>Indisponível</button>';
          }
          return;
        }
        var url = productUrl + '?variant=' + variant.id + '&section_id=' + encodeURIComponent(sectionId);
        fetch(url)
          .then(function (r) { return r.text(); })
          .then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            swap(doc, '[data-price-block]');
            swap(doc, '[data-buy-block]');
            swap(doc, '[data-gallery-badge]');
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, '', productUrl + '?variant=' + variant.id);
            }
            document.querySelectorAll('[data-bundle]').forEach(function (b) {
              var evt = document.createEvent('Event');
              evt.initEvent('change', true, true);
              var first = b.querySelector('[data-bundle-item]');
              if (first) { first.dispatchEvent(evt); }
            });
          })
          .catch(function () {});
      });
    });
  });
})();

/* Fecha o menu de categorias ao clicar fora */
document.addEventListener('click', function (e) {
  document.querySelectorAll('details.cat-menu[open]').forEach(function (d) {
    if (!d.contains(e.target)) { d.removeAttribute('open'); }
  });
});
