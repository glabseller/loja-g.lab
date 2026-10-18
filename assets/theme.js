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

  /* ---------- Carrinho (página): +, - e remover sem recarregar ---------- */
  (function () {
    var page = document.querySelector('[data-cart-page]');
    if (!page) { return; }
    var timer = null, busy = false, again = false;

    function readQuantities() {
      return Array.prototype.map.call(page.querySelectorAll('[data-cart-qty]'), function (i) {
        var n = parseInt(i.value, 10); return isNaN(n) || n < 0 ? 0 : n;
      });
    }
    function setBadges(count) {
      document.querySelectorAll('.cart-badge').forEach(function (b) {
        if (count > 0) { b.textContent = count; } else { b.remove(); }
      });
    }
    function refresh(updates) {
      if (busy) { again = true; return; }
      busy = true;
      fetch((window.__theme && window.__theme.cartUpdateUrl) || '/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ updates: updates })
      }).then(function (r) { return r.json(); }).then(function (cart) {
        setBadges(cart.item_count);
        return fetch('/cart', { headers: { 'Accept': 'text/html' } }).then(function (r) { return r.text(); });
      }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = doc.querySelector('[data-cart-page]');
        if (fresh) { patch(fresh); }
      }).catch(function () {
        var f = page.querySelector('form'); if (f) { f.submit(); }
      }).then(function () {
        busy = false;
        if (again) { again = false; refresh(readQuantities()); }
      });
    }
    function swap(sel, fresh) {
      var a = page.querySelector(sel), b = fresh.querySelector(sel);
      if (a && b && a.innerHTML !== b.innerHTML) { a.innerHTML = b.innerHTML; }
    }
    function patch(fresh) {
      var rows = page.querySelectorAll('.cart-item'), frows = fresh.querySelectorAll('.cart-item');
      /* carrinho vazio ou número de linhas mudou: refaz só a lista e o resumo */
      if (!fresh.querySelector('.cart__layout') || rows.length !== frows.length) {
        page.innerHTML = fresh.innerHTML; return;
      }
      rows.forEach(function (row, i) {
        var f = frows[i];
        var t = row.querySelector('.cart-item__total'), ft = f.querySelector('.cart-item__total');
        if (t && ft && t.textContent !== ft.textContent) { t.textContent = ft.textContent; }
        var m = row.querySelectorAll('.cart-item__meta'), fm = f.querySelectorAll('.cart-item__meta');
        m.forEach(function (x, k) { if (fm[k] && x.innerHTML !== fm[k].innerHTML) { x.innerHTML = fm[k].innerHTML; } });
      });
      swap('.cart__summary', fresh);
      /* barra de frete grátis: só muda o texto e a largura (a barra desliza sem piscar) */
      var bar = page.querySelector('.shipbar'), fbar = fresh.querySelector('.shipbar');
      if (bar && fbar) {
        var tx = bar.querySelector('.shipbar__text'), ftx = fbar.querySelector('.shipbar__text');
        if (tx && ftx && tx.innerHTML !== ftx.innerHTML) { tx.innerHTML = ftx.innerHTML; }
        bar.classList.toggle('is-done', fbar.classList.contains('is-done'));
        var fill = bar.querySelector('.shipbar__fill'), ffill = fbar.querySelector('.shipbar__fill');
        if (fill && ffill) { fill.style.width = ffill.style.width; }
      }
    }
    /* barra de frete grátis: atualiza na hora, antes de o servidor responder */
    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) { n.className = cls; }
      if (text != null) { n.textContent = text; }
      return n;
    }
    var moneyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    function instantBar() {
      var free = parseInt(page.getAttribute('data-free-cents'), 10) || 0;
      var bar = page.querySelector('.shipbar');
      if (!free || !bar) { return; }
      var total = 0;
      page.querySelectorAll('[data-cart-qty]').forEach(function (i) {
        total += (parseInt(i.value, 10) || 0) * (parseInt(i.getAttribute('data-unit-cents'), 10) || 0);
      });
      var left = free - total, done = left <= 0;
      bar.classList.toggle('is-done', done);
      var tx = bar.querySelector('.shipbar__text');
      if (tx) {
        tx.textContent = '';
        if (done) {
          tx.appendChild(el('strong', 'shipbar__goal', 'Parabéns! Você ganhou FRETE GRÁTIS'));
        } else {
          tx.appendChild(document.createTextNode('Falta só '));
          tx.appendChild(el('strong', 'shipbar__amount', moneyFmt.format(left / 100)));
          tx.appendChild(document.createTextNode(' para ganhar '));
          tx.appendChild(el('strong', 'shipbar__goal', 'FRETE GRÁTIS'));
        }
      }
      var fill = bar.querySelector('.shipbar__fill');
      if (fill) { fill.style.width = Math.min(100, Math.round(total / free * 100)) + '%'; }
    }
    function queue() { instantBar(); clearTimeout(timer); timer = setTimeout(function () { refresh(readQuantities()); }, 120); }

    page.addEventListener('click', function (e) {
      var minus = e.target.closest('[data-cart-minus]'), plus = e.target.closest('[data-cart-plus]');
      var rem = e.target.closest('.cart-item__remove');
      if (minus || plus) {
        e.preventDefault();
        var input = (minus || plus).parentNode.querySelector('[data-cart-qty]');
        var n = parseInt(input.value, 10) || 0;
        input.value = Math.max(0, n + (plus ? 1 : -1));
        queue();
      } else if (rem) {
        e.preventDefault();
        var inp = rem.closest('.cart-item').querySelector('[data-cart-qty]');
        inp.value = 0; queue();
      }
    });
    page.addEventListener('change', function (e) {
      if (e.target.matches('[data-cart-qty]')) { queue(); }
    });
  })();

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
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
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
        shipText.textContent = '';
        ship.classList.toggle('is-done', remaining <= 0);
        if (remaining > 0) {
          shipText.appendChild(document.createTextNode('Falta só '));
          shipText.appendChild(el('strong', 'drawer__ship-amount', formatMoney(remaining, config.moneyFormat)));
          shipText.appendChild(document.createTextNode(' para ganhar '));
          shipText.appendChild(el('strong', 'drawer__ship-goal', 'FRETE GRÁTIS'));
        } else {
          shipText.appendChild(el('strong', 'drawer__ship-goal', 'Parabéns! Você ganhou FRETE GRÁTIS'));
        }
      } else {
        ship.hidden = true;
      }
    }

    function load() {
      return fetch(config.cartJsUrl || '/cart.js', { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); }).then(function (cart) { render(cart); return cart; });
    }

    window.__theme = window.__theme || {};
    window.__theme.refreshDrawer = load;

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
  /* ---------- Barra do celular: folha de categorias (abre na hora, sem carregar página) ---------- */
  (function () {
    var trigger = document.querySelector('[data-cats-open]');
    var nav = document.querySelector('.nav');
    if (!trigger || !nav) { return; }
    var mq = window.matchMedia ? window.matchMedia('(max-width: 700px)') : { matches: true };
    var sheet = null;

    function build() {
      sheet = document.createElement('div');
      sheet.className = 'catsheet';
      sheet.hidden = true;
      var overlay = document.createElement('div');
      overlay.className = 'catsheet__overlay';
      var box = document.createElement('div');
      box.className = 'catsheet__box';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'Categorias');
      var head = document.createElement('div');
      head.className = 'catsheet__head';
      var h = document.createElement('strong');
      h.textContent = 'Categorias';
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'catsheet__close';
      x.setAttribute('aria-label', 'Fechar');
      x.textContent = '\u00d7';
      head.appendChild(h);
      head.appendChild(x);
      var list = document.createElement('div');
      list.className = 'catsheet__list';
      nav.querySelectorAll(':scope > .nav__item').forEach(function (item) {
        var a = item.querySelector(':scope > a');
        if (!a) { return; }
        var subs = item.querySelectorAll('.nav__sub a');
        var row = document.createElement('div');
        row.className = 'catsheet__row';
        if (subs.length) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'catsheet__parent';
          btn.setAttribute('aria-expanded', 'false');
          btn.textContent = a.textContent.trim();
          var panel = document.createElement('div');
          panel.className = 'catsheet__subs';
          panel.hidden = true;
          var all = document.createElement('a');
          all.href = a.getAttribute('href');
          all.className = 'catsheet__all';
          all.textContent = 'Ver tudo em ' + a.textContent.trim();
          panel.appendChild(all);
          subs.forEach(function (sa) {
            var l = document.createElement('a');
            l.href = sa.getAttribute('href');
            l.textContent = sa.textContent.trim();
            panel.appendChild(l);
          });
          btn.addEventListener('click', function () {
            var open = panel.hidden;
            panel.hidden = !open;
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            row.classList.toggle('is-open', open);
          });
          row.appendChild(btn);
          row.appendChild(panel);
        } else {
          var l2 = document.createElement('a');
          l2.href = a.getAttribute('href');
          l2.className = 'catsheet__parent';
          l2.textContent = a.textContent.trim();
          row.appendChild(l2);
        }
        list.appendChild(row);
      });
      box.appendChild(head);
      box.appendChild(list);
      sheet.appendChild(overlay);
      sheet.appendChild(box);
      document.body.appendChild(sheet);
      overlay.addEventListener('click', closeSheet);
      x.addEventListener('click', closeSheet);
    }
    function closeSheet() { if (sheet) { sheet.hidden = true; document.documentElement.classList.remove('catsheet-open'); } }
    trigger.addEventListener('click', function (e) {
      if (!mq.matches) { return; }
      e.preventDefault();
      if (!sheet) { build(); }
      sheet.hidden = !sheet.hidden;
      document.documentElement.classList.toggle('catsheet-open', !sheet.hidden);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeSheet(); } });
  })();

  /* ---------- Velocidade: carrega a próxima página assim que o dedo toca / mouse passa ---------- */
  (function () {
    var done = {};
    function prefetch(a) {
      if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) { return; }
      var u;
      try { u = new URL(a.href, location.href); } catch (err) { return; }
      if (u.origin !== location.origin) { return; }
      if (/^\/(cart|checkout|account)/.test(u.pathname) && !/^\/account\/?$/.test(u.pathname)) { return; }
      if (u.href === location.href || done[u.href]) { return; }
      done[u.href] = true;
      var l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = u.href;
      l.as = 'document';
      document.head.appendChild(l);
    }
    function onTouch(e) { prefetch(e.target.closest ? e.target.closest('a[href]') : null); }
    document.addEventListener('touchstart', onTouch, { passive: true });
    document.addEventListener('mouseover', onTouch, { passive: true });
  })();
})();

