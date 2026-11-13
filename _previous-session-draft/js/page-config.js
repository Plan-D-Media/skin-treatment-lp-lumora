/* ==========================================================================
   LUMORA — Page content configuration (rendered by js/ui.js)

   Everything below is display content only. Nothing here is read by the
   enquiry form or by js/script.js.

   IMPORTANT — wrapped in an IIFE on purpose. js/script.js declares many
   top-level consts (FORM_ENDPOINT, track, modal, formState …) in the shared
   global scope; a clashing top-level name in any other classic script would
   throw a SyntaxError and stop the lead mechanism from loading. Only
   window.LUMORA_CONFIG is exposed.

   SWITCHING INTENT
   1. Change ACTIVE_INTENT below.
   2. In index.html, inside <template id="enquiry-form-template">, swap the
      concern <option> set for the commented set directly beneath it.
   3. In index.html, update the static <title>, meta description and the
      hero H1 / subheading (they are duplicated in the HTML for first paint).
   ui.js logs a console warning if a treatment card points at a concern
   value that is missing from the form's dropdown.

   CONFIRMATION FLAGS
   offer, technology and clinicGallery render nothing — and their anchor-nav
   links stay hidden — until `confirmed` is set to true AND real content is
   supplied. FAQ items with `confirmed: false` are likewise hidden.
   ========================================================================== */

