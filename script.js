/* ==================================================================
   Bar zone glitch system — v3 (fixed-size holographic bars + red
   lines, per-slot "piano key" hover, tunable speed/randomness)
   ------------------------------------------------------------------
   The top strip is divided into 13 fixed, non-overlapping "slots".
   Every slot holds one "shape" — either a holographic bar (10 of
   them) or a solid-red hairline (3 of them). A shape never moves
   freely in pixel-space, it only ever swaps places with another
   shape, so two shapes can mathematically never occupy the same
   space at the same time.

   Each shape's size is randomized ONCE on page load and then locked
   — swapping/glitching never reshapes a bar or line again, it only
   moves it to a different slot and (for bars) re-tints its color.
   Color palette stays inside the HEAT poster scheme (black/gray +
   cold night-blue for the bars); only the hairlines are ever red.

   Hover ("piano" mode): moving the pointer anywhere over a slot's
   column — not just directly over the (often narrower) shape inside
   it — immediately hides every other shape completely, instantly,
   like releasing every other piano key, while the hovered shape
   keeps glitching in place. Moving off the zone brings everyone
   back. No click/drag involved, pointer position alone drives it.
   ================================================================== */

(() => {
  // ---- SIMPLE TUNING PARAMETERS ----------------------------------
  // Turn these two numbers up or down to change the whole feel of
  // the glitch. Nothing else in this file needs to change.
  //   GLITCH_SPEED       — 1 = baseline pace; higher = snappier
  //                         transitions, faster flicker/re-glitch.
  //   GLITCH_RANDOMNESS   — 1 = baseline pace; higher = shapes swap
  //                         places more often (shorter random pause
  //                         between swaps).
  const GLITCH_SPEED = 3;
  const GLITCH_RANDOMNESS = 8;

  // Base pace this multiplies against — do not need to touch these.
  const BASE_GLITCH_SPEED_S = 0.75;
  const BASE_PAUSE_MIN_MS = 450;
  const BASE_PAUSE_MAX_MS = 1100;

  document.documentElement.style.setProperty(
    '--glitch-speed',
    (BASE_GLITCH_SPEED_S / GLITCH_SPEED) + 's'
  );

  // Tint palette for the holographic bars — the HEAT poster's black/
  // gray range plus the film's cold night-blue grade. No neon, no
  // red — red stays reserved for the hairlines only.
  const BAR_TINTS = [
    '10, 10, 10',
    '28, 28, 28',
    '51, 51, 51',
    '77, 77, 77',
    '112, 112, 112',
    '143, 143, 143',
    '173, 173, 173',
    '13, 27, 46',
    '22, 41, 74',
    '31, 58, 99',
    '44, 82, 130',
    '61, 110, 165',
    '107, 147, 189',
    '147, 179, 211'
  ];

  const BAR_MIN_HEIGHT_PCT = 20;
  const BAR_MAX_HEIGHT_PCT = 96;
  const BAR_MIN_WIDTH_PCT = 35;
  const BAR_MAX_WIDTH_PCT = 92;

  const LINE_MIN_HEIGHT_PCT = 68;
  const LINE_MAX_HEIGHT_PCT = 96;

  const SOLO_TICK_MS = 220 / GLITCH_SPEED;   // how often the hovered shape re-glitches on its own
  const SWAP_FADE_MS = 200 / GLITCH_SPEED;   // fade-out before a swap relocates the DOM nodes
  const SWAP_SETTLE_MS = 420 / GLITCH_SPEED; // flicker-in duration after a swap

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const barZone = document.getElementById('barZone');
  const shapeEls = Array.from(document.querySelectorAll('.shape'));

  const slotEls = {};
  document.querySelectorAll('.slot').forEach(el => {
    slotEls[el.dataset.slot] = el;
  });

  const state = shapeEls.map(el => ({
    id: Number(el.dataset.shape),
    el,
    type: el.classList.contains('line') ? 'line' : 'bar',
    slot: Number(el.parentElement.dataset.slot),
    timer: null,
    moving: false,
    frozen: false,
    soloInterval: null
  }));

  const byId = {};
  state.forEach(s => { byId[s.id] = s; });

  let hoveredId = null;

  function randPct(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randTint() {
    return BAR_TINTS[Math.floor(Math.random() * BAR_TINTS.length)];
  }

  function randDelay() {
    return randPct(BASE_PAUSE_MIN_MS / GLITCH_RANDOMNESS, BASE_PAUSE_MAX_MS / GLITCH_RANDOMNESS);
  }

  // Sets a shape's size ONCE, on load. This is the only place height/
  // width ever get assigned — swapping and glitching after this point
  // never reshapes a bar or line again, only moves/re-tints it.
  function seedLook(shape) {
    if (shape.type === 'bar') {
      shape.el.style.height = randPct(BAR_MIN_HEIGHT_PCT, BAR_MAX_HEIGHT_PCT) + '%';
      shape.el.style.width = randPct(BAR_MIN_WIDTH_PCT, BAR_MAX_WIDTH_PCT) + '%';
      shape.el.style.setProperty('--bar-tint-rgb', randTint());
    } else {
      shape.el.style.height = randPct(LINE_MIN_HEIGHT_PCT, LINE_MAX_HEIGHT_PCT) + '%';
    }
  }

  // Re-glitches a shape's LOOK during a swap or a solo hover tick —
  // color only for bars, nothing for lines (they're a flat, fixed
  // red hairline). Size/shape is locked in by seedLook() and never
  // touched again.
  function reglitchLook(shape) {
    if (shape.type === 'bar') {
      shape.el.style.setProperty('--bar-tint-rgb', randTint());
    }
  }

  function scheduleShape(shape) {
    clearTimeout(shape.timer);
    if (shape.frozen) return;
    shape.timer = setTimeout(() => attemptSwap(shape), randDelay());
  }

  function attemptSwap(shape) {
    if (shape.frozen) return;
    if (shape.moving) {
      scheduleShape(shape);
      return;
    }
    const candidates = state.filter(s => s.id !== shape.id && !s.moving && !s.frozen);
    if (candidates.length === 0) {
      scheduleShape(shape);
      return;
    }
    const partner = candidates[Math.floor(Math.random() * candidates.length)];

    shape.moving = true;
    partner.moving = true;

    shape.el.classList.add('glitch-out');
    partner.el.classList.add('glitch-out');

    setTimeout(() => {
      // If either shape got hovered/frozen mid-flight, bail out cleanly
      // instead of relocating it — freezing always wins over a swap.
      if (shape.frozen || partner.frozen) {
        shape.el.classList.remove('glitch-out');
        partner.el.classList.remove('glitch-out');
        shape.moving = false;
        partner.moving = false;
        scheduleShape(shape);
        scheduleShape(partner);
        return;
      }

      const slotA = shape.slot;
      const slotB = partner.slot;

      slotEls[slotA].appendChild(partner.el);
      slotEls[slotB].appendChild(shape.el);

      shape.slot = slotB;
      partner.slot = slotA;

      [shape, partner].forEach(s => {
        reglitchLook(s);
        s.el.classList.remove('glitch-out');
        s.el.classList.add('glitch-flicker');
      });

      setTimeout(() => {
        shape.el.classList.remove('glitch-flicker');
        partner.el.classList.remove('glitch-flicker');
        shape.moving = false;
        partner.moving = false;
        scheduleShape(shape);
        scheduleShape(partner);
      }, SWAP_SETTLE_MS);
    }, SWAP_FADE_MS);
  }

  // ---- Solo glitch loop for whichever shape is currently hovered ----
  // Keeps that one shape continuously re-glitching in place (no
  // partner needed) for as long as the pointer stays over its slot.
  function startSolo(shape) {
    stopSolo(shape);
    if (reduceMotion) {
      reglitchLook(shape);
      return;
    }
    shape.soloInterval = setInterval(() => {
      reglitchLook(shape);
      shape.el.classList.remove('glitch-flicker');
      void shape.el.offsetWidth; // force reflow so the flicker animation restarts
      shape.el.classList.add('glitch-flicker');
    }, SOLO_TICK_MS);
  }

  function stopSolo(shape) {
    if (shape.soloInterval) {
      clearInterval(shape.soloInterval);
      shape.soloInterval = null;
    }
  }

  // Freezing now means fully hiding — every other shape disappears
  // completely (opacity: 0 via .frozen in style.css) the instant one
  // slot is hovered, like releasing every other key on a piano.
  function freezeAllExcept(activeId) {
    state.forEach(s => {
      if (s.id === activeId) return;
      s.frozen = true;
      clearTimeout(s.timer);
      s.el.classList.remove('glitch-out', 'glitch-flicker');
      s.el.classList.add('frozen');
    });
  }

  function unfreezeAll() {
    state.forEach(s => {
      s.frozen = false;
      s.el.classList.remove('frozen');
      scheduleShape(s);
    });
  }

  function clearHover() {
    if (hoveredId === null) return;
    const prev = byId[hoveredId];
    stopSolo(prev);
    prev.el.classList.remove('active-solo');
    hoveredId = null;
    unfreezeAll();
  }

  function setHover(shapeEl) {
    const id = Number(shapeEl.dataset.shape);
    if (id === hoveredId) return;

    if (hoveredId !== null) {
      const prev = byId[hoveredId];
      stopSolo(prev);
      prev.el.classList.remove('active-solo');
    }

    hoveredId = id;
    const active = byId[id];
    active.el.classList.add('active-solo');
    freezeAllExcept(id);
    startSolo(active);
  }

  // Hovering ANYWHERE inside a slot's column — not just directly over
  // the (often narrower) shape drawn inside it — activates that
  // slot's shape, the same way pressing anywhere on a piano key
  // sounds that key regardless of exactly where your finger lands.
  function handlePointerMove(e) {
    const slotEl = e.target.closest && e.target.closest('.slot');
    if (slotEl) {
      const shapeEl = slotEl.querySelector('.shape');
      if (shapeEl) setHover(shapeEl);
    } else {
      clearHover();
    }
  }

  // Pointer-driven only — deliberately no drag/click handling, just
  // gliding the cursor across the zone activates whichever slot is
  // directly underneath it.
  barZone.addEventListener('pointermove', handlePointerMove);
  barZone.addEventListener('pointerleave', clearHover);

  // seed each shape's fixed size/tint once, then start the ambient
  // swap loop
  state.forEach(s => {
    seedLook(s);
    scheduleShape(s);
  });
})();
