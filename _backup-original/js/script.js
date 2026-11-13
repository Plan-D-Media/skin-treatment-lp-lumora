/* ==========================================================================
   LUMORA — Skin Treatment Landing Page
   ========================================================================== */

'use strict';

/* ---------- Configuration ----------
   FORM_ENDPOINT: point at a Google Apps Script webhook (or any POST endpoint).
   Leave empty during development — submissions then succeed locally and log
   to the console so the page can be tested end to end.
   CLINIC_PHONE: E.164 digits with country code, e.g. '919999999999'.
   Swap for a call-tracking number here and every tel: link updates.        */
const FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxUReKcNz8cp4SbddcLbtYw7-ZsCTo_qOAbfoBwRoCpPlnntNtVm9NLYp9gAso1O66h-g/exec';
const SHARED_SECRET = 'lum_k7x92qmz4vt_2026'; // must equal CONFIG.SHARED_SECRET in the Apps Script
const CLINIC_PHONE = '+917044638444'; // swap for a call-tracking number here
const THANK_YOU_PAGE = 'thank-you.html'; // post-submit redirect destination
const LEAD_STORAGE_KEY = 'lumora_lead'; // hands the lead to the thank-you page
const ATTRIBUTION_KEY = 'lumora_attribution'; // first-touch campaign data
const ATTRIBUTION_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];

// 'immediate' — GTM loads in <head>. Accurate session and bounce data.
//               Costs ~1-1.5s of main-thread blocking on mobile.
// 'interaction' — GTM loads on the first scroll, click, touch or keypress,
//               or after 3000ms, whichever comes first. Conversion events
//               are preserved in full. Session-start timing becomes less
//               precise and sub-3-second bounces may go unrecorded.
const GTM_LOAD_STRATEGY = 'interaction';
const GTM_CONTAINER_ID = 'GTM-PKZ43QBQ';
const CLINIC_PHONE_DIGITS = CLINIC_PHONE.replace(/\D/g, '');
const WHATSAPP_NUMBER = CLINIC_PHONE_DIGITS; // separate WhatsApp number goes here if different

const WHATSAPP_TEXT = 'Hi,%20I%20would%20like%20to%20book%20a%20skin%20consultation%20at%20Lumora';

window.dataLayer = window.dataLayer || [];

/* ---------- GTM loader ----------
   The dataLayer array exists from <head>, so events pushed before the
   container arrives queue up and are replayed when it loads — no conversion
   event is lost under either strategy. */

let gtmRequested = false;

function loadGTM() {
  if (gtmRequested) return;
  gtmRequested = true;
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_CONTAINER_ID;
  document.head.appendChild(s);
}

function initGTM() {
  if (GTM_LOAD_STRATEGY === 'immediate') {
    loadGTM();
    return;
  }
  const events = ['scroll', 'click', 'touchstart', 'keydown'];
  function onFirstInteraction() {
    events.forEach(function (e) { window.removeEventListener(e, onFirstInteraction); });
    loadGTM();
  }
  events.forEach(function (e) {
    window.addEventListener(e, onFirstInteraction, { once: true, passive: true });
  });
  setTimeout(loadGTM, 3000);
}

function track(payload) {
  window.dataLayer.push(payload);
  if (!FORM_ENDPOINT) console.log('dataLayer event:', payload);
}

function formatPhoneDisplay(digits) {
  // '917044638444' -> '(+91) 70446 38444'
  const local = digits.replace(/^91/, '');
  if (local.length === 10) return '(+91) ' + local.slice(0, 5) + ' ' + local.slice(5);
  return '+' + digits;
}

/* ---------- Phone & WhatsApp injection ---------- */

function injectContactDetails() {
  if (CLINIC_PHONE_DIGITS) {
    document.querySelectorAll('[data-phone-link]').forEach(function (link) {
      link.href = 'tel:+' + CLINIC_PHONE_DIGITS;
    });
    document.querySelectorAll('[data-phone-display]').forEach(function (el) {
      el.textContent = formatPhoneDisplay(CLINIC_PHONE_DIGITS);
    });
  }
  document.querySelectorAll('[data-wa-link]').forEach(function (link) {
    if (WHATSAPP_NUMBER) {
      link.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + WHATSAPP_TEXT;
    }
  });
}

