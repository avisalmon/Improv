// Improvise: piano improvisation trainer. Plain JS + Web Audio, no dependencies.
(() => {
  const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  const SCALES = {
    major:      { name: 'Major (Ionian)',   iv: [0, 2, 4, 5, 7, 9, 11],
      tip: 'Land on the <b>orange</b> chord tones on beat 1, and use the blue notes to walk between them. Holding the 3rd or 7th of a chord sounds sweet.' },
    majpent:    { name: 'Major pentatonic', iv: [0, 2, 4, 7, 9],
      tip: 'No note in this scale clashes. Play short repeated phrases, called <b>motifs</b>, and then vary their rhythm.' },
    minor:      { name: 'Natural minor (Aeolian)', iv: [0, 2, 3, 5, 7, 8, 10],
      tip: 'Leave space and let phrases breathe. Resolving the <b>b6</b> down to the 5th gives a strong minor sound.' },
    minpent:    { name: 'Minor pentatonic', iv: [0, 3, 5, 7, 10],
      tip: 'This is the rock and blues workhorse. Try call-and-response: play a short phrase, rest, then answer it.' },
    blues:      { name: 'Blues scale',      iv: [0, 3, 5, 6, 7, 10],
      tip: 'The <b>b5</b> is a passing "blue note". Slide through it to the 5th instead of resting on it.' },
    dorian:     { name: 'Dorian',           iv: [0, 2, 3, 5, 7, 9, 10],
      tip: 'The natural <b>6th</b> is what makes Dorian sound different from plain minor. Lean on it over the minor chord.' },
    mixolydian: { name: 'Mixolydian',       iv: [0, 2, 4, 5, 7, 9, 10],
      tip: 'This is a major sound with a <b>b7</b>, which fits dominant chords and funk vamps.' },
    harmminor:  { name: 'Harmonic minor',   iv: [0, 2, 3, 5, 7, 8, 11],
      tip: 'The jump from the b6 to the major 7th gives the "Spanish" sound. Resolve the 7th up to the root.' },
  };

  const QUAL = {
    maj: { iv: [0, 4, 7], sfx: '' },
    min: { iv: [0, 3, 7], sfx: 'm' },
    '7': { iv: [0, 4, 7, 10], sfx: '7' },
    m7: { iv: [0, 3, 7, 10], sfx: 'm7' },
    maj7: { iv: [0, 4, 7, 11], sfx: 'maj7' },
  };

  // chord = [semitones above key, quality]; every chord lasts one bar of 4 beats
  const PROGS = {
    pop:    { name: 'Pop  I–V–vi–IV', scale: 'majpent', key: 0,
      chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] },
    jazz:   { name: 'Jazz  ii–V–I', scale: 'major', key: 0,
      chords: [[2, 'm7'], [7, '7'], [0, 'maj7'], [0, 'maj7']] },
    blues:  { name: '12-bar blues', scale: 'blues', key: 9,
      chords: [[0, '7'], [0, '7'], [0, '7'], [0, '7'], [5, '7'], [5, '7'], [0, '7'], [0, '7'], [7, '7'], [5, '7'], [0, '7'], [7, '7']] },
    minor:  { name: 'Minor  i–VI–III–VII', scale: 'minor', key: 9,
      chords: [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']] },
    dorian: { name: 'Dorian vamp  i7–IV7', scale: 'dorian', key: 2,
      chords: [[0, 'm7'], [5, '7']] },
    andal:  { name: 'Andalusian  i–VII–VI–V', scale: 'harmminor', key: 4,
      chords: [[0, 'min'], [10, 'maj'], [8, 'maj'], [7, 'maj']] },
    funk:   { name: 'Funk vamp  I7', scale: 'mixolydian', key: 7,
      chords: [[0, '7']] },
  };

  const BEATS = 4;
  const LOW = 48, HIGH = 84; // C3..C6 on screen

  const $ = (id) => document.getElementById(id);
  const ui = {
    key: $('key'), prog: $('prog'), scale: $('scale'), bpm: $('bpm'), bpmOut: $('bpmOut'),
    play: $('play'), drums: $('drums'), bass: $('bass'), names: $('names'),
    now: $('chordNow'), next: $('chordNext'), beats: $('beats'),
    kb: $('keyboard'), tip: $('tip'), progline: $('progline'),
  };

  const state = { key: 0, prog: 'pop', scale: 'majpent', bpm: 90, playing: false, chordIdx: 0 };

  // ---------- UI setup ----------
  KEY_NAMES.forEach((n, i) => ui.key.add(new Option(n, i)));
  Object.entries(PROGS).forEach(([k, p]) => ui.prog.add(new Option(p.name, k)));
  Object.entries(SCALES).forEach(([k, s]) => ui.scale.add(new Option(s.name, k)));
  for (let i = 0; i < BEATS; i++) ui.beats.appendChild(document.createElement('i'));

  const keyEls = {};
  (function buildKeyboard() {
    const wk = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--wk'));
    let whiteIdx = 0;
    const blacks = [];
    for (let m = LOW; m <= HIGH; m++) {
      const pc = m % 12;
      const isBlack = [1, 3, 6, 8, 10].includes(pc);
      const el = document.createElement('div');
      el.className = 'key ' + (isBlack ? 'b' : 'w');
      el.dataset.midi = m;
      el.innerHTML = `<span class="dot"></span><span class="nm">${NOTE_NAMES[pc]}</span>`;
      if (isBlack) { blacks.push([el, whiteIdx]); }
      else { el.dataset.wi = whiteIdx++; }
      keyEls[m] = el;
      ui.kb.appendChild(el);
    }
    const layout = () => {
      const w = wk();
      Object.values(keyEls).forEach((el) => {
        if (el.classList.contains('w')) el.style.left = el.dataset.wi * w + 'px';
      });
      blacks.forEach(([el, wi]) => { el.style.left = (wi * w - w * 0.31) + 'px'; });
      ui.kb.style.width = whiteIdx * w + 'px';
    };
    layout();
    addEventListener('resize', layout);
  })();

  const chordName = (c) => KEY_NAMES[(state.key + c[0]) % 12] + QUAL[c[1]].sfx;
  const chordPCs = (c) => QUAL[c[1]].iv.map((i) => (state.key + c[0] + i) % 12);

  function renderProgline() {
    const p = PROGS[state.prog];
    ui.progline.innerHTML = p.chords.map((c, i) =>
      `<span class="${i === state.chordIdx ? 'cur' : ''}">${chordName(c)}</span>`).join('');
  }

  function renderHighlights() {
    const p = PROGS[state.prog];
    const c = p.chords[state.chordIdx % p.chords.length];
    const scalePCs = new Set(SCALES[state.scale].iv.map((i) => (state.key + i) % 12));
    const tones = new Set(chordPCs(c));
    for (const [m, el] of Object.entries(keyEls)) {
      const pc = m % 12;
      el.classList.toggle('scale', scalePCs.has(pc));
      el.classList.toggle('tone', tones.has(pc));
      el.classList.toggle('root', pc === state.key);
      el.classList.toggle('out', !scalePCs.has(pc) && !tones.has(pc));
    }
    ui.now.textContent = chordName(c);
    ui.next.textContent = chordName(p.chords[(state.chordIdx + 1) % p.chords.length]);
    ui.progline.querySelectorAll('span').forEach((s, i) => s.classList.toggle('cur', i === state.chordIdx));
  }

  function renderTip() {
    ui.tip.innerHTML = `<b>${KEY_NAMES[state.key]} ${SCALES[state.scale].name}:</b> ${SCALES[state.scale].tip}`;
  }

  function fullRender() { renderProgline(); renderHighlights(); renderTip(); }

  ui.key.onchange = () => { state.key = +ui.key.value; fullRender(); };
  ui.scale.onchange = () => { state.scale = ui.scale.value; renderHighlights(); renderTip(); };
  ui.prog.onchange = () => {
    state.prog = ui.prog.value;
    const p = PROGS[state.prog];
    state.scale = p.scale; ui.scale.value = p.scale;
    state.key = p.key; ui.key.value = p.key;
    state.chordIdx = 0; beat = 0;
    fullRender();
  };
  ui.bpm.oninput = () => { state.bpm = +ui.bpm.value; ui.bpmOut.textContent = state.bpm; };
  ui.names.onchange = () => document.body.classList.toggle('shownames', ui.names.checked);

  // ---------- Audio ----------
  let ctx, master;
  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain(); master.gain.value = 0.8;
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Piano-ish voice for the player's notes
  const active = {};
  function noteOn(m) {
    const a = audio();
    if (active[m]) noteOff(m, true);
    const t = a.currentTime;
    const g = a.createGain();
    const f = a.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.min(9000, hz(m) * 8), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(600, hz(m) * 2), t + 1.2);
    const o1 = a.createOscillator(); o1.type = 'triangle'; o1.frequency.value = hz(m);
    const o2 = a.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz(m) * 2;
    const g2 = a.createGain(); g2.gain.value = 0.25;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(f); f.connect(master);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.02, t + 4);
    o1.start(t); o2.start(t);
    active[m] = { g, o: [o1, o2] };
    keyEls[m] && keyEls[m].classList.add('down');
  }
  function noteOff(m, fast) {
    const v = active[m]; if (!v) return;
    const t = ctx.currentTime;
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(v.g.gain.value, t);
    v.g.gain.exponentialRampToValueAtTime(0.0001, t + (fast ? 0.03 : 0.35));
    v.o.forEach((o) => o.stop(t + 0.4));
    delete active[m];
    keyEls[m] && keyEls[m].classList.remove('down');
  }

  // Backing sounds
  function pad(midis, t, dur) {
    midis.forEach((m) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.03);
      g.gain.setValueAtTime(0.06, t + dur - 0.08);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    });
  }
  function bassNote(m, t, dur) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = hz(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.05, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    o.connect(g); o2.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  let noiseBuf;
  function hat(t, accent) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.25 : 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + 0.1);
  }

  // ---------- Scheduler ----------
  let beat = 0, nextTime = 0, timer = null;
  const visQueue = [];
  function voicing(c) {
    const root = 48 + ((state.key + c[0]) % 12);
    return QUAL[c[1]].iv.map((i) => { let m = root + i; if (m < 52) m += 12; return m; });
  }
  function schedule() {
    const spb = 60 / state.bpm;
    while (nextTime < ctx.currentTime + 0.12) {
      const p = PROGS[state.prog];
      const ci = Math.floor(beat / BEATS) % p.chords.length;
      const b = beat % BEATS;
      const c = p.chords[ci];
      if (b === 0) pad(voicing(c), nextTime, spb * BEATS);
      if (ui.bass.checked && (b === 0 || b === 2)) {
        const r = 36 + ((state.key + c[0]) % 12);
        bassNote(b === 0 ? r : r + 7, nextTime, spb * 1.6);
      }
      if (ui.drums.checked) { hat(nextTime, b === 0); hat(nextTime + spb / 2, false); }
      visQueue.push({ t: nextTime, ci, b });
      nextTime += spb; beat++;
    }
  }
  function drawLoop() {
    if (!state.playing) return;
    while (visQueue.length && visQueue[0].t <= ctx.currentTime) {
      const v = visQueue.shift();
      [...ui.beats.children].forEach((d, i) => d.classList.toggle('on', i === v.b));
      if (v.ci !== state.chordIdx) { state.chordIdx = v.ci; renderHighlights(); }
    }
    requestAnimationFrame(drawLoop);
  }
  function start() {
    audio();
    state.playing = true; beat = 0; state.chordIdx = 0; visQueue.length = 0;
    nextTime = ctx.currentTime + 0.08;
    renderHighlights();
    timer = setInterval(schedule, 25); schedule();
    requestAnimationFrame(drawLoop);
    ui.play.textContent = '■ Stop'; ui.play.classList.add('on');
  }
  function stop() {
    state.playing = false; clearInterval(timer);
    [...ui.beats.children].forEach((d) => d.classList.remove('on'));
    ui.play.textContent = '▶ Play backing'; ui.play.classList.remove('on');
  }
  ui.play.onclick = () => (state.playing ? stop() : start());

  // ---------- Input: touch / mouse ----------
  const pointerNote = {};
  function midiAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const k = el && el.closest('.key');
    return k ? +k.dataset.midi : null;
  }
  ui.kb.addEventListener('pointerdown', (e) => {
    const m = midiAt(e.clientX, e.clientY); if (m == null) return;
    e.preventDefault();
    pointerNote[e.pointerId] = m; noteOn(m);
  });
  ui.kb.addEventListener('pointermove', (e) => {
    if (!(e.pointerId in pointerNote)) return;
    const m = midiAt(e.clientX, e.clientY);
    if (m != null && m !== pointerNote[e.pointerId]) {
      noteOff(pointerNote[e.pointerId]); pointerNote[e.pointerId] = m; noteOn(m);
    }
  });
  const up = (e) => {
    if (e.pointerId in pointerNote) { noteOff(pointerNote[e.pointerId]); delete pointerNote[e.pointerId]; }
  };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);

  // ---------- Input: computer keyboard ----------
  const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };
  let octBase = 60;
  const held = {};
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); state.playing ? stop() : start(); return; }
    if (k === 'z') { octBase = Math.max(48, octBase - 12); return; }
    if (k === 'x') { octBase = Math.min(72, octBase + 12); return; }
    if (!(k in KEYMAP) || held[k] != null || e.repeat) return;
    const m = octBase + KEYMAP[k]; held[k] = m; noteOn(m);
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (held[k] != null) { noteOff(held[k]); delete held[k]; }
  });

  // ---------- Init ----------
  ui.prog.value = state.prog; ui.scale.value = state.scale; ui.key.value = state.key;
  fullRender();
  // Scroll so middle C is in view on narrow screens
  requestAnimationFrame(() => {
    const mc = keyEls[60]; if (mc) ui.kb.parentElement.scrollLeft = mc.offsetLeft - 20;
  });
})();
