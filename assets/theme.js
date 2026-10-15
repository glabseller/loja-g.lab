/* Loja Pro — scripts do tema */
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
  /* ---------- Carrossel de banners ---------- */
  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    var track = root.querySelector('[data-carousel-track]');
    var slides = root.querySelectorAll('[data-carousel-slide]');
    var dotsBox = root.querySelector('[data-carousel-dots]');
    var prev = root.querySelector('[data-carousel-prev]');
    var next = root.querySelector('[data-carousel-next]');
    var delay = parseInt(root.getAttribute('data-autoplay'), 10) || 0;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dots = [];
    var paused = false;
    if (!track || slides.length < 2) {
      if (prev) { prev.hidden = true; }
      if (next) { next.hidden = true; }
      return;
    }

    function index() { return Math.round(track.scrollLeft / track.clientWidth); }
    function go(i) {
      var n = (i + slides.length) % slides.length;
      track.scrollTo({ left: n * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    }
    function fit() {
      var cur = Math.min(index(), slides.length - 1);
      var h = slides[cur] ? slides[cur].offsetHeight : 0;
      track.style.height = h ? h + 'px' : '';
    }
    function mark() {
      var cur = index();
      fit();
      dots.forEach(function (d, i) { d.setAttribute('aria-current', i === cur ? 'true' : 'false'); });
    }

    if (dotsBox) {
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'promo__dot';
        b.setAttribute('aria-label', 'Banner ' + (i + 1));
        b.addEventListener('click', function () { go(i); });
        dotsBox.appendChild(b);
        dots.push(b);
      });
    }
    if (prev) { prev.addEventListener('click', function () { go(index() - 1); }); }
    if (next) { next.addEventListener('click', function () { go(index() + 1); }); }
    track.addEventListener('scroll', function () { window.requestAnimationFrame(mark); }, { passive: true });
    mark();
    window.addEventListener('resize', fit);
    window.addEventListener('load', fit);

    if (delay > 0 && !reduce) {
      root.addEventListener('mouseenter', function () { paused = true; });
      root.addEventListener('mouseleave', function () { paused = false; });
      root.addEventListener('focusin', function () { paused = true; });
      root.addEventListener('focusout', function () { paused = false; });
      setInterval(function () { if (!paused && !document.hidden) { go(index() + 1); } }, delay * 1000);
    }
  });
  /* ---------- Celular: tocar numa categoria abre as subcategorias ---------- */
  (function () {
    var nav = document.querySelector('.nav');
    var panel = document.querySelector('[data-nav-panel]');
    if (!nav || !panel) { return; }
    var mq = window.matchMedia('(max-width: 700px)');
    var openItem = null;

    function close() {
      panel.hidden = true;
      panel.innerHTML = '';
      if (openItem) { openItem.classList.remove('is-open'); openItem = null; }
    }

    function link(href, text, cls) {
      var a = document.createElement('a');
      a.href = href;
      a.textContent = text;
      if (cls) { a.className = cls; }
      return a;
    }

    nav.addEventListener('click', function (e) {
      if (!mq.matches) { return; }
      var a = e.target.closest ? e.target.closest('.nav > .nav__item--parent > a') : null;
      if (!a) { return; }
      e.preventDefault();
      var item = a.parentNode;
      if (openItem === item) { close(); return; }
      close();
      openItem = item;
      item.classList.add('is-open');
      panel.appendChild(link(a.getAttribute('href'), 'Ver tudo em ' + a.textContent.trim(), 'nav-panel__all'));
      item.querySelectorAll('.nav__sub a').forEach(function (s) {
        panel.appendChild(link(s.getAttribute('href'), s.textContent.trim()));
      });
      panel.hidden = false;
    });

    document.addEventListener('click', function (e) {
      if (!openItem) { return; }
      if (e.target.closest && (e.target.closest('.nav') || e.target.closest('[data-nav-panel]'))) { return; }
      close();
    });
    window.addEventListener('resize', function () { if (!mq.matches) { close(); } });
  })();
  /* ---------- Tema claro / escuro ---------- */
  document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var root = document.documentElement;
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  });

  /* ---------- Barra fixa do celular: buscar ---------- */
  document.querySelectorAll('[data-search-focus]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      var field = document.getElementById('header-search-input');
      var sform = document.querySelector('.header-search');
      if (sform) { sform.classList.add('is-open'); }
      if (field) { setTimeout(function () { field.focus(); }, 300); }
    });
  });

  /* ---------- Animação suave ao rolar ---------- */
  (function () {
    if (!document.body.classList.contains('has-reveal')) { return; }
    if (!('IntersectionObserver' in window)) { return; }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
    var targets = document.querySelectorAll('main .section, main .reviews, main .faq, main .hero, main .promo');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    targets.forEach(function (el, i) {
      if (i === 0) { return; }
      el.setAttribute('data-reveal', '');
      io.observe(el);
    });
  })();

  /* ---------- Carrinho lateral ---------- */
  (function () {
    var drawer = document.querySelector('[data-drawer]');
    if (!drawer) { return; }
    var panel = drawer.querySelector('.drawer__panel');
    var body = drawer.querySelector('[data-drawer-body]');
    var foot = drawer.querySelector('[data-drawer-foot]');
    var totalEl = drawer.querySelector('[data-drawer-total]');
    var countEl = drawer.querySelector('[data-drawer-count]');
    var ship = drawer.querySelector('[data-drawer-ship]');
    var shipText = drawer.querySelector('[data-drawer-ship-text]');
    var shipFill = drawer.querySelector('[data-drawer-ship-fill]');
    var freeCents = parseInt(drawer.getAttribute('data-free-cents'), 10) || 0;
    var lastFocus = null;

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) { n.className = cls; }
      if (text != null) { n.textContent = text; }
      return n;
    }

    function updateBadges(count) {
      document.querySelectorAll('[data-cart-open]').forEach(function (a) {
        var holder = a.querySelector('.mbar__icon') || a;
        var badge = holder.querySelector('.cart-badge');
        if (count > 0) {
          if (!badge) { badge = el('span', 'cart-badge'); holder.appendChild(badge); }
          badge.textContent = count;
        } else if (badge) {
          badge.remove();
        }
      });
    }

    function render(cart) {
      body.innerHTML = '';
      countEl.textContent = cart.item_count > 0 ? '(' + cart.item_count + ')' : '';
      updateBadges(cart.item_count);
      if (!cart.items.length) {
        var empty = el('div', 'drawer__empty');
        empty.appendChild(el('p', 'drawer__empty-title', 'Seu carrinho está vazio'));
        empty.appendChild(el('p', 'note', 'Que tal dar uma olhada nos produtos mais pedidos?'));
        var shop = el('a', 'btn btn--accent', 'Continuar comprando');
        shop.href = '/collections/all';
        empty.appendChild(shop);
        body.appendChild(empty);
        foot.hidden = true;
        ship.hidden = true;
        return;
      }
      cart.items.forEach(function (item, idx) {
        var row = el('div', 'drawer-item');
        var imgBox = el('a', 'drawer-item__img');
        imgBox.href = item.url;
        if (item.image) {
          var img = document.createElement('img');
          img.src = item.image;
          img.alt = item.product_title;
          img.width = 80; img.height = 80;
          imgBox.appendChild(img);
        }
        var main = el('div', 'drawer-item__main');
        var title = el('a', 'drawer-item__title', item.product_title);
        title.href = item.url;
        main.appendChild(title);
        if (item.variant_title) { main.appendChild(el('span', 'drawer-item__meta', item.variant_title)); }
        var controls = el('div', 'drawer-item__controls');
        var qty = el('div', 'qty-stepper');
        var minus = el('button', null, '−'); minus.type = 'button'; minus.setAttribute('aria-label', 'Diminuir quantidade');
        var num = el('span', null, String(item.quantity));
        var plus = el('button', null, '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'Aumentar quantidade');
        minus.addEventListener('click', function () { change(idx + 1, item.quantity - 1); });
        plus.addEventListener('click', function () { change(idx + 1, item.quantity + 1); });
        qty.appendChild(minus); qty.appendChild(num); qty.appendChild(plus);
        var remove = el('button', 'drawer-item__remove', 'Remover'); remove.type = 'button';
        remove.addEventListener('click', function () { change(idx + 1, 0); });
        controls.appendChild(qty); controls.appendChild(remove);
        main.appendChild(controls);
        var price = el('div', 'drawer-item__price', formatMoney(item.final_line_price, config.moneyFormat));
        row.appendChild(imgBox); row.appendChild(main); row.appendChild(price);
        body.appendChild(row);
      });
      totalEl.textContent = formatMoney(cart.total_price, config.moneyFormat);
      foot.hidden = false;
      if (freeCents > 0) {
        var remaining = freeCents - cart.total_price;
        ship.hidden = false;
        shipFill.style.width = Math.min(100, Math.round(cart.total_price / freeCents * 100)) + '%';
        shipText.textContent = remaining > 0
          ? 'Faltam ' + formatMoney(remaining, config.moneyFormat) + ' para o frete grátis'
          : 'Você ganhou frete grátis!';
      } else {
        ship.hidden = true;
      }
    }

    function load() {
      return fetch(config.cartJsUrl || '/cart.js', { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); }).then(function (cart) { render(cart); return cart; });
    }

    function change(line, quantity) {
      fetch(config.cartChangeUrl || '/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ line: line, quantity: quantity })
      }).then(function (r) { return r.json(); }).then(render).catch(function () {});
    }

    function open() {
      lastFocus = document.activeElement;
      drawer.hidden = false;
      requestAnimationFrame(function () { drawer.classList.add('is-open'); });
      document.documentElement.classList.add('drawer-open');
      load().catch(function () {});
      setTimeout(function () { panel.focus(); }, 50);
    }

    function close() {
      drawer.classList.remove('is-open');
      document.documentElement.classList.remove('drawer-open');
      setTimeout(function () { drawer.hidden = true; }, 250);
      if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    }

    drawer.querySelectorAll('[data-drawer-close]').forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) { close(); } });

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest ? e.target.closest('[data-cart-open]') : null;
      if (!trigger) { return; }
      if (document.body.classList.contains('template-cart')) { return; }
      e.preventDefault();
      open();
    });

    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.getAttribute || (form.getAttribute('action') || '').indexOf('/cart/add') === -1) { return; }
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; }
      fetch(config.cartAddUrl || '/cart/add.js', { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) { if (!r.ok) { throw new Error('add'); } return r.json(); })
        .then(function () { if (btn) { btn.disabled = false; } open(); })
        .catch(function () { if (btn) { btn.disabled = false; } form.submit(); });
    });
  })();
  /* Busca em lupa (computador): clica na lupa para abrir o campo */
  (function () {
    var form = document.querySelector('.header-search');
    if (!form) { return; }
    var input = form.querySelector('input[type="search"]');
    var btn = form.querySelector('button[type="submit"]');
    var wide = window.matchMedia ? window.matchMedia('(min-width: 901px)') : { matches: false };
    function close() { form.classList.remove('is-open'); }
    if (btn) {
      btn.addEventListener('click', function (e) {
        if (!form.classList.contains('is-open')) {
          e.preventDefault();
          form.classList.add('is-open');
          if (input) { input.focus(); }
        } else if (input && !input.value.trim()) {
          e.preventDefault();
          close();
        }
      });
    }
    if (input) {
      input.addEventListener('blur', function () {
        setTimeout(function () {
          if (!form.contains(document.activeElement) && !input.value.trim()) { close(); }
        }, 120);
      });
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); } });
  })();
  /* Vídeos do produto: miniaturas redondas que abrem em janela */
  (function () {
    var wrap = document.querySelector('[data-pvideos]');
    if (!wrap) { return; }
    var modal = wrap.querySelector('[data-vmodal]');
    var body = wrap.querySelector('[data-vmodal-body]');
    var lastBtn = null;
    function close() {
      modal.hidden = true;
      body.textContent = '';
      document.body.classList.remove('vmodal-open');
      if (lastBtn) { lastBtn.focus(); }
    }
    wrap.querySelectorAll('[data-pvideo-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tpl = wrap.querySelector('template[data-pvideo-src="' + btn.getAttribute('data-pvideo-open') + '"]');
        if (!tpl) { return; }
        lastBtn = btn;
        body.textContent = '';
        body.appendChild(tpl.content.cloneNode(true));
        modal.hidden = false;
        document.body.classList.add('vmodal-open');
        var closeBtn = modal.querySelector('.vmodal__close');
        if (closeBtn) { closeBtn.focus(); }
        var v = body.querySelector('video');
        if (v) { var pr = v.play(); if (pr && pr.catch) { pr.catch(function () {}); } }
      });
    });
    modal.querySelectorAll('[data-vmodal-close]').forEach(function (el) { el.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) { close(); } });
  })();
  /* Barra de compra fixa no celular (página de produto) */
  (function () {
    var bar = document.querySelector('[data-buybar]');
    if (!bar) { return; }
    var qty = bar.querySelector('[data-buybar-qty]');
    function val() { var n = parseInt(qty.value, 10); return isNaN(n) || n < 1 ? 1 : n; }
    bar.querySelector('[data-buybar-minus]').addEventListener('click', function () { qty.value = Math.max(1, val() - 1); });
    bar.querySelector('[data-buybar-plus]').addEventListener('click', function () { qty.value = val() + 1; });
    qty.addEventListener('change', function () { qty.value = val(); });
    bar.querySelector('[data-buybar-buy]').addEventListener('click', function () {
      var form = document.querySelector('form.product-form');
      if (!form) { return; }
      var addBtn = form.querySelector('[name="add"]');
      if (!addBtn || addBtn.disabled) { return; }
      var real = form.querySelector('input[name="quantity"]');
      if (real) { real.value = val(); }
      if (form.requestSubmit) { form.requestSubmit(addBtn); } else { addBtn.click(); }
    });
  })();
})();
