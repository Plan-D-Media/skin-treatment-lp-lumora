/* ==========================================================================
   LUMORA — Skin Treatment LP · clinic photo slider (section 3)
   Vanilla JS, no dependencies. It never touches the enquiry form.

   - Autoplay every 4.5 s; off when prefers-reduced-motion is set.
   - Pauses on hover, on touch and while anything inside has keyboard focus,
     and while the slider is off screen or the tab is hidden.
   - Prev/next arrows, dot indicators, swipe, and Left/Right/Home/End keys.
   - With one slide there is nothing to rotate: controls stay hidden.
   ========================================================================== */

(function () {
  'use strict';

  const INTERVAL = 4500;
  const SWIPE_MIN = 40; // px of horizontal travel that counts as a swipe

  function initSlider(root) {
    const track = root.querySelector('.lmr-slides');
    const slides = Array.prototype.slice.call(root.querySelectorAll('.lmr-slide'));
    const total = slides.length;

    slides.forEach(function (slide, i) {
      slide.setAttribute('aria-label', (i + 1) + ' of ' + total);
    });
    if (total < 2) return; // a single photo: no arrows, no dots, no autoplay

    const controls = root.querySelector('.lmr-slider-controls');
    const prevBtn = root.querySelector('.lmr-slider-prev');
    const nextBtn = root.querySelector('.lmr-slider-next');
    const dotsWrap = root.querySelector('.lmr-slider-dots');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let index = 0;
    let timer = null;
    const paused = { hover: false, focus: false, touch: false, offscreen: false };

    const dots = slides.map(function (slide, i) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'lmr-slider-dot';
      dot.setAttribute('aria-label', 'Show photo ' + (i + 1) + ' of ' + total);
      dot.addEventListener('click', function () { goTo(i, true); });
      dotsWrap.appendChild(dot);
      return dot;
    });

    controls.hidden = false;
    root.classList.add('has-controls');

    function loadSlide(i) {
      const img = slides[i] && slides[i].querySelector('img[loading="lazy"]');
      if (img) img.loading = 'eager';
    }

    function render() {
      track.style.transform = 'translateX(' + (-index * 100) + '%)';
      slides.forEach(function (slide, i) {
        const current = i === index;
        slide.setAttribute('aria-hidden', current ? 'false' : 'true');
        slide.inert = !current;
      });
      dots.forEach(function (dot, i) {
        dot.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
      loadSlide((index + 1) % total); // the next photo is ready before it slides in
    }

    function goTo(i, byUser) {
      index = (i + total) % total;
      loadSlide(index);
      render();
      if (byUser) restart();
    }

    /* Autoplay */
    function canPlay() {
      return !reduceMotion.matches && !document.hidden &&
        !paused.hover && !paused.focus && !paused.touch && !paused.offscreen;
    }

    function stop() {
      clearInterval(timer);
      timer = null;
    }

    function restart() {
      stop();
      // aria-live is polite only while the slider is not rotating by itself
      track.setAttribute('aria-live', canPlay() ? 'off' : 'polite');
      if (canPlay()) timer = setInterval(function () { goTo(index + 1, false); }, INTERVAL);
    }

    function setPaused(reason, value) {
      paused[reason] = value;
      restart();
    }

    prevBtn.addEventListener('click', function () { goTo(index - 1, true); });
    nextBtn.addEventListener('click', function () { goTo(index + 1, true); });

    root.addEventListener('mouseenter', function () { setPaused('hover', true); });
    root.addEventListener('mouseleave', function () { setPaused('hover', false); });
    root.addEventListener('focusin', function () { setPaused('focus', true); });
    root.addEventListener('focusout', function (event) {
      if (!root.contains(event.relatedTarget)) setPaused('focus', false);
    });

    root.addEventListener('keydown', function (event) {
      let target = null;
      if (event.key === 'ArrowLeft') target = index - 1;
      else if (event.key === 'ArrowRight') target = index + 1;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = total - 1;
      if (target === null) return;
      event.preventDefault();
      goTo(target, true);
      // keep focus on a dot when the keys were used from the dots
      if (event.target.classList.contains('lmr-slider-dot')) dots[index].focus();
    });

    /* Swipe (touch). Vertical scrolling stays native through touch-action: pan-y. */
    let startX = 0;
    let startY = 0;
    let resumeTimer = null;
    const viewport = root.querySelector('.lmr-slider-viewport');

    viewport.addEventListener('touchstart', function (event) {
      clearTimeout(resumeTimer);
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      setPaused('touch', true);
    }, { passive: true });

    viewport.addEventListener('touchend', function (event) {
      const t = event.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
        goTo(index + (dx < 0 ? 1 : -1), true);
      }
      // resume a little after the finger lifts
      resumeTimer = setTimeout(function () { setPaused('touch', false); }, INTERVAL);
    }, { passive: true });

    /* Off screen or hidden tab: nothing rotates unseen */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        setPaused('offscreen', !entries[0].isIntersecting);
      }, { threshold: 0.25 }).observe(root);
    }
    document.addEventListener('visibilitychange', restart);
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', restart);

    render();
    restart();
  }

  document.querySelectorAll('[data-clinic-slider]').forEach(initSlider);
})();