/* ---------- Campaign attribution ----------
   First touch wins: the key is written once per session, so the original
   UTM/click-id values survive later navigations where the parameters have
   dropped off the URL. The referrer is captured at the same moment because
   it is empty on subsequent internal navigations. */

function captureAttribution() {
  try {
    if (sessionStorage.getItem(ATTRIBUTION_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const attribution = { referrer: document.referrer };
    ATTRIBUTION_PARAMS.forEach(function (key) {
      attribution[key] = params.get(key) || '';
    });
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch (e) {
    /* storage unavailable — leads still submit, just without attribution */
  }
}

function readAttribution() {
  const empty = { referrer: '' };
  ATTRIBUTION_PARAMS.forEach(function (key) { empty[key] = ''; });
  try {
    const stored = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY));
    return Object.assign(empty, stored || {});
  } catch (e) {
    return empty;
  }
}

/* ---------- Enquiry form: one template, three mounts, one handler ---------- */

const formState = { preferredDoctor: '', offer: '' };

function mountForms() {
  const template = document.getElementById('enquiry-form-template');
  document.querySelectorAll('[data-form-location]').forEach(function (mount) {
    const location = mount.dataset.formLocation;
    const fragment = template.content.cloneNode(true);
    const form = fragment.querySelector('form');
    form.dataset.formLocation = location;

    // Give every control a unique id and wire its label to it
    // (the honeypot included, so its ids stay unique across the three mounts).
    form.querySelectorAll('.field, .hp-field').forEach(function (field) {
      const control = field.querySelector('input, select');
      const label = field.querySelector('label');
      const id = 'f-' + location + '-' + control.name;
      control.id = id;
      label.setAttribute('for', id);
      label.removeAttribute('data-for');
    });

    form.addEventListener('focusin', onFirstFocus);
    form.addEventListener('submit', onSubmit);
    mount.appendChild(fragment);
  });
}

function onFirstFocus(event) {
  const form = event.currentTarget;
  if (form.dataset.started) return;
  form.dataset.started = 'true';
  // Submission timing starts here. performance.now() is monotonic, so a
  // clock change mid-visit cannot produce a negative or absurd elapsed value.
  form.dataset.startedAt = String(performance.now());
  track({ event: 'form_start', form_location: form.dataset.formLocation });
}

/* Milliseconds from the first focus on this form instance to now. 0 means
   "no focus was ever recorded" — the backend treats 0 as no data and lets the
   lead through, so a visitor who pastes and submits is never blocked. A real
   measurement is floored at 1 so it can never collide with that sentinel. */
function msToSubmit(form) {
  if (!form.dataset.startedAt) return 0;
  const elapsed = Math.round(performance.now() - Number(form.dataset.startedAt));
  return Math.max(1, elapsed);
}

function normalisePhone(raw) {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function validateForm(form) {
  let valid = true;
  let firstInvalid = null;

  form.querySelectorAll('.field').forEach(function (field) {
    const control = field.querySelector('input, select');
    const error = field.querySelector('.field-error');
    if (!control.required || !error) return; // optional fields never block submission
    let ok;

    if (control.name === 'phone') {
      ok = /^[6-9]\d{9}$/.test(normalisePhone(control.value));
    } else {
      ok = control.value.trim() !== '';
    }

    field.classList.toggle('has-error', !ok);
    error.hidden = ok;
    control.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (!ok) {
      valid = false;
      if (!firstInvalid) firstInvalid = control;
    }
  });

  if (firstInvalid) firstInvalid.focus();
  return valid;
}

function onSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!validateForm(form)) return;

  const attribution = readAttribution();
  const payload = {
    secret: SHARED_SECRET,
    company: form.elements.company ? form.elements.company.value : '', // honeypot — humans leave it empty
    name: form.elements.name.value.trim(),
    phone: form.elements.phone.value.trim(), // as typed — the backend normalises +91 / leading 0 / spacing
    concern: form.elements.concern.value,
    duration: form.elements.duration.value,
    preferred_doctor: form.elements.preferred_doctor.value, // 'no_preference' when untouched
    form_location: form.dataset.formLocation,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_term: attribution.utm_term,
    utm_content: attribution.utm_content,
    gclid: attribution.gclid,
    fbclid: attribution.fbclid,
    page_url: window.location.href.split('#')[0],
    referrer: attribution.referrer,
    device: window.innerWidth < 768 ? 'mobile' : 'desktop',
    ms_to_submit: msToSubmit(form) // 0 when no field was ever focused
  };
  if (formState.offer) payload.offer = formState.offer;

  const submitBtn = form.querySelector('.btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Booking…';

  submitLead(payload)
    .then(function (result) {
      // The lead_submit event fires on the thank-you page, not here —
      // navigating away could cut the tag's request short, and the dedicated
      // URL doubles as the conversion trigger for the ad platforms.
      try {
        sessionStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify({
          name: payload.name,
          concern: payload.concern,
          duration: payload.duration,
          form_location: payload.form_location,
          preferred_doctor: payload.preferred_doctor,
          offer: formState.offer || undefined,
          lead_id: (result && result.leadId) || ''
        }));
      } catch (e) {
        /* storage unavailable — the thank-you page simply skips the event */
      }
      window.location.assign(THANK_YOU_PAGE);
    })
    .catch(function (err) {
      handleSubmitError(form, err);
    });
}

