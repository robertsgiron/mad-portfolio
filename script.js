/* ==================================================================
   Bar zone glitch system — v5 (fixed-size holographic bars + red
   lines that roam freely across the whole strip, per-slot "piano
   key" hover, tunable speed/randomness)
   ------------------------------------------------------------------
  The top strip is divided into 22 fixed, non-overlapping "slots".
  18 slots hold holographic bars, which keep swapping places with
   each other at random on a timer (the original "glitch" behavior).
   Bars only ever trade among themselves, so they permanently occupy
  the same 18 slot columns — the other 4 slot columns are always
   bar-free space.

  The 4 red hairlines are pulled out of the slot grid entirely and
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
  const GLITCH_SPEED = 1;
  const GLITCH_RANDOMNESS = 2;

  const BASE_GLITCH_SPEED_S = 0.75;
  const BASE_PAUSE_MIN_MS = 450;
  const BASE_PAUSE_MAX_MS = 1100;

  document.documentElement.style.setProperty(
    '--glitch-speed',
    (BASE_GLITCH_SPEED_S / GLITCH_SPEED) + 's'
  );

    const BAR_TINTS = [
    { rgb: '10, 10, 10',    alpha: 0.55 }, // near-black
    { rgb: '28, 28, 28',    alpha: 0.5  },
    { rgb: '51, 51, 51',    alpha: 0.4  },
    { rgb: '77, 77, 77',    alpha: 0.32 },
    { rgb: '112, 112, 112', alpha: 0.26 },
    { rgb: '143, 143, 143', alpha: 0.22 },
    { rgb: '173, 173, 173', alpha: 0.2  },
    { rgb: '6, 10, 26',     alpha: 0.6  }, // deepest navy-black shadow
    { rgb: '18, 24, 48',    alpha: 0.54 },
    { rgb: '34, 40, 66',    alpha: 0.46 },
    { rgb: '58, 65, 94',    alpha: 0.36 },
    { rgb: '86, 93, 124',   alpha: 0.28 }, // the poster's core mid-blue
    { rgb: '120, 127, 158', alpha: 0.24 },
    { rgb: '160, 167, 197', alpha: 0.2  },
    { rgb: '210, 216, 240', alpha: 0.16 }, // pale periwinkle, the lightest real blue in the image
    { rgb: '35, 38, 44',    alpha: 0.5  }, // gunmetal — the rifle steel
    { rgb: '24, 20, 18',    alpha: 0.58 }, // warm near-black — the suits
  ];

  const BAR_MIN_HEIGHT_PCT = 20;
  const BAR_MAX_HEIGHT_PCT = 96;
  const BAR_MIN_WIDTH_PCT = 35;
  const BAR_MAX_WIDTH_PCT = 92;

  const LINE_MIN_HEIGHT_PCT = 68;
  const LINE_MAX_HEIGHT_PCT = 96;

  // ---- Free-roaming line movement ---------------------------------
    const LINE_RETARGET_MIN_MS = 280;  // fastest a moving line can jump to a new spot
  const LINE_RETARGET_MAX_MS = 520;  // slowest a moving line can jump to a new spot
    const LINE_STOP_DELAY_MS = 180;   // stop changing position after the pointer rests
    const LINE_BAR_CLEARANCE_PX = 8;  // minimum gap kept between a line and any bar
    const LINE_LINE_CLEARANCE_PX = 18; // minimum gap kept between red lines
  const LINE_HALF_WIDTH_PX = 1;

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
      const tint = randTint();
      shape.el.style.setProperty('--bar-tint-rgb', tint.rgb);
      shape.el.style.setProperty('--bar-tint-alpha', tint.alpha);
    } else {
      shape.el.style.height = randPct(LINE_MIN_HEIGHT_PCT, LINE_MAX_HEIGHT_PCT) + '%';
    }
  }

  function reglitchLook(shape) {
    if (shape.type === 'bar') {
      const tint = randTint();
      shape.el.style.setProperty('--bar-tint-rgb', tint.rgb);
      shape.el.style.setProperty('--bar-tint-alpha', tint.alpha);
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
      s.el.classList.remove('frozen', 'glitch-out');
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
    active.frozen = false;
    active.el.classList.remove('frozen', 'glitch-out');
    active.el.classList.add('active-solo');
    freezeAllExcept(id);
    startSolo(active);
  }

  function getBarAtPoint(clientX, clientY) {
    return barShapes.find(bar => {
      const rect = bar.el.getBoundingClientRect();
      const hitMargin = 10;
      return clientX >= rect.left - hitMargin &&
        clientX <= rect.right + hitMargin &&
        clientY >= rect.top - hitMargin &&
        clientY <= rect.bottom + hitMargin;
    });
  }

  function handlePointerMove(e) {
    const zoneRect = barZone.getBoundingClientRect();
    if (e.clientY < zoneRect.top || e.clientY > zoneRect.bottom) {
      clearHover();
      return;
    }

    // Lines float freely now, so check for a direct hover on one first.
    const lineEl = e.target.closest && e.target.closest('.line');
    if (lineEl) {
      setHover(lineEl);
      return;
    }
    const bar = getBarAtPoint(e.clientX, e.clientY);
    if (bar) {
      setHover(bar.el);
    } else {
      clearHover();
    }
  }

  window.addEventListener('pointermove', handlePointerMove);
  barZone.addEventListener('pointerleave', clearHover);
  barZone.addEventListener('click', e => {
    const shapeEl = e.target.closest && e.target.closest('.bar');
    if (shapeEl) setHover(shapeEl);
  });

  // ---- Lines move among the dedicated bar-free slots while the mouse moves.
  function getEmptySlotCenters() {
    const zoneLeft = barsEl.getBoundingClientRect().left;
    return Array.from(document.querySelectorAll('.slot'))
      .filter(slot => !slot.querySelector('.bar'))
      .map(slot => {
        const rect = slot.getBoundingClientRect();
        return rect.left + rect.width / 2 - zoneLeft;
      });
  }

  function getBarRects() {
    const zoneLeft = barsEl.getBoundingClientRect().left;
    return barShapes
      .map(shape => {
        const rect = shape.el.getBoundingClientRect();
        return { left: rect.left - zoneLeft, right: rect.right - zoneLeft };
      })
      .sort((a, b) => a.left - b.left);
  }

  function shuffle(values) {
    for (let index = values.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    return values;
  }

  function selectSeparatedCenters(candidateCenters, barRects) {
    const safeCandidates = candidateCenters.filter(center =>
      barRects.every(rect =>
        center <= rect.left - LINE_BAR_CLEARANCE_PX - LINE_HALF_WIDTH_PX ||
        center >= rect.right + LINE_BAR_CLEARANCE_PX + LINE_HALF_WIDTH_PX
      )
    );

    for (let attempt = 0; attempt < 10; attempt++) {
      const selectedCenters = [];
      shuffle(safeCandidates.slice()).forEach(center => {
        if (selectedCenters.every(existing => Math.abs(center - existing) >= LINE_LINE_CLEARANCE_PX)) {
          selectedCenters.push(center);
        }
      });
      if (selectedCenters.length >= lineShapes.length) {
        return selectedCenters.slice(0, lineShapes.length);
      }
    }
    return [];
  }

  function retargetLines() {
    const barRects = getBarRects();
    const availableCenters = [];
    for (let index = 0; index < barRects.length - 1; index++) {
      const gapStart = barRects[index].right + LINE_BAR_CLEARANCE_PX + LINE_HALF_WIDTH_PX;
      const gapEnd = barRects[index + 1].left - LINE_BAR_CLEARANCE_PX - LINE_HALF_WIDTH_PX;
      if (gapEnd > gapStart) {
        availableCenters.push((gapStart + gapEnd) / 2);
      }
    }

    let centers = selectSeparatedCenters(availableCenters, barRects);
    if (centers.length < lineShapes.length) {
      centers = selectSeparatedCenters(getEmptySlotCenters(), barRects);
    }
    const previousCenters = lineShapes.map(line => line.el.style.left);
    if (centers.length === lineShapes.length && centers.every((center, index) => previousCenters[index] === center + 'px')) {
      const alternateCenters = selectSeparatedCenters(availableCenters, barRects);
      if (alternateCenters.length === lineShapes.length) {
        centers = alternateCenters;
      }
    }

    lineShapes.forEach((line, index) => {
      if (line.frozen || centers.length <= index) return;
      line.el.style.left = centers[index] + 'px';
    });
  }

  window.addEventListener('resize', retargetLines);

   let lineRetargetTimer = null;
  let lineStopTimer = null;
  let lineMovementActive = false;
  let lastPointerX = null;

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
  }

  function handleMouseActivity(e) {
    if (reduceMotion || lineShapes.length === 0) return;
    if (lastPointerX !== null && e.clientX === lastPointerX) return;
    lastPointerX = e.clientX;
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
  retargetLines();

  // only bars join the ambient swap loop — lines are mouse-driven
  barShapes.forEach(s => scheduleShape(s));
})();