/* Produto: barra sutil de frete grátis (carrinho + o que o cliente está comprando agora) */
(function () {
  var box = document.querySelector('[data-pfree]');
  var strip = document.querySelector('[data-bfree]');
  var ref = box || strip;
  if (!ref) { return; }
  var free = parseInt(ref.getAttribute('data-free-cents'), 10) || 0;
  var cartCents = parseInt(ref.getAttribute('data-cart-cents'), 10) || 0;
  var counting = true; /* depois de adicionar ao carrinho, só volta a contar se o cliente mexer na quantidade/opção */
  var fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var priceEl = document.querySelector('[data-product] .price-block__current') || document.querySelector('.price-block__current');
  var qtyEl = document.querySelector('.product-form input[name="quantity"]') || document.querySelector('[data-buybar-qty]');

  function priceCents() {
    if (!priceEl) { return 0; }
    var digits = (priceEl.textContent || '').replace(/[^0-9,]/g, '').replace(',', '.');
    var v = parseFloat(digits);
    return isNaN(v) ? 0 : Math.round(v * 100);
  }
  function qty() {
    var bar = document.querySelector('[data-buybar-qty]');
    var mobile = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
    var el = (mobile && bar) ? bar : (qtyEl || bar);
    var n = parseInt(el && el.value, 10); return isNaN(n) || n < 1 ? 1 : n;
  }

  function paint() {
    var pending = counting ? priceCents() * qty() : 0;
    var total = cartCents + pending;
    var left = free - total;
    var msg = left > 0 ? 'Faltam ' + fmt.format(left / 100) + ' para o frete grátis' : 'Frete grátis garantido!';
    var pct = Math.min(100, Math.round(total / free * 100)) + '%';
    [['[data-pfree-text]', '[data-pfree-fill]', box], ['[data-bfree-text]', '[data-bfree-fill]', strip]].forEach(function (a) {
      var wrap = a[2]; if (!wrap) { return; }
      wrap.querySelector(a[0]).textContent = msg;
      wrap.querySelector(a[1]).style.width = pct;
      wrap.classList.toggle('is-done', left <= 0);
    });
  }
  function touch() { counting = true; paint(); }

  document.addEventListener('cart:updated', function (e) {
    cartCents = (e.detail && e.detail.total_price) || 0;
    counting = false; paint();
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-buybar-minus], [data-buybar-plus]')) { touch(); }
  });
  document.addEventListener('input', function (e) { if (e.target.matches('[data-buybar-qty], .product-form input[name="quantity"]')) { touch(); } });
  document.addEventListener('change', function (e) { if (e.target.closest('[data-option], .product-form')) { setTimeout(touch, 0); } });
  if (priceEl && window.MutationObserver) {
    new MutationObserver(function () { touch(); }).observe(priceEl, { childList: true, characterData: true, subtree: true, attributes: true });
  }
  paint();
})();