/* Apps Script web apps cannot answer a CORS preflight, so the body goes as
   text/plain (a "simple request" — no OPTIONS round-trip); it is still JSON.
   redirect:'follow' matters too: Apps Script 302s to script.googleusercontent.com
   and that final hop carries the permissive CORS header. no-cors is deliberately
   NOT used — it would make the response unreadable, so a failed submission
   would redirect the visitor as if it had succeeded. */
function submitLead(payload) {
  if (!FORM_ENDPOINT) return Promise.resolve({ ok: true, leadId: '' }); // dev mode: succeed locally

  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 12000);

  return fetch(FORM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
    signal: controller.signal
  })
    .then(function (response) { return response.json(); })
    .then(function (result) {
      if (!result.ok) {
        const err = new Error(result.error || 'submit_failed');
        err.code = result.error || 'submit_failed';
        throw err;
      }
      return result;
    })
    .finally(function () { clearTimeout(timeout); });
}

/* A failed request must never lose the lead: the visitor stays on the form
   with every field intact, sees an actionable message, and the failure is
   pushed to the dataLayer so it shows up in GA4 instead of vanishing. */
function handleSubmitError(form, err) {
  const submitBtn = form.querySelector('.btn-submit');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Book My Consultation';

  let code = 'network_error';
  if (err && err.code) code = err.code;
  else if (err && err.name === 'AbortError') code = 'timeout';

  track({ event: 'lead_submit_failed', error: code, form_location: form.dataset.formLocation });

  // Backend field rejections map onto the existing inline validation UI.
  if (code === 'invalid_phone' || code === 'invalid_name') {
    const control = form.elements[code === 'invalid_phone' ? 'phone' : 'name'];
    const field = control.closest('.field');
    field.classList.add('has-error');
    field.querySelector('.field-error').hidden = false;
    control.setAttribute('aria-invalid', 'true');
    control.focus();
    return;
  }

  // These mean the wiring is broken, not the network — surface for debugging.
  if (code === 'unauthorised' || code === 'bad_json' || code === 'server_error') {
    console.error('Lead backend rejected the submission:', code);
  }

  let note = form.querySelector('.form-send-error');
  if (!note) {
    note = document.createElement('p');
    note.className = 'field-error form-send-error';
    form.insertBefore(note, submitBtn);
  }
  note.hidden = false;
  if (code === 'busy') {
    note.textContent = 'Please try again in a moment.';
  } else {
    // 'too_fast' (the backend's ms_to_submit check) deliberately lands here:
    // it gets the same generic message as any other failure. Never tell the
    // visitor the submission was rejected for being too quick.
    note.innerHTML = 'We could not send that just now. Please try again, or call us on ' +
      '<a href="tel:+' + CLINIC_PHONE_DIGITS + '">' + formatPhoneDisplay(CLINIC_PHONE_DIGITS) + '</a>.';
  }
}

