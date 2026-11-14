/* ==========================================================================
   LUMORA — Thank-you page
   The landing page (js/script.js) stores the submitted lead in sessionStorage
   under LEAD_STORAGE_KEY and redirects here. This script fires the
   lead_submit conversion event exactly once per submission, personalises the
   heading, and wires up the contact links.
   ========================================================================== */

'use strict';

const CLINIC_PHONE = '+917044638444'; // keep in sync with js/script.js
const GTM_CONTAINER_ID = 'GTM-PKZ43QBQ';
const LEAD_STORAGE_KEY = 'lumora_lead';
const CLINIC_PHONE_DIGITS = CLINIC_PHONE.replace(/\D/g, '');
const WHATSAPP_NUMBER = CLINIC_PHONE_DIGITS;
const WHATSAPP_TEXT = 'Hi,%20I%20would%20like%20to%20book%20a%20skin%20consultation%20at%20Lumora';

window.dataLayer = window.dataLayer || [];

/* ---------- GTM: loaded immediately — this is the conversion page ---------- */

function loadGTM() {
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_CONTAINER_ID;
  document.head.appendChild(s);
}

function track(payload) {
  window.dataLayer.push(payload);
}

/* ---------- Conversion event ----------
   The lead payload is read and *removed* in one go, so a refresh, a back/
   forward return, or a direct visit to this URL never double-fires the
   conversion. Events pushed before the container arrives queue in the
   dataLayer array and replay when it loads. */

function fireLeadEvent() {
  let lead = null;
  try {
    const raw = sessionStorage.getItem(LEAD_STORAGE_KEY);
    if (raw) {
      sessionStorage.removeItem(LEAD_STORAGE_KEY);
      lead = JSON.parse(raw);
    }
  } catch (e) {
    /* storage unavailable or unparsable — page still works, no event */
  }
  if (!lead) return;

  const payload = {
    event: 'lead_submit',
    concern: lead.concern,
    duration: lead.duration,
    form_location: lead.form_location,
    preferred_doctor: lead.preferred_doctor
  };
  if (lead.offer) payload.offer = lead.offer;
  // lead_id ties the GA4 conversion, the Google Ads conversion and the
  // sheet row together — it is the backend's LUM-… id.
  if (lead.lead_id) payload.lead_id = lead.lead_id;
  track(payload);

  if (lead.name) {
    document.querySelectorAll('[data-lead-name]').forEach(function (el) {
      el.textContent = ', ' + lead.name.split(/\s+/)[0];
    });
  }
}

/* ---------- Phone & WhatsApp injection (mirrors js/script.js) ---------- */

function formatPhoneDisplay(digits) {
  const local = digits.replace(/^91/, '');
  if (local.length === 10) return '(+91) ' + local.slice(0, 5) + ' ' + local.slice(5);
  return '+' + digits;
}

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

/* ---------- Call / WhatsApp click tracking ---------- */

function initClickTracking() {
  document.addEventListener('click', function (event) {
    const el = event.target.closest('[data-track]');
    if (!el) return;
    track({ event: el.dataset.track });
  });
}

/* ---------- Logo fallback: typographic wordmark if the image is absent ---------- */

function initImageFallbacks() {
  document.querySelectorAll('#logo-img, #footer-logo-img').forEach(function (img) {
    img.addEventListener('error', function () {
      img.hidden = true;
      const wordmark = img.parentElement.querySelector('.footer-wordmark, .logo-wordmark');
      if (wordmark) wordmark.hidden = false;
    });
    if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event('error'));
  });
}

/* ---------- Boot ---------- */

document.addEventListener('DOMContentLoaded', function () {
  loadGTM();
  fireLeadEvent();
  injectContactDetails();
  initClickTracking();
  initImageFallbacks();
});