/* Menu da conta (ícone do boneco): entrar / criar conta */
(function () {
  var wrap = document.querySelector('[data-acct]');
  if (!wrap) { return; }
  var toggle = wrap.querySelector('[data-acct-toggle]');
  var menu = wrap.querySelector('[data-acct-menu]');
  function setOpen(open) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  toggle.addEventListener('click', function (e) { e.preventDefault(); setOpen(menu.hidden); });
  document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) { setOpen(false); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setOpen(false); } });
})();

/* Cartão de produto: ao escolher a quantidade, o preço do cartão acompanha */
document.addEventListener('change', function (e) {
  var input = e.target;
  if (!input.matches || !input.matches('.card__chip-in')) { return; }
  var card = input.closest('.card');
  if (!card) { return; }
  var all = card.querySelectorAll('.card__chip-in');
  for (var i = 0; i < all.length; i++) {
    var lb = all[i].nextElementSibling;
    if (lb) { lb.classList.toggle('is-on', all[i] === input); }
  }
  var from = card.querySelector('.card__from');
  var price = card.querySelector('.card__price');
  var pix = card.querySelector('.card__pix');
  if (from) { from.hidden = true; }
  if (price && input.dataset.price) { price.textContent = input.dataset.price; }
  if (pix && input.dataset.pix) {
    var tail = pix.textContent.indexOf('·') > -1 ? ' ' + pix.textContent.slice(pix.textContent.indexOf('·')) : '';
    pix.textContent = input.dataset.pix + tail;
  }
});

