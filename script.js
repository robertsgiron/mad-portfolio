/* ==================================================================
   Bar zone glitch system — v5 (fixed-size holographic bars + red
   lines that roam freely across the whole strip, per-slot "piano
   key" hover, tunable speed/randomness)
   ------------------------------------------------------------------
   The top strip is divided into 13 fixed, non-overlapping "slots".
   10 slots hold holographic bars, which keep swapping places with
   each other at random on a timer (the original "glitch" behavior).
   Bars only ever trade among themselves, so they permanently occupy
   the same 10 slot columns — the other 3 slot columns are always
   bar-free space.

   The 3 red hairlines are pulled out of the slot grid entirely and
   float freely (position: absolute) across the full width of the
   strip. While the user's mouse is moving anywhere on the page, each
   line jumps to a fresh random x position every ~340ms — checked
   against every bar's actual current position so it never lands on
   top of one. The instant the mouse stops moving, the lines freeze
   exactly where they are.

   Each shape's size is randomized ONCE on page load and then locked.
   Color palette stays inside the HEAT poster scheme (black/gray +
   cold night-blue for the bars); only the hairlines are ever red.

   Hover ("piano" mode): moving the pointer anywhere over a bar's
   slot column, or directly over a line itself, immediately hides
   every other shape completely, like releasing every other piano
   key, while the hovered one stays visible. Moving off brings
   everyone back.
   ================================================================== */

(() => {
  // ---- SIMPLE TUNING PARAMETERS ----------------------------------
  const GLITCH_SPEED = 2;
  const GLITCH_RANDOMNESS = 4;

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

  // ---- Free-roaming line movement ---------------------------------
    const LINE_RETARGET_MIN_MS = 180;  // fastest a moving line can jump to a new spot
  const LINE_RETARGET_MAX_MS = 420;  // slowest a moving line can jump to a new spot
  const LINE_STOP_DELAY_MS = 140;   // how long the mouse must sit still to count as "stopped"
  const LINE_EDGE_MARGIN_PX = 10;   // keep lines a bit clear of the zone's outer edges
  const LINE_BAR_CLEARANCE_PX = 8;  // minimum gap kept between a line and any bar
  const LINE_LINE_CLEARANCE_PX = 18; // minimum gap kept between red lines

  const SOLO_TICK_MS = 220 / GLITCH_SPEED;
  const SWAP_FADE_MS = 200 / GLITCH_SPEED;
  const SWAP_SETTLE_MS = 420 / GLITCH_SPEED;

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const barZone = document.getElementById('barZone');
  const barsEl = document.getElementById('bars');
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
  const barShapes = state.filter(s => s.type === 'bar');

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
    // Bars only ever swap with other bars.
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
    if (shape.type !== 'bar') return;
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
    // Lines float freely now, so check for a direct hover on one first.
    const lineEl = e.target.closest && e.target.closest('.line');
    if (lineEl) {
      setHover(lineEl);
      return;
    }
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

  // ---- Free-roaming lines: jump to a new random x (clear of every
  // bar's current position) every tick while the mouse is moving,
  // freeze in place the instant it stops -----------------------------
  function getZoneWidth() {
    return barsEl.getBoundingClientRect().width;
  }

  function getBarRects() {
    const zoneLeft = barsEl.getBoundingClientRect().left;
    return barShapes.map(s => {
      const r = s.el.getBoundingClientRect();
      return { left: r.left - zoneLeft, right: r.right - zoneLeft };
    });
  }

  function pickFreeX(zoneWidth, barRects, lineXs) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = LINE_EDGE_MARGIN_PX + Math.random() * (zoneWidth - LINE_EDGE_MARGIN_PX * 2);
      const blocked = barRects.some(r => x > r.left - LINE_BAR_CLEARANCE_PX && x < r.right + LINE_BAR_CLEARANCE_PX);
      const tooCloseToLine = lineXs.some(lineX => Math.abs(x - lineX) < LINE_LINE_CLEARANCE_PX);
      if (!blocked && !tooCloseToLine) return x;
    }

    // Choose the best available point if random sampling misses a gap.
    // The line-to-line distance is scored first so red lines never stack.
    let bestX = LINE_EDGE_MARGIN_PX;
    let bestScore = -Infinity;
    for (let index = 0; index <= 100; index++) {
      const x = LINE_EDGE_MARGIN_PX + (index / 100) * (zoneWidth - LINE_EDGE_MARGIN_PX * 2);
      const nearestLine = lineXs.length
        ? Math.min(...lineXs.map(lineX => Math.abs(x - lineX)))
        : Infinity;
      const barPenalty = barRects.some(r => x > r.left - LINE_BAR_CLEARANCE_PX && x < r.right + LINE_BAR_CLEARANCE_PX)
        ? zoneWidth
        : 0;
      const score = nearestLine - barPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
      }
    }
    return bestX;
  }

  function retargetLines() {
    const zoneWidth = getZoneWidth();
    const barRects = getBarRects();
    const lineXs = [];
    lineShapes.forEach(line => {
      if (line.frozen) return;
      const x = pickFreeX(zoneWidth, barRects, lineXs);
      line.el.style.left = x + 'px';
      lineXs.push(x);
    });
  }

   let lineRetargetTimer = null;
  let lineStopTimer = null;
  let lineMovementActive = false;

  function scheduleNextRetarget() {
    const delay = LINE_RETARGET_MIN_MS + Math.random() * (LINE_RETARGET_MAX_MS - LINE_RETARGET_MIN_MS);
    lineRetargetTimer = setTimeout(() => {
      retargetLines();
      if (lineMovementActive) scheduleNextRetarget();
    }, delay);
  }

  function startLineMovement() {
    if (lineMovementActive) return;
    lineMovementActive = true;
    retargetLines();
    scheduleNextRetarget();
  }

  function stopLineMovement() {
    lineMovementActive = false;
    clearTimeout(lineRetargetTimer);
    lineRetargetTimer = null;
    // Leaving "left" untouched here is what freezes lines in place.
  }

  function handleMouseActivity() {
    if (reduceMotion || lineShapes.length === 0) return;
    startLineMovement();
    clearTimeout(lineStopTimer);
    lineStopTimer = setTimeout(stopLineMovement, LINE_STOP_DELAY_MS);
  }

  window.addEventListener('pointermove', handleMouseActivity);

  // seed each shape's fixed size/tint once
  state.forEach(s => seedLook(s));

  // pull the lines out of the slot grid so they can roam the full
  // width of the zone instead of being boxed into one slot column
  lineShapes.forEach(line => barsEl.appendChild(line.el));
  retargetLines(); // give them a valid starting spot, clear of every bar

  // only bars join the ambient swap loop — lines are mouse-driven
  barShapes.forEach(s => scheduleShape(s));
})();