window.LUMORA_CONFIG = (function () {
  'use strict';

  const ACTIVE_INTENT = 'pigmentation'; // 'pigmentation' | 'acne'

  /* Shared FAQs. `answer` may be a function of the preset so cost/device
     answers can pick up confirmed offer and technology details. */
  function sharedFaqs(preset) {
    return [
      {
        q: 'Where is Lumora located?',
        a: 'Lumora is inside The Newtown Clinic, on the 4th floor of Axis Mall Block-C in New Town, Kolkata — CF/9, Axis Mall, Block-C, The Newtown Clinic, 4th Floor, Shop No. 401, Action Area-IC, New Town, Kolkata 700156. A map and a directions link are just below this section, and we will confirm directions when we call to book your slot.',
        confirmed: true
      },
      {
        // Hidden: walk-in policy not yet confirmed by the client.
        q: 'Do I need an appointment or can I walk in?',
        a: '',
        confirmed: false
      },
      {
        // Hidden: consultation fee not yet confirmed by the client.
        q: 'Is there a consultation fee?',
        a: '',
        confirmed: false
      },
      {
        q: 'How many sessions will my treatment need?',
        a: 'It depends on the condition and how your skin responds. At your consultation the dermatologist will tell you the expected number of sessions and the cost before anything begins, and your progress is reviewed as you go.',
        confirmed: true
      },
      {
        q: 'Will the treatment suit my skin type?',
        a: 'That is exactly what the consultation is for. A dermatologist examines your skin first and chooses a treatment that suits it, which is why every plan at Lumora begins with an in-person assessment rather than a package.',
        confirmed: true
      },
      {
        q: 'Is the treatment safe?',
        a: 'Every treatment at Lumora is performed by an MD dermatologist. Your suitability is assessed at your consultation, and the risks and aftercare are explained to you before any treatment begins.',
        confirmed: true
      },
      {
        // Shown only once preset.technology is confirmed.
        q: 'Which device is used?',
        a: function () {
          const devices = (preset.technology.devices || []).filter(function (d) { return d.name; });
          if (!devices.length) return '';
          return 'Your dermatologist chooses the device that suits your skin. ' + devices.map(function (d) {
            const makeModel = [d.make, d.model].filter(Boolean).join(' ');
            return d.name + (makeModel ? ' (' + makeModel + ')' : '') + (d.usedFor ? ', used for ' + d.usedFor : '');
          }).join('; ') + '.';
        },
        confirmed: function () { return preset.technology.confirmed === true; }
      },
      {
        q: 'What does it cost per session?',
        a: function () {
          let text = 'The cost depends on the plan your dermatologist recommends for your skin, and it is explained to you in full before any treatment begins.';
          if (preset.offer.confirmed === true && preset.offer.faqLine) text += ' ' + preset.offer.faqLine;
          return text;
        },
        confirmed: true
      }
    ];
  }

  /* Ten consulting dermatologists. The cards themselves are static HTML in
     index.html (their "Book with Dr." buttons carry the form pre-fill
     attributes). `performs` lists intent keys, e.g. ['pigmentation'].
     While every array is empty, all ten are shown. Once any doctor has a
     non-empty array, only doctors whose array includes ACTIVE_INTENT show. */
  const doctors = [
    { name: 'Dr. Nidhi Jindal', performs: [] },
    { name: 'Dr. Akanshya Tibrewal', performs: [] },
    { name: 'Dr. Rajendrani Mazumder', performs: [] },
    { name: 'Dr. Indrashis Podder', performs: [] },
    { name: 'Dr. Swarnali Maity', performs: [] },
    { name: 'Dr. Sonal Jain', performs: [] },
    { name: 'Dr. Dishari Halder', performs: [] },
    { name: 'Dr. Kaushiki Hazra Sarkar', performs: [] },
    { name: 'Dr. Dyuti Das', performs: [] },
    { name: 'Dr. Shayeri Banerjee', performs: [] }
  ];

  /* Placeholder shapes for unconfirmed blocks — fill in, then set confirmed. */
  function unconfirmedOffer() {
    return {
      confirmed: false,
      title: '',        // e.g. 'Pigmentation Consultation Offer'
      text: '',         // one sentence shown on the Pricing card
      terms: '',        // short terms line
      faqLine: ''       // sentence appended to the cost FAQ once confirmed
    };
  }

  function unconfirmedTechnology() {
    return {
      confirmed: false,
      // { name, make, model, usedFor, image: { src, alt, width, height } }
      devices: []
    };
  }

  function unconfirmedGallery() {
    return {
      confirmed: false,
      caption: 'Inside The Newtown Clinic, New Town',
      // each: [{ src, alt, width, height }] — three per tab suits the grid
      tabs: {
        procedure: { label: 'Procedure Rooms', images: [] },
        interiors: { label: 'Clinic Interiors', images: [] },
        hygiene: { label: 'Hygiene', images: [] }
      }
    };
  }

  /* --------------------------------------------------------------------
     PRESETS
     The H1 must be rewritten to mirror the final ad group's keyword and
     ad headline once the keyword → ad group → landing page mapping is
     signed off.
     Moles, warts, skin tags, tattoos, Hydrafacials, Medifacials and
     rejuvenation services must not appear on either preset.
     `concern` on each treatment must equal an <option value> in the form's
     concern dropdown for the same intent.
     -------------------------------------------------------------------- */
  const presets = {
    pigmentation: {
      title: 'Pigmentation Treatment in New Town, Kolkata | LUMORA Skin, Hair & Aesthetics Clinic',
      h1Light: 'Pigmentation Treatment in New Town',
      h1Bold: 'by MD Dermatologists',
      subheading: 'Dark spots, tan, melasma and uneven tone are assessed in person by an MD dermatologist before your treatment is chosen.',
      treatmentsHeading: 'Pigmentation Treatments at Lumora',
      treatmentsLead: 'Choose a treatment to request it, and your dermatologist will confirm the right plan at your consultation.',
      treatments: [
        { name: 'Skin Lightening Laser', concern: 'Dark spots and pigmentation', icon: 'laser', image: null },
        { name: 'Skin Lightening Chemical Peel', concern: 'Tan and sun damage', icon: 'peel', image: null },
        { name: 'Carbon Laser Peel', concern: 'Dull, uneven skin', icon: 'sparkle', image: null },
        { name: 'Melasma Treatment', concern: 'Melasma', icon: 'patch', image: null },
        { name: 'Dark Circles Treatment', concern: 'Dark circles', icon: 'eye', image: null }
      ],
      offer: unconfirmedOffer(),
      technology: unconfirmedTechnology(),
      clinicGallery: unconfirmedGallery()
    },

    acne: {
      title: 'Acne Treatment in New Town, Kolkata | LUMORA Skin, Hair & Aesthetics Clinic',
      h1Light: 'Acne Treatment in New Town',
      h1Bold: 'by MD Dermatologists',
      subheading: 'Active acne, marks and scars are assessed in person by an MD dermatologist before your treatment is chosen.',
      treatmentsHeading: 'Acne Treatments at Lumora',
      treatmentsLead: 'Choose a treatment to request it, and your dermatologist will confirm the right plan at your consultation.',
      treatments: [
        { name: 'Chemical Peels', concern: 'Acne and pimples', icon: 'peel', image: null },
        { name: 'GFC PRP', concern: 'Acne scars and marks', icon: 'drop', image: null },
        { name: 'Microneedling', concern: 'Acne scars and marks', icon: 'grid', image: null },
        { name: 'Subcision', concern: 'Acne scars and marks', icon: 'layers', image: null },
        { name: 'Intralesional Injections', concern: 'Acne and pimples', icon: 'target', image: null }
      ],
      offer: unconfirmedOffer(),
      technology: unconfirmedTechnology(),
      clinicGallery: unconfirmedGallery()
    }
  };

  Object.keys(presets).forEach(function (key) {
    presets[key].faqs = sharedFaqs(presets[key]);
  });

  return {
    activeIntent: ACTIVE_INTENT,
    presets: presets,
    doctors: doctors
  };
})();