/* Protocolo de atendimento: gerado ao falar com a loja (WhatsApp, e-mail ou formulário) */
(function () {
  var KEY = 'glab_protocol';
  function gen() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = '';
    for (var i = 0; i < 4; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
    return 'GL' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + r;
  }
  function save(code) { try { localStorage.setItem(KEY, code); } catch (e) {} }
  function last() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function toast(code) {
    var t = document.createElement('div');
    t.className = 'protocol-toast';
    t.textContent = 'Seu protocolo: ' + code;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 4200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4800);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="https://wa.me/"], a[href^="mailto:"]');
    if (!a) return;
    var code = gen(); save(code);
    var href = a.getAttribute('href');
    if (href.indexOf('mailto:') === 0) {
      e.preventDefault();
      var to = href.slice(7).split('?')[0];
      window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('Atendimento G LAB - Protocolo ' + code) +
        '&body=' + encodeURIComponent('Protocolo: ' + code + '\n\nOlá! Escreva aqui sua mensagem:\n');
    } else {
      e.preventDefault();
      var u = new URL(href), base = u.searchParams.get('text') || 'Olá! Vim pelo site da G LAB.';
      u.searchParams.set('text', 'Protocolo: ' + code + '\n' + base);
      window.open(u.toString(), '_blank', 'noopener');
    }
    toast(code);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.id !== 'ContactForm') return;
    var code = gen(); save(code);
    var h = f.querySelector('[name="contact[protocolo]"]');
    if (h) h.value = code;
    var b = f.querySelector('[name="contact[body]"]');
    if (b && b.value.indexOf('Protocolo:') !== 0) b.value = 'Protocolo: ' + code + '\n\n' + b.value;
  }, true);
  document.addEventListener('DOMContentLoaded', function () {
    var ok = document.querySelector('[data-protocol-ok]');
    if (ok && last()) {
      var s = ok.querySelector('[data-protocol-code]');
      if (s) s.textContent = last();
    }
  });
})();

