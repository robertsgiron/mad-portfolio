/* ==================================================================
   Bar zone glitch system — v4 (fixed-size holographic bars + red
   lines with mouse-driven movement, per-slot "piano key" hover,
   tunable speed/randomness)
   ------------------------------------------------------------------
   The top strip is divided into 13 fixed, non-overlapping "slots".
   10 slots hold holographic bars, which keep swapping places at
   random on a timer (the original "glitch" behavior). The other 3
   slots hold red hairlines, which no longer swap or glitch — instead
   they jitter randomly along the x-axis while the user's mouse is
   moving, and freeze in whatever position they're in the instant the
   mouse stops moving.

   Each shape's size is randomized ONCE on page load and then locked
   — swapping/glitching never reshapes a bar or line again. Color
   palette stays inside the HEAT poster scheme (black/gray + cold
   night-blue for the bars); only the hairlines are ever red.

   Hover ("piano" mode): moving the pointer anywhere over a slot's
   column — not just directly over the (often narrower) shape inside
   it — immediately hides every other shape completely, instantly,
   like releasing every other piano key, while the hovered shape
   keeps glitching (bars) or stays in its current spot (lines).
   Moving off the zone brings everyone back.
   ================================================================== */

(() => {
  // ---- SIMPLE TUNING PARAMETERS ----------------------------------
  const GLITCH_SPEED = 3;
  const GLITCH_RANDOMNESS = 8;

  const BASE_GLITCH_SPEED_S = 0.75;
  const BASE_PAUSE_MIN_MS = 450;
  const BASE_PAUSE_MAX_MS = 1100;

  document.documentElement.style.setProperty(
    '--glitch-speed',
    (BASE_GLITCH_SPEED_S / GLITCH_SPEED) + 's'
  );

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

  // ---- Mouse-driven line movement ---------------------------------
  // While the mouse is moving anywhere on the page, each red line
  // randomly jitters along the x-axis. The instant the mouse stops
  // moving, every line freezes exactly where it is.
  const LINE_MOVE_RANGE_PX = 42;   // how far a line can drift from its slot center
  const LINE_JITTER_MS = 90;       // how often a moving line picks a new random x
  const LINE_STOP_DELAY_MS = 140;  // how long the mouse must sit still to count as "stopped"

  const SOLO_TICK_MS = 220 / GLITCH_SPEED;
  const SWAP_FADE_MS = 200 / GLITCH_SPEED;
  const SWAP_SETTLE_MS = 420 / GLITCH_SPEED;

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

  const lineShapes = state.filter(s => s.type === 'line');

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

  function seedLook(shape) {
    if (shape.type === 'bar') {
      shape.el.style.height = randPct(BAR_MIN_HEIGHT_PCT, BAR_MAX_HEIGHT_PCT) + '%';
      shape.el.style.width = randPct(BAR_MIN_WIDTH_PCT, BAR_MAX_WIDTH_PCT) + '%';
      shape.el.style.setProperty('--bar-tint-rgb', randTint());
    } else {
      shape.el.style.height = randPct(LINE_MIN_HEIGHT_PCT, LINE_MAX_HEIGHT_PCT) + '%';
    }
  }

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
    // Bars only ever swap with other bars now — lines have their own
    // mouse-driven movement and never relocate to a different slot.
    const candidates = state.filter(s => s.id !== shape.id && s.type === shape.type && !s.moving && !s.frozen);
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

  function startSolo(shape) {
    stopSolo(shape);
    if (shape.type !== 'bar') return; // lines have nothing to re-glitch
    if (reduceMotion) {
      reglitchLook(shape);
      return;
    }
    shape.soloInterval = setInterval(() => {
      reglitchLook(shape);
      shape.el.classList.remove('glitch-flicker');
      void shape.el.offsetWidth;
      shape.el.classList.add('glitch-flicker');
    }, SOLO_TICK_MS);
  }

  function stopSolo(shape) {
    if (shape.soloInterval) {
      clearInterval(shape.soloInterval);
      shape.soloInterval = null;
    }
  }

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
      if (s.type === 'bar') scheduleShape(s);
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

  function handlePointerMove(e) {
    const slotEl = e.target.closest && e.target.closest('.slot');
    if (slotEl) {
      const shapeEl = slotEl.querySelector('.shape');
      if (shapeEl) setHover(shapeEl);
    } else {
      clearHover();
    }
  }

  barZone.addEventListener('pointermove', handlePointerMove);
  barZone.addEventListener('pointerleave', clearHover);

  // ---- Line jitter: random x movement while the mouse moves, frozen
  // the instant it stops -------------------------------------------
  let lineJitterInterval = null;
  let lineStopTimer = null;

  function jitterLines() {
    lineShapes.forEach(line => {
      if (line.frozen) return; // hidden by hover-piano mode — leave it be
      const offset = (Math.random() * 2 - 1) * LINE_MOVE_RANGE_PX;
      line.el.style.transform = `translateX(${offset.toFixed(1)}px)`;
    });
  }

  function startLineJitter() {
    if (lineJitterInterval) return;
    jitterLines();
    lineJitterInterval = setInterval(jitterLines, LINE_JITTER_MS);
  }

  function stopLineJitter() {
    clearInterval(lineJitterInterval);
    lineJitterInterval = null;
    // Leaving each line's transform untouched here is what "freezes"
    // it in place once the mouse stops moving.
  }

  function handleMouseActivity() {
    if (reduceMotion || lineShapes.length === 0) return;
    startLineJitter();
    clearTimeout(lineStopTimer);
    lineStopTimer = setTimeout(stopLineJitter, LINE_STOP_DELAY_MS);
  }

  window.addEventListener('pointermove', handleMouseActivity);

  // seed each shape's fixed size/tint once; only bars join the
  // ambient swap loop — lines are driven by mouse movement instead.
  state.forEach(s => {
    seedLook(s);
    if (s.type === 'bar') scheduleShape(s);
  });
})();