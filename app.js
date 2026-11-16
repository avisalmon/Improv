// Improvise: piano improvisation trainer. Plain JS + Web Audio with recorded samples.
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

  // ---------- Sampled instruments ----------
  const PC = { C: 0, Db: 1, D: 2, Ds: 3, Eb: 3, E: 4, F: 5, Fs: 6, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
  const grid = (names, octaves, extra = []) =>
    octaves.flatMap((o) => names.map((n) => n + o)).concat(extra);
  const INSTR = {
    piano:   { label: 'Grand piano',    dir: 'piano',   notes: grid(['C', 'Ds', 'Fs', 'A'], [1, 2, 3, 4, 5, 6, 7], ['C8']), release: 0.35 },
    epiano:  { label: 'Electric piano', dir: 'epiano',  notes: grid(['C', 'Eb', 'Gb', 'A'], [2, 3, 4, 5]), release: 0.3 },
    strings: { label: 'Strings',        dir: 'strings', notes: grid(['C', 'Eb', 'Gb', 'A'], [2, 3, 4, 5]), release: 0.7, attack: 0.15, pad: true },
    organ:   { label: 'Organ',          dir: 'organ',   notes: grid(['C', 'Eb', 'Gb', 'A'], [2, 3, 4, 5]), release: 0.12, pad: true },
    upright: { label: 'Upright bass',   dir: 'upright', notes: grid(['C', 'Eb', 'Gb', 'A'], [1, 2, 3], ['C4']), release: 0.15 },
    ebass:   { label: 'Electric bass',  dir: 'ebass',   notes: grid(['C', 'Eb', 'Gb', 'A'], [1, 2, 3], ['C4']), release: 0.1 },
  };
  const CHORD_INSTR = ['piano', 'epiano', 'strings', 'organ'];
  const BASS_INSTR = ['upright', 'ebass'];
  const DRUM_PATTERNS = { groove: 'Groove', light: 'Light (hats)', swing: 'Swing (hats)', off: 'Off' };
  const noteToMidi = (n) => { const m = n.match(/^([A-G][sb]?)(\d)$/); return 12 * (+m[2] + 1) + PC[m[1]]; };

  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const buffers = {};   // instrument -> [{midi, buf}]
  const loading = {};
  let drumBufs = null;

  async function fetchBuf(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    const ab = await r.arrayBuffer();
    return await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
  }
  function loadInstrument(name) {
    if (loading[name]) return loading[name];
    const ins = INSTR[name];
    loading[name] = Promise.all(ins.notes.map(async (n) => {
      const buf = await fetchBuf(`samples/${ins.dir}/${n}.mp3`);
      tick();
      return { midi: noteToMidi(n), buf };
    })).then((list) => { buffers[name] = list.sort((a, b) => a.midi - b.midi); return list; });
    return loading[name];
  }
  function loadDrums() {
    return Promise.all(['kick', 'snare', 'hihat'].map((n) => fetchBuf(`samples/drums/${n}.mp3`).then((b) => { tick(); return [n, b]; })))
      .then((l) => { drumBufs = Object.fromEntries(l); });
  }
  let loaded = 0, total = 0;
  function tick() { loaded++; if (!ready) ui.play.textContent = `Loading sounds… ${Math.round(100 * loaded / total)}%`; }

  // ---------- Mixer graph ----------
  const master = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14; compressor.ratio.value = 3;
  master.connect(compressor); compressor.connect(ctx.destination);
  const reverb = ctx.createConvolver();
  const reverbGain = ctx.createGain();
  reverb.connect(reverbGain); reverbGain.connect(master);
  reverb.buffer = (() => { // synthetic hall impulse response
    const len = ctx.sampleRate * 2.4, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return b;
  })();
  const CHANNELS = [
    { id: 'piano',  label: 'Your piano', vol: 0.85, send: 0.35 },
    { id: 'chords', label: 'Chords',     vol: 0.55, send: 0.45 },
    { id: 'bass',   label: 'Bass',       vol: 0.75, send: 0.1 },
    { id: 'drums',  label: 'Drums',      vol: 0.55, send: 0.15 },
    { id: 'reverb', label: 'Reverb',     vol: 0.5 },
    { id: 'master', label: 'Master',     vol: 0.85 },
  ];
  const bus = {};
  CHANNELS.forEach((c) => {
    if (c.id === 'reverb') { bus.reverb = reverbGain; return; }
    if (c.id === 'master') { bus.master = master; return; }
    const g = ctx.createGain(); g.connect(master);
    const s = ctx.createGain(); s.gain.value = c.send; g.connect(s); s.connect(reverb);
    bus[c.id] = g;
  });

  const settings = { chordInstr: 'piano', bassInstr: 'upright', drums: 'groove', mix: {} };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('improv-settings') || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem('improv-settings', JSON.stringify(settings)); } catch (e) {} };
  const curve = (v) => v * v * 1.6; // perceptual slider → gain
  function applyMix(id) {
    const m = settings.mix[id];
    bus[id].gain.setTargetAtTime(m.mute ? 0 : curve(m.vol), ctx.currentTime, 0.02);
  }

  // Play one sampled note. Returns a handle for release.
  function playSample(instr, midi, time, vel, dest, dur) {
    const list = buffers[instr]; if (!list) return null;
    let best = list[0];
    for (const s of list) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
    const ins = INSTR[instr];
    const src = ctx.createBufferSource();
    src.buffer = best.buf;
    src.playbackRate.value = Math.pow(2, (midi - best.midi) / 12);
    const g = ctx.createGain();
    const atk = ins.attack || 0.004;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vel, time + atk);
    src.connect(g); g.connect(dest);
    src.start(time);
    const h = { src, g, rel: ins.release };
    if (dur != null) release(h, time + dur);
    return h;
  }
  function release(h, time) {
    const t = Math.max(time, ctx.currentTime);
    h.g.gain.cancelScheduledValues(t);
    h.g.gain.setTargetAtTime(0, t, h.rel / 4);
    h.src.stop(t + h.rel * 2 + 0.05);
  }
  function drum(name, time, vel) {
    if (!drumBufs) return;
    const s = ctx.createBufferSource(); s.buffer = drumBufs[name];
    const g = ctx.createGain(); g.gain.value = vel;
    s.connect(g); g.connect(bus.drums); s.start(time);
  }

  const BEATS = 4;
  const LOW = 48, HIGH = 84; // C3..C6 on screen

  const $ = (id) => document.getElementById(id);
  const ui = {
    key: $('key'), prog: $('prog'), scale: $('scale'), bpm: $('bpm'), bpmOut: $('bpmOut'),
    play: $('play'), names: $('names'), mixer: $('mixer'),
    now: $('chordNow'), next: $('chordNext'), beats: $('beats'),
    kb: $('keyboard'), tip: $('tip'), progline: $('progline'),
  };

  const state = { key: 0, prog: 'pop', scale: 'majpent', bpm: 90, playing: false, chordIdx: 0 };

  // ---------- UI setup ----------
  KEY_NAMES.forEach((n, i) => ui.key.add(new Option(n, i)));
  Object.entries(PROGS).forEach(([k, p]) => ui.prog.add(new Option(p.name, k)));
  Object.entries(SCALES).forEach(([k, s]) => ui.scale.add(new Option(s.name, k)));
  for (let i = 0; i < BEATS; i++) ui.beats.appendChild(document.createElement('i'));

  function buildMixer() {
    const extra = {
      chords: ['chordInstr', CHORD_INSTR.map((k) => [k, INSTR[k].label])],
      bass: ['bassInstr', BASS_INSTR.map((k) => [k, INSTR[k].label])],
      drums: ['drums', Object.entries(DRUM_PATTERNS)],
    };
    CHANNELS.forEach((c) => {
      const m = settings.mix[c.id] = Object.assign({ vol: c.vol, mute: false }, settings.mix[c.id]);
      const row = document.createElement('div');
      row.className = 'ch' + (c.id === 'master' ? ' master' : '');
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = c.label;
      if (extra[c.id]) {
        const [key, opts] = extra[c.id];
        const sel = document.createElement('select');
        opts.forEach(([v, l]) => sel.add(new Option(l, v)));
        sel.value = settings[key];
        sel.onchange = () => {
          settings[key] = sel.value; save();
          if (INSTR[sel.value]) loadInstrument(sel.value);
        };
        nm.appendChild(sel);
      }
      const sl = document.createElement('input');
      sl.type = 'range'; sl.min = 0; sl.max = 100; sl.value = Math.round(m.vol * 100);
      sl.setAttribute('aria-label', c.label + ' volume');
      sl.oninput = () => { m.vol = sl.value / 100; applyMix(c.id); save(); };
      const mute = document.createElement('button');
      mute.className = 'mute'; mute.textContent = 'M'; mute.title = 'Mute';
      const sync = () => { mute.classList.toggle('on', m.mute); row.classList.toggle('muted', m.mute); };
      mute.onclick = () => { m.mute = !m.mute; sync(); applyMix(c.id); save(); };
      sync();
      row.append(nm, sl, mute);
      ui.mixer.appendChild(row);
      applyMix(c.id);
    });
  }
  buildMixer();

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

  function unlock() { if (ctx.state !== 'running') ctx.resume(); }

  // ---------- Your piano ----------
  const active = {};
  function noteOn(m, vel = 0.8) {
    unlock();
    if (active[m]) release(active[m], ctx.currentTime);
    const h = playSample('piano', m, ctx.currentTime, vel, bus.piano);
    if (h) active[m] = h;
    keyEls[m] && keyEls[m].classList.add('down');
  }
  function noteOff(m) {
    const h = active[m];
    if (h) { release(h, ctx.currentTime); delete active[m]; }
    keyEls[m] && keyEls[m].classList.remove('down');
  }

  // ---------- Backing scheduler ----------
  let beat = 0, nextTime = 0, timer = null;
  const visQueue = [];
  function voicing(c) {
    const root = 48 + ((state.key + c[0]) % 12);
    return QUAL[c[1]].iv.map((i) => { let m = root + i; if (m < 52) m += 12; return m; });
  }
  function comp(c, b, t, spb) {
    const ins = settings.chordInstr;
    const notes = voicing(c);
    if (INSTR[ins].pad) {
      if (b === 0) notes.forEach((m) => playSample(ins, m, t, 0.32, bus.chords, spb * BEATS - 0.02));
    } else if (b === 0 || b === 2) {
      notes.forEach((m, i) => playSample(ins, m, t + i * 0.008, b === 0 ? 0.42 : 0.32, bus.chords, spb * 1.7));
    }
  }
  function bassLine(c, b, t, spb) {
    const r = 33 + (((state.key + c[0]) % 12) - 9 + 12) % 12; // A1..G#2
    if (b === 0) playSample(settings.bassInstr, r, t, 0.9, bus.bass, spb * 1.8);
    if (b === 2) playSample(settings.bassInstr, r + 7, t, 0.8, bus.bass, spb * 1.8);
  }
  function drums(b, t, spb) {
    const p = settings.drums;
    if (p === 'off') return;
    if (p === 'swing') {
      drum('hihat', t, b % 2 ? 0.5 : 0.35);
      if (b % 2) drum('hihat', t + spb * 2 / 3, 0.25);
      if (b === 0) drum('kick', t, 0.35);
      return;
    }
    drum('hihat', t, b === 0 ? 0.55 : 0.4);
    drum('hihat', t + spb / 2, 0.25);
    if (p === 'light') { if (b === 0) drum('kick', t, 0.4); return; }
    if (b === 0 || b === 2) drum('kick', t, 0.9);
    if (b === 2) drum('kick', t + spb / 2, 0.5);
    if (b === 1 || b === 3) drum('snare', t, 0.7);
  }
  function schedule() {
    const spb = 60 / state.bpm;
    while (nextTime < ctx.currentTime + 0.15) {
      const p = PROGS[state.prog];
      const ci = Math.floor(beat / BEATS) % p.chords.length;
      const b = beat % BEATS;
      const c = p.chords[ci];
      comp(c, b, nextTime, spb);
      bassLine(c, b, nextTime, spb);
      drums(b, nextTime, spb);
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
    unlock();
    state.playing = true; beat = 0; state.chordIdx = 0; visQueue.length = 0;
    nextTime = ctx.currentTime + 0.1;
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

  // ---------- Input: touch / mouse (lower on the key = louder) ----------
  const pointerNote = {};
  function hit(x, y) {
    const el = document.elementFromPoint(x, y);
    const k = el && el.closest('.key');
    if (!k) return null;
    const r = k.getBoundingClientRect();
    return { m: +k.dataset.midi, vel: 0.35 + 0.65 * Math.min(1, Math.max(0, (y - r.top) / r.height)) };
  }
  ui.kb.addEventListener('pointerdown', (e) => {
    const h = hit(e.clientX, e.clientY); if (!h) return;
    e.preventDefault();
    pointerNote[e.pointerId] = h.m; noteOn(h.m, h.vel);
  });
  ui.kb.addEventListener('pointermove', (e) => {
    if (!(e.pointerId in pointerNote)) return;
    const h = hit(e.clientX, e.clientY);
    if (h && h.m !== pointerNote[e.pointerId]) {
      noteOff(pointerNote[e.pointerId]); pointerNote[e.pointerId] = h.m; noteOn(h.m, h.vel);
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
    const tag = e.target.tagName;
    if (tag === 'SELECT' || (tag === 'INPUT' && e.target.type !== 'checkbox')) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); if (ready) state.playing ? stop() : start(); return; }
    if (k === 'z') { octBase = Math.max(48, octBase - 12); return; }
    if (k === 'x') { octBase = Math.min(72, octBase + 12); return; }
    if (!(k in KEYMAP) || held[k] != null || e.repeat) return;
    const m = octBase + KEYMAP[k]; held[k] = m; noteOn(m, 0.8);
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (held[k] != null) { noteOff(held[k]); delete held[k]; }
  });

  // ---------- Init ----------
  if (innerWidth < 700) $('mixerBox').open = false; // keep the keyboard close on phones
  let ready = false;
  ui.prog.value = state.prog; ui.scale.value = state.scale; ui.key.value = state.key;
  fullRender();
  requestAnimationFrame(() => {
    const mc = keyEls[60]; if (mc) ui.kb.parentElement.scrollLeft = mc.offsetLeft - 20;
  });
  const first = ['piano', settings.chordInstr, settings.bassInstr].filter((v, i, a) => a.indexOf(v) === i);
  total = first.reduce((n, k) => n + INSTR[k].notes.length, 0) + 3;
  Promise.all([...first.map(loadInstrument), loadDrums()])
    .then(() => {
      ready = true; ui.play.disabled = false; ui.play.textContent = '▶ Play backing';
      // warm up the other instruments in the background
      [...CHORD_INSTR, ...BASS_INSTR].forEach((k) => setTimeout(() => loadInstrument(k), 500));
    })
    .catch((err) => { ui.play.textContent = 'Could not load sounds'; console.error(err); });
})();