/* Produto: quantidade (− / +), sincronizada com a barra fixa, e total da compra ao vivo */
(function () {
  var form = document.querySelector('.product-form input[name="quantity"]');
  var bar = document.querySelector('[data-buybar-qty]');
  var totalEl = document.querySelector('[data-qty-total]');
  var last = '';
  var fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function num(el) { var n = parseInt(el && el.value, 10); return isNaN(n) || n < 1 ? 1 : n; }
  function unit() {
    var el = document.querySelector('[data-product] [data-price-cents]') || document.querySelector('[data-price-cents]');
    return el ? (parseInt(el.getAttribute('data-price-cents'), 10) || 0) : 0;
  }
  function total() {
    if (!totalEl) { return; }
    var n = num(form || bar), u = unit();
    if (!u) { if (!totalEl.hidden) { totalEl.hidden = true; } return; }
    if (totalEl.hidden) { totalEl.hidden = false; }
    var html = (n > 1 ? n + ' × ' + fmt.format(u / 100) + ' = ' : 'Total: ') + '<strong>' + fmt.format(u * n / 100) + '</strong>';
    if (last !== html) { last = html; totalEl.innerHTML = html; }
  }
  function mirror(src) {
    var other = src === form ? bar : form;
    if (other && other !== src) { other.value = src.value; }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-qty-minus], [data-qty-plus]');
    if (!b || !form) { return; }
    form.value = Math.max(1, Math.min(99, num(form) + (b.hasAttribute('data-qty-plus') ? 1 : -1)));
    form.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.addEventListener('input', function (e) {
    if (e.target === form || e.target === bar) { mirror(e.target); total(); }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-buybar-minus], [data-buybar-plus]')) { setTimeout(function () { if (form && bar) { form.value = bar.value; } total(); }, 0); }
  });
  document.addEventListener('change', function (e) { if (e.target.closest && e.target.closest('[data-option], .product-form')) { setTimeout(total, 60); } });
  var pb = document.querySelector('[data-price-block]');
  if (pb && window.MutationObserver) { new MutationObserver(total).observe(pb.parentNode, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-price-cents'] }); }
  total();
})();

/* Rodapé: no celular as colunas começam fechadas (sanfona); no computador ficam abertas */
(function () {
  var accs = document.querySelectorAll('.footer__acc');
  if (!accs.length || !window.matchMedia) { return; }
  var mq = window.matchMedia('(max-width: 749px)');
  function sync() { for (var i = 0; i < accs.length; i++) { accs[i].open = !mq.matches; } }
  sync();
  if (mq.addEventListener) { mq.addEventListener('change', sync); } else if (mq.addListener) { mq.addListener(sync); }
})();

/* Favoritos: coração nos produtos, contador no cabeçalho e página "Favoritos" (guardado neste aparelho) */
(function () {
  var cfg = window.themeConfig || {};
  var KEY = 'glab_favs_' + (cfg.customerId || 'anon'), mem = null;
  function read() {
    if (mem) { return mem.slice(); }
    try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function write(a) { mem = a.slice(); try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  var fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  function paint() {
    var list = read();
    var btns = document.querySelectorAll('[data-fav]');
    for (var i = 0; i < btns.length; i++) {
      var on = list.indexOf(btns[i].getAttribute('data-fav')) > -1;
      btns[i].classList.toggle('is-on', on);
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      btns[i].setAttribute('aria-label', on ? 'Remover dos favoritos' : 'Favoritar');
    }
    var counts = document.querySelectorAll('[data-fav-count]');
    for (var j = 0; j < counts.length; j++) { counts[j].textContent = list.length; counts[j].hidden = list.length === 0; }
  }

  function needLogin() {
    var old = document.querySelector('.fav-toast'); if (old) { old.remove(); }
    var t = el('div', 'fav-toast'); t.setAttribute('role', 'alert');
    t.appendChild(el('span', 'fav-toast__txt', 'Acesse sua conta antes de favoritar um produto.'));
    var go = el('a', 'fav-toast__go', 'ENTRAR'); go.href = cfg.loginUrl || '/account/login'; t.appendChild(go);
    var x = el('button', 'fav-toast__x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar'); x.addEventListener('click', function () { t.remove(); }); t.appendChild(x);
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) { t.remove(); } }, 7000);
  }

  function toggle(handle) {
    if (!cfg.loggedIn) { needLogin(); return false; }
    var list = read(), at = list.indexOf(handle);
    if (at > -1) { list.splice(at, 1); } else { list.push(handle); }
    write(list); paint(); renderPage();
    return true;
  }

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text) { n.textContent = text; } return n; }

  var cache = {};
  function card(p) {
    var c = el('div', 'card');
    var mw = el('div', 'card__mw');
    var a = el('a', 'card__media'); a.href = p.url; a.setAttribute('aria-label', p.title);
    if (p.featured_image) { var img = document.createElement('img'); img.src = p.featured_image + (p.featured_image.indexOf('?') > -1 ? '&' : '?') + 'width=600'; img.alt = p.title; img.loading = 'lazy'; a.appendChild(img); }
    mw.appendChild(a);
    var b = el('button', 'fav is-on'); b.type = 'button'; b.setAttribute('data-fav', p.handle); b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', 'Remover dos favoritos');
    b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.7 3.8 4.5 7.1 4.5c2 0 3.7 1.1 4.9 2.9 1.2-1.8 2.9-2.9 4.9-2.9 3.3 0 5.5 3.2 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>';
    mw.appendChild(b);
    c.appendChild(mw);
    var body = el('div', 'card__body');
    var t = el('a', 'card__title', p.title); t.href = p.url; body.appendChild(t);
    var pr = el('div', 'card__prices');
    pr.appendChild(el('span', 'card__price', (p.price_varies ? 'a partir de ' : '') + fmt.format(p.price / 100)));
    if (p.compare_at_price > p.price) { pr.appendChild(el('s', 'card__compare', fmt.format(p.compare_at_price / 100))); }
    body.appendChild(pr);
    c.appendChild(body);
    var go = el('a', 'btn btn--outline btn--block', p.available ? 'Ver produto' : 'Esgotado'); go.href = p.url; c.appendChild(go);
    return c;
  }

  window.__theme = window.__theme || {};
  window.__theme.productCard = card;

  function renderPage() {
    var grid = document.querySelector('[data-fav-grid]');
    if (!grid) { return; }
    var empty = document.querySelector('[data-fav-empty]');
    var list = cfg.loggedIn ? read() : [];
    if (!cfg.loggedIn) {
      grid.innerHTML = '';
      if (empty) { empty.hidden = false; var m = empty.querySelector('[data-fav-msg]'); if (m) { m.textContent = 'Entre na sua conta para ver e guardar seus favoritos.'; } var lk = empty.querySelector('a'); if (lk) { lk.textContent = 'Entrar'; lk.href = cfg.loginUrl || '/account/login'; } }
      return;
    }
    if (!list.length) { grid.innerHTML = ''; if (empty) { empty.hidden = false; } return; }
    if (empty) { empty.hidden = true; }
    Promise.all(list.map(function (h) {
      if (cache[h]) { return Promise.resolve(cache[h]); }
      return fetch('/products/' + encodeURIComponent(h) + '.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; }).then(function (p) { if (p) { cache[h] = p; } return p; }).catch(function () { return null; });
    })).then(function (items) {
      var gone = [], keep = [];
      items.forEach(function (p, i) { if (p) { keep.push(p); } else { gone.push(list[i]); } });
      if (gone.length) { write(read().filter(function (h) { return gone.indexOf(h) === -1; })); paint(); }
      var now = read();
      grid.innerHTML = '';
      keep.filter(function (p) { return now.indexOf(p.handle) > -1; }).forEach(function (p) { grid.appendChild(card(p)); });
      if (!grid.children.length && empty) { empty.hidden = false; }
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-fav]');
    if (!b) { return; }
    e.preventDefault(); e.stopPropagation();
    if (toggle(b.getAttribute('data-fav')) && b.classList.contains('is-on')) { b.classList.add('is-pop'); setTimeout(function () { b.classList.remove('is-pop'); }, 400); }
  }, true);
  document.addEventListener('click', function (e) {
    var l = e.target.closest && e.target.closest('.fav-link');
    if (l && !cfg.loggedIn) { e.preventDefault(); needLogin(); }
  });
  document.addEventListener('favs:repaint', paint);
  window.addEventListener('storage', function (ev) { if (ev.key === KEY) { mem = null; paint(); renderPage(); } });
  paint(); renderPage();
})();

