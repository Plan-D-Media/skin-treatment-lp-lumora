/* ==========================================================================
   LUMORA — Presentation layer for the redesigned landing page

   Renders the intent preset from js/page-config.js and runs the purely
   visual behaviour: anchor nav, carousels, clinic tabs, sticky bars and the
   back-to-top button.

   Ground rules (see the change brief, section 2):
   - This file never attaches listeners to the enquiry form or its fields,
     never intercepts submit, and never reads or writes field values.
   - Pre-fill, the modal, scroll-to-form, the FAQ accordion toggle and click
     tracking all stay with js/script.js. This file only *renders* markup
     those existing hooks pick up (.concern-card[data-concern],
     .accordion-trigger), which is why it must load before js/script.js.
   - Everything lives inside this IIFE: js/script.js declares top-level
     consts in the shared global scope, and a clashing name here would
     stop it from loading.
   ========================================================================== */

(function () {
  'use strict';

  const config = window.LUMORA_CONFIG;
  if (!config) return;
  const intent = config.activeIntent;
  const preset = config.presets[intent];
  if (!preset) {
    console.error('[ui] Unknown ACTIVE_INTENT:', intent);
    return;
  }

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollBehaviour = reduceMotion ? 'auto' : 'smooth';

  /* ---------- Helpers ---------- */

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        const value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value; // static, trusted SVG strings only
        else node.setAttribute(key, value === true ? '' : value);
      });
    }
    (children || []).forEach(function (child) {
      if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function resolve(value) {
    return typeof value === 'function' ? value() : value;
  }

  function hasImages(list) {
    return Array.isArray(list) && list.some(function (img) { return img && img.src; });
  }

  /* Own line icons, drawn on a 24px grid, stroked with currentColor. */
  const ICONS = {
    laser: '<path d="M12 3v6"/><path d="M12 15v6"/><path d="M3 12h6"/><path d="M15 12h6"/><circle cx="12" cy="12" r="2.5"/>',
    peel: '<path d="M5 19c7 0 14-5 14-14-9 0-14 7-14 14Z"/><path d="M5 19 13 11"/>',
    sparkle: '<path d="M12 3.5l2 5.5 5.5 2-5.5 2-2 5.5-2-5.5L4.5 11 10 9Z"/>',
    patch: '<circle cx="12" cy="12" r="8.5"/><path d="M8 11c1.5-1.2 3-1.2 4.5 0M11 14c1.5-1.2 3-1.2 4.5 0"/>',
    eye: '<path d="M3 12c2.5-4 6-6 9-6s6.5 2 9 6c-2.5 4-6 6-9 6s-6.5-2-9-6Z"/><circle cx="12" cy="12" r="2.5"/>',
    drop: '<path d="M12 4c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0C6.5 11 9 8 12 4Z"/>',
    grid: '<circle cx="8" cy="8" r="1"/><circle cx="12" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="12" cy="16" r="1"/><circle cx="16" cy="16" r="1"/>',
    layers: '<path d="M12 4 3 9l9 5 9-5-9-5Z"/><path d="M3 14l9 5 9-5"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    device: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 17h6M9 7.5h6v5H9Z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };

  function icon(name, className) {
    return '<svg class="' + (className || 'icon') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      (ICONS[name] || ICONS.sparkle) + '</svg>';
  }

  /* ---------- Hero (the HTML already carries the pigmentation copy) ---------- */

  function renderHero() {
    if (preset.title) document.title = preset.title;
    const light = document.querySelector('[data-h1-light]');
    const bold = document.querySelector('[data-h1-bold]');
    const sub = document.querySelector('[data-hero-sub]');
    if (light && preset.h1Light && light.textContent !== preset.h1Light) light.textContent = preset.h1Light;
    if (bold && preset.h1Bold && bold.textContent !== preset.h1Bold) bold.textContent = preset.h1Bold;
    if (sub && preset.subheading && sub.textContent.trim() !== preset.subheading) sub.textContent = preset.subheading;
  }

  /* ---------- Treatments: rendered as .concern-card buttons so the existing
     pre-fill handler in js/script.js selects the concern and scrolls to the
     form. Nothing here handles the click. ---------- */

  function availableConcernValues() {
    const template = document.getElementById('enquiry-form-template');
    if (!template || !template.content) return null;
    const select = template.content.querySelector('select[name="concern"]');
    if (!select) return null;
    return Array.prototype.map.call(select.options, function (o) { return o.value; });
  }

  function renderTreatments() {
    const grid = document.getElementById('treatment-grid');
    if (!grid) return;
    const heading = document.getElementById('treatments-heading');
    const lead = document.getElementById('treatments-lead');
    if (heading && preset.treatmentsHeading) heading.textContent = preset.treatmentsHeading;
    if (lead && preset.treatmentsLead) lead.textContent = preset.treatmentsLead;

    const values = availableConcernValues();
    grid.textContent = '';

    preset.treatments.forEach(function (t) {
      if (values && values.indexOf(t.concern) === -1) {
        console.warn('[ui] Treatment "' + t.name + '" points at concern "' + t.concern +
          '", which is not an option in the form. Swap the concern <option> set in index.html to match ACTIVE_INTENT.');
      }
      let media;
      if (t.image && t.image.src) {
        media = el('span', { class: 'tx-media' }, [
          el('img', {
            src: t.image.src, alt: t.image.alt || t.name,
            width: t.image.width || 400, height: t.image.height || 500,
            loading: 'lazy', decoding: 'async'
          })
        ]);
      } else {
        // No photograph supplied yet: neutral 4:5 block with a line icon.
        media = el('span', { class: 'tx-media tx-media--placeholder', 'aria-hidden': 'true', html: icon(t.icon, 'tx-icon') });
      }
      const card = el('button', { type: 'button', class: 'concern-card tx-card', 'data-concern': t.concern }, [
        media,
        el('span', { class: 'concern-title', text: t.name }),
        el('span', { class: 'tx-link', html: 'Book This Treatment ' + icon('arrow', 'icon tx-link-icon') })
      ]);
      grid.appendChild(el('li', { class: 'tx-item' }, [card]));
    });
  }

  /* ---------- Clinic gallery (only once confirmed) ---------- */

  function renderClinic() {
    const section = document.getElementById('clinic');
    const gallery = preset.clinicGallery;
    if (!section || !gallery || gallery.confirmed !== true) return;

    const tabKeys = Object.keys(gallery.tabs).filter(function (key) { return hasImages(gallery.tabs[key].images); });
    if (!tabKeys.length) return; // confirmed but no photographs yet: still render nothing

    const tablist = document.getElementById('clinic-tabs');
    const panels = document.getElementById('clinic-panels');
    tablist.textContent = '';
    panels.textContent = '';

    tabKeys.forEach(function (key, index) {
      const tab = gallery.tabs[key];
      const tabId = 'clinic-tab-' + key;
      const panelId = 'clinic-panel-' + key;
      tablist.appendChild(el('button', {
        type: 'button', role: 'tab', class: 'pill-tab', id: tabId,
        'aria-selected': index === 0 ? 'true' : 'false', 'aria-controls': panelId,
        tabindex: index === 0 ? '0' : '-1', text: tab.label
      }));
      const grid = el('div', { class: 'clinic-grid' });
      tab.images.filter(function (img) { return img && img.src; }).forEach(function (img) {
        grid.appendChild(el('figure', { class: 'clinic-photo' }, [
          el('img', { src: img.src, alt: img.alt || tab.label, width: img.width || 600, height: img.height || 450, loading: 'lazy', decoding: 'async' })
        ]));
      });
      panels.appendChild(el('div', { role: 'tabpanel', id: panelId, 'aria-labelledby': tabId, hidden: index !== 0 }, [grid]));
    });

    const caption = document.getElementById('clinic-caption');
    if (caption && gallery.caption) caption.textContent = gallery.caption;

    initTabs(tablist);
    section.hidden = false;
  }

  function initTabs(tablist) {
    const tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        const active = t === tab;
        t.setAttribute('aria-selected', active ? 'true' : 'false');
        t.tabIndex = active ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !active;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false); });
      tab.addEventListener('keydown', function (event) {
        let next = null;
        if (event.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (event.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (event.key === 'Home') next = tabs[0];
        else if (event.key === 'End') next = tabs[tabs.length - 1];
        if (next) { event.preventDefault(); select(next, true); }
      });
    });
  }

  /* ---------- Technology band (only once confirmed) ---------- */

  function renderTechnology() {
    const section = document.getElementById('technology');
    const tech = preset.technology;
    if (!section || !tech || tech.confirmed !== true) return;
    const devices = (tech.devices || []).filter(function (d) { return d && d.name && (d.make || d.model); });
    if (!devices.length) return;

    const track = document.getElementById('tech-track');
    track.textContent = '';
    devices.forEach(function (d) {
      const media = d.image && d.image.src
        ? el('div', { class: 'tech-media' }, [el('img', { src: d.image.src, alt: d.image.alt || d.name, width: d.image.width || 600, height: d.image.height || 450, loading: 'lazy', decoding: 'async' })])
        : el('div', { class: 'tech-media tech-media--placeholder', 'aria-hidden': 'true', html: icon('device', 'tx-icon') });
      track.appendChild(el('article', { class: 'tech-card', role: 'listitem' }, [
        media,
        el('h3', { text: d.name }),
        el('p', { class: 'tech-model', text: [d.make, d.model].filter(Boolean).join(' ') }),
        d.usedFor ? el('p', { class: 'tech-use', text: 'Used for ' + d.usedFor + '.' }) : null
      ]));
    });
    section.hidden = false;
  }

  /* ---------- Doctors: static cards, filtered once `performs` is supplied ---------- */

  function filterDoctors() {
    const mapping = config.doctors || [];
    const anyMapped = mapping.some(function (d) { return d.performs && d.performs.length; });
    if (!anyMapped) return; // mapping not supplied yet: show all ten
    const allowed = mapping.filter(function (d) { return d.performs.indexOf(intent) !== -1; })
      .map(function (d) { return d.name; });
    document.querySelectorAll('#doctor-track .doctor-card').forEach(function (card) {
      const btn = card.querySelector('[data-doctor]');
      card.hidden = !(btn && allowed.indexOf(btn.dataset.doctor) !== -1);
    });
  }

  /* ---------- Pricing: preset offer card (only once confirmed) ----------
     The confirmed card gets a scroll-to-form CTA via the existing
     [data-scroll-to-form] hook in js/script.js. */

  function renderPricing() {
    const offer = preset.offer;
    const grid = document.getElementById('pricing-grid');
    if (!grid || !offer || offer.confirmed !== true || !offer.title || !offer.text) return;
    grid.appendChild(el('article', { class: 'offer-card' }, [
      el('p', { class: 'offer-kicker', text: 'Treatment Offer' }),
      el('h3', { text: offer.title }),
      el('p', { class: 'offer-lead', text: offer.text }),
      offer.terms ? el('p', { class: 'offer-sub', text: offer.terms }) : null,
      el('button', { type: 'button', class: 'btn btn-cta btn-pill', 'data-scroll-to-form': true, text: 'Book an Appointment' })
    ]));
  }

  /* ---------- FAQ: markup for the existing accordion in js/script.js ---------- */

  const PLUS_MINUS = '<span class="faq-sign" aria-hidden="true"></span>';

  function visibleFaqs() {
    return (preset.faqs || []).map(function (item) {
      return { q: item.q, a: resolve(item.a), confirmed: resolve(item.confirmed) };
    }).filter(function (item) {
      // Every visible question must have an answer.
      return item.confirmed === true && item.q && item.a;
    });
  }

  function renderFaq() {
    const accordion = document.getElementById('faq-accordion');
    if (!accordion) return;
    const items = visibleFaqs();
    accordion.textContent = '';
    items.forEach(function (item, i) {
      const n = i + 1;
      accordion.appendChild(el('div', { class: 'accordion-item' }, [
        el('h3', { class: 'accordion-heading' }, [
          el('button', {
            type: 'button', class: 'accordion-trigger', 'aria-expanded': 'false',
            'aria-controls': 'faq-a' + n, id: 'faq-q' + n,
            html: '<span class="faq-q-text"></span>' + PLUS_MINUS
          })
        ]),
        el('div', { class: 'accordion-panel', id: 'faq-a' + n, role: 'region', 'aria-labelledby': 'faq-q' + n, hidden: true }, [
          el('p', { text: item.a })
        ])
      ]));
      accordion.querySelector('#faq-q' + n + ' .faq-q-text').textContent = item.q;
    });

    // FAQPage structured data for the visible Q&As only.
    const old = document.getElementById('faq-jsonld');
    if (old) old.remove();
    if (!items.length) return;
    const ld = el('script', { type: 'application/ld+json', id: 'faq-jsonld' });
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map(function (item) {
        return { '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } };
      })
    });
    document.head.appendChild(ld);
  }

  /* ---------- Anchor nav: hide links to hidden sections ---------- */

  function syncNav() {
    document.querySelectorAll('[data-nav-target]').forEach(function (link) {
      const target = document.getElementById(link.dataset.navTarget);
      const item = link.closest('li') || link;
      item.hidden = !target || target.hidden;
    });
  }

  /* ---------- Alternate white / tinted section backgrounds over the
     sections that are actually visible. data-alt="tint" forces a tint. ---------- */

  function alternateSections() {
    let previous = 'tint'; // so the first section after the hero starts white
    document.querySelectorAll('main > section[data-alt]').forEach(function (section) {
      if (section.hidden) return;
      const mode = section.dataset.alt;
      if (mode === 'band') { previous = 'tint'; return; } // dark band: next section starts white
      const tone = mode === 'tint' ? 'tint' : (previous === 'tint' ? 'white' : 'tint');
      section.classList.toggle('is-tint', tone === 'tint');
      previous = tone;
    });
  }

  /* ---------- Carousels (CSS scroll-snap + arrow buttons + arrow keys) ---------- */

  function initCarousel(root) {
    const track = root.querySelector('.carousel-track');
    if (!track) return;
    const prev = document.querySelector('[data-carousel-prev="' + root.id + '"]');
    const next = document.querySelector('[data-carousel-next="' + root.id + '"]');

    function step() {
      const card = Array.prototype.find.call(track.children, function (c) { return !c.hidden; });
      if (!card) return track.clientWidth;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return card.getBoundingClientRect().width + gap;
    }
    function go(direction) {
      track.scrollBy({ left: direction * step(), behavior: scrollBehaviour });
    }
    function update() {
      const max = track.scrollWidth - track.clientWidth - 2;
      const scrollable = max > 0;
      if (prev) { prev.disabled = !scrollable || track.scrollLeft <= 2; prev.hidden = !scrollable; }
      if (next) { next.disabled = !scrollable || track.scrollLeft >= max; next.hidden = !scrollable; }
    }

    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    track.addEventListener('keydown', function (event) {
      if (event.target !== track) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    });
    let ticking = false;
    track.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; update(); });
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ---------- Desktop sticky bar: visible once the main form card has
     scrolled out of view, hidden while any form or the footer is visible ---------- */

  function initStickyBar() {
    const bar = document.getElementById('sticky-cta');
    const formCard = document.getElementById('hero-form-card');
    if (!bar || !formCard || !('IntersectionObserver' in window)) return;
    const watched = [formCard, document.getElementById('book-form-card'), document.querySelector('.site-footer')]
      .filter(Boolean);
    const visible = new Map();
    let formPassed = false;

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible.set(entry.target, entry.isIntersecting);
        if (entry.target === formCard) {
          formPassed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        }
      });
      const anyVisible = watched.some(function (node) { return visible.get(node); });
      const show = formPassed && !anyVisible;
      bar.classList.toggle('is-visible', show);
      bar.setAttribute('aria-hidden', show ? 'false' : 'true');
      bar.querySelectorAll('a, button').forEach(function (control) { control.tabIndex = show ? 0 : -1; });
    });
    watched.forEach(function (node) { observer.observe(node); });
  }

  /* ---------- Back to top ---------- */

  function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    function update() { btn.classList.toggle('is-visible', window.scrollY > 900); }
    window.addEventListener('scroll', update, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: scrollBehaviour });
      const logo = document.querySelector('.header-logo');
      if (logo) logo.focus({ preventScroll: true });
    });
    update();
  }

  /* ---------- Boot: render synchronously (this script is deferred and runs
     before js/script.js, so its DOMContentLoaded handlers see the markup) ---------- */

  renderHero();
  renderTreatments();
  renderClinic();
  renderTechnology();
  filterDoctors();
  renderPricing();
  renderFaq();
  syncNav();
  alternateSections();

  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    if (!root.closest('[hidden]')) initCarousel(root);
  });
  initStickyBar();
  initBackToTop();
})();