/* ---------- Signature flow: concern card -> pre-selected form ---------- */

function setConcernEverywhere(value) {
  document.querySelectorAll('.enquiry-form select[name="concern"]').forEach(function (select) {
    select.value = value;
  });
}

function initConcernCards() {
  document.querySelectorAll('.concern-card').forEach(function (card) {
    card.addEventListener('click', function () {
      const concern = card.dataset.concern;
      const title = card.querySelector('.concern-title').textContent;
      track({ event: 'concern_click', concern: concern, card: title });
      setConcernEverywhere(concern);

      const heroCard = document.getElementById('hero-form-card');
      heroCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const heroSelect = heroCard.querySelector('select[name="concern"]');
      if (heroSelect) {
        heroSelect.classList.add('is-highlighted');
        setTimeout(function () { heroSelect.classList.remove('is-highlighted'); }, 1600);
      }
    });
  });
}

/* ---------- Modal ---------- */

const modal = {
  overlay: null,
  dialog: null,
  lastTrigger: null
};

function openModal(trigger) {
  formState.preferredDoctor = trigger.dataset.doctor || '';
  formState.offer = trigger.dataset.offer || '';

  const note = document.getElementById('modal-doctor-note');
  if (formState.preferredDoctor) {
    note.textContent = 'Requesting a consultation with ' + formState.preferredDoctor + '.';
    note.hidden = false;
  } else if (formState.offer) {
    // avoid "…Inaugural Offer offer" when the offer name already ends in "Offer"
    const suffix = /offer$/i.test(formState.offer) ? '.' : ' offer.';
    note.textContent = 'Booking the ' + formState.offer + suffix + ' A dermatologist confirms it suits your skin first.';
    note.hidden = false;
  } else {
    note.hidden = true;
  }

  if (formState.offer) track({ event: 'offer_click', offer: formState.offer });

  if (formState.preferredDoctor) {
    const doctorSelect = modal.dialog.querySelector('select[name="preferred_doctor"]');
    if (doctorSelect) {
      doctorSelect.value = formState.preferredDoctor;
      doctorSelect.classList.add('is-highlighted');
      setTimeout(function () { doctorSelect.classList.remove('is-highlighted'); }, 1600);
    }
  }

  modal.lastTrigger = trigger;
  modal.overlay.hidden = false;
  document.body.classList.add('modal-open');

  const firstField = modal.dialog.querySelector('input, select, button');
  if (firstField) firstField.focus();

  document.addEventListener('keydown', onModalKeydown);
}

function closeModal() {
  modal.overlay.hidden = true;
  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', onModalKeydown);
  formState.preferredDoctor = '';
  formState.offer = '';
  if (modal.lastTrigger) modal.lastTrigger.focus();
}

function onModalKeydown(event) {
  if (event.key === 'Escape') {
    closeModal();
    return;
  }
  if (event.key !== 'Tab') return;

  const focusables = modal.dialog.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="-1"]'
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function initModal() {
  modal.overlay = document.getElementById('modal-overlay');
  modal.dialog = modal.overlay.querySelector('.modal');

  document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
    btn.addEventListener('click', function () { openModal(btn); });
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  modal.overlay.addEventListener('click', function (event) {
    if (event.target === modal.overlay) closeModal();
  });
}

/* ---------- Scroll-to-form CTA ---------- */

function initScrollToForm() {
  document.querySelectorAll('[data-scroll-to-form]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const heroCard = document.getElementById('hero-form-card');
      heroCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const nameField = heroCard.querySelector('input[name="name"]');
      if (nameField) setTimeout(function () { nameField.focus({ preventScroll: true }); }, 500);
    });
  });
}

/* ---------- Call / WhatsApp click tracking ---------- */

function initClickTracking() {
  document.addEventListener('click', function (event) {
    const el = event.target.closest('[data-track]');
    if (!el) return;
    track({ event: el.dataset.track });
  });
}