/* Feedback imediato ao ir para o login/conta (a página da Shopify demora um pouco para abrir) */
(function () {
  function start(link) {
    if (document.documentElement.classList.contains('nav-loading')) { return; }
    document.documentElement.classList.add('nav-loading');
    var bar = document.createElement('div'); bar.className = 'load-bar'; document.body.appendChild(bar);
    var t = document.querySelector('.fav-toast');
    if (t) { t.classList.add('is-loading'); var txt = t.querySelector('.fav-toast__txt'); if (txt) { txt.textContent = 'Abrindo o login…'; } }
    if (link && link.classList.contains('fav-toast__go')) { link.textContent = 'AGUARDE'; }
    setTimeout(stop, 15000);
  }
  function stop() {
    document.documentElement.classList.remove('nav-loading');
    var b = document.querySelector('.load-bar'); if (b) { b.remove(); }
    var t = document.querySelector('.fav-toast'); if (t) { t.remove(); }
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || a.target === '_blank') { return; }
    var h = a.getAttribute('href') || '';
    if (/\/account\/(login|register)|customer_authentication|shopify\.com\/.*account/.test(h)) { start(a); }
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) { stop(); } });
})();

/* ===== Conversão: sugestões no carrinho, Pix no carrinho lateral, vistos recentemente, busca com sugestões, compartilhar ===== */
(function () {
  var cfg = window.themeConfig || {};
  var fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text != null) { n.textContent = text; } return n; }
  function cents(v) { if (typeof v === 'string') { return v.indexOf('.') > -1 ? Math.round(parseFloat(v) * 100) : parseInt(v, 10); } return v; }

  /* --- Carrinho lateral: Pix + "Complete seu pedido" --- */
  var xsellCache = {};
  function drawerExtras(cart) {
    var drawer = document.querySelector('[data-drawer]');
    if (!drawer) { return; }
    var pix = drawer.querySelector('[data-drawer-pix]');
    if (pix) {
      if (cfg.pixDiscount > 0 && cart.total_price > 0) {
        var pixTotal = Math.round(cart.total_price * (100 - cfg.pixDiscount) / 100);
        pix.textContent = '';
        pix.appendChild(document.createTextNode('No Pix: '));
        pix.appendChild(el('strong', null, fmt.format(pixTotal / 100)));
        pix.appendChild(document.createTextNode(' (economize ' + fmt.format((cart.total_price - pixTotal) / 100) + ')'));
        pix.hidden = false;
      } else { pix.hidden = true; }
    }
    var box = drawer.querySelector('[data-drawer-xsell]');
    if (!box) { return; }
    if (!cfg.crossSell || !cart.items || !cart.items.length) { box.hidden = true; box.innerHTML = ''; return; }
    var seed = cart.items[0].product_id;
    var inCart = {}; cart.items.forEach(function (i) { inCart[i.product_id] = true; });
    var go = function (list) {
      var items = list.filter(function (p) { return !inCart[p.id] && p.available !== false; }).slice(0, 4);
      if (!items.length) { box.hidden = true; box.innerHTML = ''; return; }
      box.innerHTML = '';
      box.appendChild(el('p', 'drawer__xsell-title', 'Complete seu pedido'));
      var row = el('div', 'drawer__xsell-row');
      items.forEach(function (p) {
        var v = (p.variants || []).filter(function (x) { return x.available; })[0];
        if (!v) { return; }
        var c = el('div', 'xs');
        var a = el('a', 'xs__img'); a.href = p.url;
        var im = p.featured_image; if (im) { var img = document.createElement('img'); img.src = typeof im === 'string' ? im : im.src || im.url; img.alt = p.title; img.loading = 'lazy'; a.appendChild(img); }
        c.appendChild(a);
        var t = el('a', 'xs__title', p.title); t.href = p.url; c.appendChild(t);
        var multi = (p.variants || []).length > 1;
        c.appendChild(el('span', 'xs__price', (multi ? 'a partir de ' : '') + fmt.format(cents(p.price) / 100)));
        var btn = el('button', 'xs__add', multi ? 'Ver opções' : '+ Adicionar'); btn.type = 'button';
        btn.addEventListener('click', function () {
          if (multi) { window.location.href = p.url; return; }
          btn.disabled = true; btn.textContent = 'Adicionando…';
          fetch(cfg.cartAddUrl || '/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ id: v.id, quantity: 1 }) })
            .then(function (r) { if (!r.ok) { throw new Error('x'); } return r.json(); })
            .then(function () { if (window.__theme && window.__theme.refreshDrawer) { return window.__theme.refreshDrawer(); } })
            .catch(function () { btn.disabled = false; btn.textContent = 'Tentar de novo'; });
        });
        c.appendChild(btn);
        row.appendChild(c);
      });
      box.appendChild(row);
      box.hidden = false;
    };
    if (xsellCache[seed]) { go(xsellCache[seed]); return; }
    fetch('/recommendations/products.json?product_id=' + seed + '&limit=6&intent=related', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : { products: [] }; })
      .then(function (d) { xsellCache[seed] = d.products || []; go(xsellCache[seed]); })
      .catch(function () { box.hidden = true; });
  }
  document.addEventListener('cart:updated', function (e) { if (e.detail) { drawerExtras(e.detail); } });

  /* --- Vistos recentemente --- */
  var RKEY = 'glab_recent';
  function rread() { try { var a = JSON.parse(localStorage.getItem(RKEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function rwrite(a) { try { localStorage.setItem(RKEY, JSON.stringify(a)); } catch (e) {} }
  var cur = document.querySelector('[data-recent-product]');
  var recentBox = document.querySelector('[data-recent]');
  if (cfg.recentlyViewed !== false) {
    var handle = cur && cur.getAttribute('data-recent-product');
    var list = rread();
    if (handle) { list = [handle].concat(list.filter(function (h) { return h !== handle; })).slice(0, 12); rwrite(list); }
    if (recentBox && window.__theme && window.__theme.productCard) {
      var others = list.filter(function (h) { return h !== handle; }).slice(0, 4);
      if (others.length) {
        Promise.all(others.map(function (h) {
          return fetch('/products/' + encodeURIComponent(h) + '.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
        })).then(function (items) {
          items = items.filter(Boolean);
          if (!items.length) { return; }
          var grid = recentBox.querySelector('[data-recent-grid]');
          items.forEach(function (p) { grid.appendChild(window.__theme.productCard(p)); });
          recentBox.hidden = false;
          document.dispatchEvent(new Event('favs:repaint'));
        });
      }
    }
  }

  /* --- Compartilhar --- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-share-btn]');
    if (!b) { return; }
    var box = b.closest('[data-share]'); var title = box.getAttribute('data-title'), url = box.getAttribute('data-url');
    if (navigator.share) { navigator.share({ title: title, text: title + ' - G LAB', url: url }).catch(function () {}); return; }
    window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(title + ' ' + url), '_blank', 'noopener');
  });

  /* --- Busca com sugestões --- */
  function bindSuggest(form, input, box) {
  if (form && input && box && cfg.searchSuggest !== false) {
    var timer = null, ctrl = null;
    function hide() { box.hidden = true; box.innerHTML = ''; }
    function show(products, q) {
      box.innerHTML = '';
      if (!products.length) { box.appendChild(el('p', 'suggest__empty', 'Nada encontrado para "' + q + '". Tente outra palavra.')); box.hidden = false; return; }
      products.forEach(function (p) {
        var a = el('a', 'suggest__item'); a.href = p.url;
        if (p.image) { var im = document.createElement('img'); im.src = p.image; im.alt = ''; im.width = 44; im.height = 44; a.appendChild(im); }
        var t = el('span', 'suggest__txt'); t.appendChild(el('span', 'suggest__title', p.title)); t.appendChild(el('span', 'suggest__price', fmt.format(cents(p.price) / 100))); a.appendChild(t);
        box.appendChild(a);
      });
      var all = el('a', 'suggest__all', 'Ver todos os resultados'); all.href = '/search?q=' + encodeURIComponent(q); box.appendChild(all);
      box.hidden = false;
    }
    input.addEventListener('input', function () {
      var q = input.value.trim(); clearTimeout(timer);
      if (q.length < 2) { hide(); return; }
      timer = setTimeout(function () {
        if (ctrl) { ctrl.abort(); }
        ctrl = window.AbortController ? new AbortController() : null;
        fetch('/search/suggest.json?q=' + encodeURIComponent(q) + '&resources[type]=product&resources[limit]=5', { headers: { Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            if (!d || input.value.trim() !== q) { return; }
            var res = (d.resources && d.resources.results && d.resources.results.products) || [];
            show(res.map(function (p) { return { title: p.title, url: p.url, price: p.price, image: (p.featured_image && p.featured_image.url) || p.image }; }), q);
          }).catch(function () {});
      }, 200);
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) { hide(); } });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hide(); } });
  }
  }
  var hform = document.querySelector('.header-search');
  bindSuggest(hform, hform && hform.querySelector('input[type="search"]'), hform && hform.querySelector('[data-suggest]'));

  /* --- Busca do celular: painel próprio no topo da tela (sem rolar a página) --- */
  var sheet = null;
  function openSheet() {
    if (!sheet) {
      sheet = el('div', 'msearch'); sheet.hidden = true;
      sheet.innerHTML = '<div class="msearch__bar"><form class="msearch__form" action="/search" method="get" role="search"><input type="search" name="q" placeholder="Buscar produtos" autocomplete="off" enterkeyhint="search" aria-label="Buscar"><button type="submit" aria-label="Buscar">OK</button></form><button type="button" class="msearch__close" aria-label="Fechar busca">Cancelar</button></div><div class="suggest msearch__res" data-suggest hidden></div>';
      document.body.appendChild(sheet);
      var f = sheet.querySelector('form'), i = f.querySelector('input'), bx = sheet.querySelector('[data-suggest]');
      bindSuggest(f, i, bx);
      function close() { sheet.hidden = true; document.body.classList.remove('msearch-on'); i.blur(); }
      sheet.querySelector('.msearch__close').addEventListener('click', close);
      i.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); } });
      sheet.addEventListener('click', function (e) { if (e.target === sheet) { close(); } });
    }
    sheet.hidden = false; document.body.classList.add('msearch-on');
    sheet.querySelector('input').focus();
  }
  document.querySelectorAll('[data-search-focus]').forEach(function (btn) {
    btn.addEventListener('click', openSheet);
  });
})();
