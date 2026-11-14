/* ==========================================================================
   LUMORA — Skin Treatment LP · page behaviour that is not part of the form.

   Rules for this file:
   - It never touches the enquiry form, its fields or its submit.
   - Doctor pre-fill is NOT re-implemented here. A doctor card without its own
     page keeps the original attributes (data-open-modal + data-doctor) and is
     handled by openModal() in js/script.js, the existing pre-fill hook.
   - It is loaded with `defer` BEFORE js/script.js, so the code below runs once
     the HTML is parsed but before js/script.js binds its click handlers on
     DOMContentLoaded.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- Doctor pages ----------
     Slug -> URL of that doctor's own page. A doctor listed here gets a card
     that links to the page (carrying this page's query string, so utm_*,
     gclid and fbclid reach the doctor page). Everyone else keeps the
     book-with-this-doctor pre-fill. */
  const DOCTOR_PAGES = {
    // Filled in later, when individual doctor pages are built, e.g.
    // 'dr-nidhi-jindal': '/doctors/dr-nidhi-jindal/',
  };

  /* Appends the current query string to href, before any #fragment.
     Keys already on href are kept, and the visitor's values are added after them. */
  function withCurrentQuery(href) {
    const search = window.location.search;
    if (!search || search === '?') return href;
    const hashAt = href.indexOf('#');
    const base = hashAt === -1 ? href : href.slice(0, hashAt);
    const hash = hashAt === -1 ? '' : href.slice(hashAt);
    return base + (base.indexOf('?') === -1 ? '?' : '&') + search.slice(1) + hash;
  }

  function linkDoctorCards() {
    document.querySelectorAll('.lmr-doc-card[data-doctor-slug]').forEach(function (card) {
      const page = DOCTOR_PAGES[card.dataset.doctorSlug];
      if (!page) return; // no page yet: the pre-fill attributes stay as they are

      // Swap the <button> for an <a> with the same look and label. The new
      // element has no data-open-modal, so js/script.js never binds pre-fill to it.
      const link = document.createElement('a');
      link.className = card.className;
      link.href = withCurrentQuery(page);
      link.dataset.doctorSlug = card.dataset.doctorSlug;
      ['aria-label', 'title'].forEach(function (attr) {
        if (card.hasAttribute(attr)) link.setAttribute(attr, card.getAttribute(attr));
      });
      while (card.firstChild) link.appendChild(card.firstChild);
      card.replaceWith(link);
    });
  }

  /* ---------- Missing doctor photo -> neutral silhouette ---------- */

  function initDoctorPhotoFallbacks() {
    document.querySelectorAll('.lmr-doc-photo img').forEach(function (img) {
      function showSilhouette() { img.parentElement.classList.add('is-missing'); }
      img.addEventListener('error', showSilhouette);
      if (img.complete && img.naturalWidth === 0 && img.currentSrc) showSilhouette();
    });
  }

  /* ---------- "Why Lumora": fade-up of the tiles, pull line and steps ----------
     Content is visible by default; the hidden start state only applies once
     .is-ready is set here, and css/why.css skips it under prefers-reduced-motion. */

  function initWhyFade() {
    const section = document.querySelector('.lmr-why');
    if (!section || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const items = section.querySelectorAll('[data-why-fade]');
    items.forEach(function (item) {
      const siblings = item.parentElement.querySelectorAll(':scope > [data-why-fade]');
      const index = Array.prototype.indexOf.call(siblings, item);
      item.style.setProperty('--why-delay', (index * 90) + 'ms');
      // once faded in, drop the delay so the tile hover lift responds at once
      item.addEventListener('transitionend', function onEnd(event) {
        if (event.propertyName !== 'opacity') return;
        item.style.setProperty('--why-delay', '0ms');
        item.removeEventListener('transitionend', onEnd);
      });
    });

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });

    section.classList.add('is-ready');
    items.forEach(function (item) { observer.observe(item); });
  }

  /* ---------- "Skin Treatments We Offer": tabbed explorer ----------
     The tabs are built from the panels (label from data-tr-label, the panel's own
     category icon, count = number of treatments), so a panel removed from the HTML
     takes its tab with it, and with one panel left no tabs are shown. Without JS every
     panel stays visible, stacked. Booking buttons inside keep data-open-modal and are
     handled by js/script.js; nothing here touches the form or the modal. */

  function initTreatmentTabs() {
    const section = document.querySelector('.lmr-treatments');
    if (!section) return;
    const tablist = section.querySelector('.lmr-tr-tabs');
    const scroller = section.querySelector('.lmr-tr-tabs-scroller');
    const panels = Array.prototype.slice.call(section.querySelectorAll('[data-tr-panel]'));
    if (!tablist || panels.length < 2) return;

    const tabs = panels.map(function (panel, i) {
      const tab = document.createElement('button');
      const count = panel.querySelectorAll('.lmr-tr-item').length;
      tab.type = 'button';
      tab.className = 'lmr-tr-tab';
      tab.id = panel.id + '-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panel.id);

      const icon = panel.querySelector('.lmr-tr-cat-ico');
      if (icon) {
        const small = icon.cloneNode(true);
        small.setAttribute('class', 'lmr-tr-tab-ico');
        tab.appendChild(small);
      }
      const label = document.createElement('span');
      label.textContent = panel.dataset.trLabel;
      const num = document.createElement('span');
      num.className = 'lmr-tr-count';
      num.textContent = '(' + count + ')';
      num.setAttribute('aria-hidden', 'true');
      const sr = document.createElement('span');
      sr.className = 'lmr-tr-sr';
      sr.textContent = ', ' + count + (count === 1 ? ' treatment' : ' treatments'); // read as "Acne & Scars, 5 treatments"
      tab.append(label, ' ', num, sr);

      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.tabIndex = 0;

      tab.addEventListener('click', function () { select(i, false); });
      tablist.appendChild(tab);
      return tab;
    });

    let current = -1;

    function select(i, moveFocus) {
      if (i === current) { if (moveFocus) tabs[i].focus(); return; }
      tabs.forEach(function (tab, k) {
        const on = k === i;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        panels[k].hidden = !on;
      });
      if (current !== -1) {
        // crossfade the incoming panel (css/treatments.css; off under reduced motion)
        const panel = panels[i];
        panel.classList.remove('is-entering');
        void panel.offsetWidth;
        panel.classList.add('is-entering');
      }
      current = i;
      if (moveFocus) tabs[i].focus();
      keepTabInView(tabs[i]);
    }

    // keep the active pill visible inside the mobile scroll row, without scrolling the page
    function keepTabInView(tab) {
      if (tablist.scrollWidth <= tablist.clientWidth) return;
      const left = tab.offsetLeft - tablist.offsetLeft;
      const right = left + tab.offsetWidth;
      const pad = 16;
      if (left - pad < tablist.scrollLeft) tablist.scrollTo({ left: left - pad, behavior: 'smooth' });
      else if (right + pad > tablist.scrollLeft + tablist.clientWidth) {
        tablist.scrollTo({ left: right + pad - tablist.clientWidth, behavior: 'smooth' });
      }
    }

    tablist.addEventListener('keydown', function (event) {
      let i = null;
      if (event.key === 'ArrowRight') i = (current + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') i = (current - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') i = 0;
      else if (event.key === 'End') i = tabs.length - 1;
      if (i === null) return;
      event.preventDefault();
      select(i, true);
    });

    // edge fade hints on the mobile scroll row
    function updateEdges() {
      const max = tablist.scrollWidth - tablist.clientWidth;
      scroller.classList.toggle('can-left', tablist.scrollLeft > 2);
      scroller.classList.toggle('can-right', max - tablist.scrollLeft > 2);
    }
    tablist.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges, { passive: true });

    tablist.hidden = false;
    section.classList.add('is-tabbed');
    select(0, false);
    updateEdges();
  }

  linkDoctorCards();
  initDoctorPhotoFallbacks();
  initWhyFade();
  initTreatmentTabs();
})();