/* ---------- Desktop call widget (appears once the hero is scrolled past) ---------- */

function initCallWidget() {
  const widget = document.getElementById('call-widget');
  const hero = document.getElementById('hero');
  function update() {
    widget.classList.toggle('is-visible', window.scrollY > hero.offsetHeight);
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ---------- FAQ accordion (one open at a time) ---------- */

function initAccordion() {
  const triggers = document.querySelectorAll('.accordion-trigger');
  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      triggers.forEach(function (other) {
        other.setAttribute('aria-expanded', 'false');
        document.getElementById(other.getAttribute('aria-controls')).hidden = true;
      });
      if (!expanded) {
        trigger.setAttribute('aria-expanded', 'true');
        document.getElementById(trigger.getAttribute('aria-controls')).hidden = false;
      }
    });
  });
}

/* ---------- Offers T&C disclosure (same ARIA pattern as the FAQ accordion,
   but independent of it — opening a FAQ must not close the terms) ---------- */

function initOffersTerms() {
  const trigger = document.getElementById('offers-terms-trigger');
  if (!trigger) return;
  const panel = document.getElementById(trigger.getAttribute('aria-controls'));
  trigger.addEventListener('click', function () {
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
  });
}

/* ---------- Header shadow after 40px ---------- */

function initHeaderShadow() {
  const header = document.getElementById('site-header');
  function update() {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ---------- Reveal on scroll, staggered across siblings ---------- */

function initReveals() {
  const reveals = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in-view'); });
    return;
  }

  reveals.forEach(function (el) {
    const siblings = el.parentElement.querySelectorAll(':scope > .reveal');
    if (siblings.length > 1) {
      const index = Array.prototype.indexOf.call(siblings, el);
      el.style.setProperty('--reveal-delay', (index * 60) + 'ms');
    }
  });

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  reveals.forEach(function (el) { observer.observe(el); });
}

/* ---------- Lazy Google Maps embed ---------- */

function initLazyMap() {
  const wrap = document.getElementById('map-wrap');
  const iframe = wrap.querySelector('iframe[data-src]');
  const placeholder = document.getElementById('map-placeholder');

  function loadMap() {
    iframe.src = iframe.dataset.src;
    iframe.addEventListener('load', function () {
      iframe.hidden = false;
      placeholder.hidden = true;
    });
  }

  if (!('IntersectionObserver' in window)) {
    loadMap();
    return;
  }
  const observer = new IntersectionObserver(function (entries) {
    if (entries.some(function (e) { return e.isIntersecting; })) {
      observer.disconnect();
      loadMap();
    }
  }, { rootMargin: '400px 0px' });
  observer.observe(wrap);
}

/* ---------- Graceful image fallbacks ---------- */

function initImageFallbacks() {
  // Logos: fall back to a typographic wordmark when the image file is absent
  // (header: assets/lumora-logo.png; footer: assets/lumora-logo-white.png).
  document.querySelectorAll('#logo-img, #footer-logo-img').forEach(function (img) {
    img.addEventListener('error', function () {
      img.hidden = true;
      const wordmark = img.parentElement.querySelector('.footer-wordmark, .logo-wordmark');
      if (wordmark) wordmark.hidden = false;
    });
    if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event('error'));
  });

  // Doctor photos: fall back to an initials tile, never a broken image.
  document.querySelectorAll('.doctor-photo img').forEach(function (img) {
    img.addEventListener('error', function () {
      const tile = document.createElement('div');
      tile.className = 'doctor-initials';
      tile.setAttribute('aria-hidden', 'true');
      tile.textContent = img.dataset.initials || '';
      img.replaceWith(tile);
    });
    if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event('error'));
  });
}

/* ---------- Boot ---------- */

document.addEventListener('DOMContentLoaded', function () {
  captureAttribution(); // first — before anything can navigate or mutate the URL
  initGTM();
  mountForms();
  initLazyMap();
  injectContactDetails();
  initConcernCards();
  initModal();
  initScrollToForm();
  initClickTracking();
  initCallWidget();
  initAccordion();
  initOffersTerms();
  initHeaderShadow();
  initReveals();
  initImageFallbacks();
});
