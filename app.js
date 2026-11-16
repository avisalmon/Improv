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
  // ---------- Styles ----------
  // sp = steps per beat (4 = 16ths, 3 = triplets → swing feel), bpb = beats per bar.
  // Drum strings: one char per step, '.' = rest, '1'..'9' = velocity.
  // Bass: [step, degree, lengthInSteps, velocity]. Degrees: R 3 5 6 b7 8 (chord-aware 3rd),
  //   A = chromatic approach to the next chord's root.
  // Comp: [step, lengthInSteps, velocity]. Pad instruments (strings/organ) just hold the bar.
  const STYLES = {
    pop: { name: 'Pop', sp: 4, bpb: 4, bpm: 96, chord: 'piano', bassIns: 'ebass',
      drums: { kick: '9.......9.6.....', snare: '....9.......9...', hat: '6.4.6.4.6.4.6.4.' },
      bass: [[0, 'R', 3, .9], [6, 'R', 2, .6], [8, '5', 4, .8], [12, '8', 2, .7], [14, '5', 2, .6]],
      comp: [[0, 4, .45], [6, 2, .3], [8, 4, .4], [12, 3, .3]] },
    rock: { name: 'Rock', sp: 4, bpb: 4, bpm: 120, chord: 'organ', bassIns: 'ebass',
      drums: { kick: '9.....7.9.7.....', snare: '....9.......9...', hat: '8.7.8.7.8.7.8.7.' },
      bass: [[0, 'R', 2, .9], [2, 'R', 2, .7], [4, 'R', 2, .8], [6, 'R', 2, .7], [8, 'R', 2, .9], [10, 'R', 2, .7], [12, '5', 2, .8], [14, '8', 2, .7]],
      comp: [[0, 6, .45], [8, 6, .45]] },
    ballad: { name: 'Ballad', sp: 4, bpb: 4, bpm: 68, chord: 'piano', bassIns: 'upright',
      drums: { kick: '8.......6.......', rim: '....5.......5...', hat: '4.3.4.3.4.3.4.3.' },
      bass: [[0, 'R', 8, .85], [8, '5', 8, .75]],
      comp: [[0, 8, .4], [8, 8, .32]] },
    jazz: { name: 'Jazz swing', sp: 3, bpb: 4, bpm: 140, chord: 'piano', bassIns: 'upright', prog: 'jazz',
      drums: { ride: '7..7.57..7.5', kick: '2..2..2..2..', hat: '...5.....5..' },
      bass: [[0, 'R', 3, .9], [3, '3', 3, .75], [6, '5', 3, .8], [9, 'A', 3, .75]],
      comp: [[0, 2, .4], [5, 2, .35]] },
    bossa: { name: 'Bossa nova', sp: 4, bpb: 4, bpm: 130, chord: 'epiano', bassIns: 'upright', prog: 'jazz',
      drums: { kick: '7.....5.7.....5.', rim: '6..6..6...6..6..', hat: '4343434343434343' },
      bass: [[0, 'R', 5, .9], [6, '5', 2, .7], [8, '5', 5, .85], [14, 'R', 2, .7]],
      comp: [[0, 2, .35], [3, 2, .3], [6, 3, .32], [10, 2, .3], [13, 3, .32]] },
    shuffle: { name: 'Blues shuffle', sp: 3, bpb: 4, bpm: 110, chord: 'piano', bassIns: 'ebass', prog: 'blues',
      drums: { kick: '9.....8.....', snare: '...9.....9..', hat: '7.47.47.47.4' },
      bass: [[0, 'R', 2, .9], [2, 'R', 1, .6], [3, '3', 2, .8], [5, '3', 1, .6], [6, '5', 2, .85], [8, '5', 1, .6], [9, '6', 2, .8], [11, 'b7', 1, .65]],
      comp: [[2, 1, .3], [3, 2, .4], [8, 1, .3], [9, 2, .4]] },
    funk: { name: 'Funk', sp: 4, bpb: 4, bpm: 100, chord: 'epiano', bassIns: 'ebass', prog: 'funk',
      drums: { kick: '9.....7.9.....6.', snare: '....9..3.3..9..3', hat: '6363636363636363' },
      bass: [[0, 'R', 1, .95], [3, '8', 1, .7], [6, 'R', 1, .8], [7, 'b7', 1, .6], [10, '5', 1, .75], [12, 'R', 1, .85], [14, '8', 1, .65]],
      comp: [[2, 1, .38], [6, 1, .32], [11, 1, .38], [14, 1, .32]] },
    reggae: { name: 'Reggae (one drop)', sp: 4, bpb: 4, bpm: 76, chord: 'organ', bassIns: 'ebass',
      drums: { kick: '........9.......', rim: '........8.......', hat: '5.3.5.3.5.3.5.3.' },
      bass: [[0, 'R', 4, .9], [6, '5', 2, .7], [8, 'R', 3, .85], [12, '3', 2, .7], [14, '5', 2, .65]],
      comp: [[4, 1, .4], [12, 1, .4]], skank: true },
    waltz: { name: 'Waltz (3/4)', sp: 4, bpb: 3, bpm: 120, chord: 'piano', bassIns: 'upright',
      drums: { kick: '7...........', hat: '5...4...4...' },
      bass: [[0, 'R', 4, .9]],
      comp: [[4, 3, .35], [8, 3, .32]] },
  };
  const DEG = { R: 0, '5': 7, '6': 9, b7: 10, '8': 12 };
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

  const settings = { style: 'pop', chordInstr: 'piano', bassInstr: 'ebass', mix: {} };
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
  // kick / snare / hat are raw samples; rim and ride are derived from snare and hat
  const DRUM_VOICE = {
    kick: ['kick', 1, 0], snare: ['snare', 1, 0], hat: ['hihat', 1, 0],
    rim: ['snare', 1.9, 0.07], ride: ['hihat', 0.62, 0],
  };
  function drum(name, time, vel) {
    if (!drumBufs) return;
    const [buf, rate, cut] = DRUM_VOICE[name];
    const s = ctx.createBufferSource(); s.buffer = drumBufs[buf]; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.setValueAtTime(vel, time);
    if (cut) g.gain.setTargetAtTime(0, time + cut * 0.3, cut / 3);
    s.connect(g); g.connect(bus.drums); s.start(time);
  }

  let BEATS = 4;
  const LOW = 48, HIGH = 84; // C3..C6 on screen

  const $ = (id) => document.getElementById(id);
  const ui = {
    key: $('key'), prog: $('prog'), scale: $('scale'), bpm: $('bpm'), bpmOut: $('bpmOut'),
    play: $('play'), names: $('names'), mixer: $('mixer'), style: $('style'),
    now: $('chordNow'), next: $('chordNext'), beats: $('beats'),
    kb: $('keyboard'), tip: $('tip'), progline: $('progline'),
  };

  const state = { key: 0, prog: 'pop', scale: 'majpent', bpm: 90, playing: false, chordIdx: 0 };

  // ---------- UI setup ----------
  KEY_NAMES.forEach((n, i) => ui.key.add(new Option(n, i)));
  Object.entries(PROGS).forEach(([k, p]) => ui.prog.add(new Option(p.name, k)));
  Object.entries(SCALES).forEach(([k, s]) => ui.scale.add(new Option(s.name, k)));
  Object.entries(STYLES).forEach(([k, s]) => ui.style.add(new Option(s.name, k)));
  if (!STYLES[settings.style]) settings.style = 'pop';
  function buildBeats() {
    BEATS = STYLES[settings.style].bpb;
    ui.beats.innerHTML = '';
    for (let i = 0; i < BEATS; i++) ui.beats.appendChild(document.createElement('i'));
  }
  buildBeats();

  const instrSel = {};
  function buildMixer() {
    const extra = {
      chords: ['chordInstr', CHORD_INSTR.map((k) => [k, INSTR[k].label])],
      bass: ['bassInstr', BASS_INSTR.map((k) => [k, INSTR[k].label])],
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
        instrSel[key] = sel;
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
    state.chordIdx = 0; step = 0;
    fullRender();
  };
  function setBpm(v) { state.bpm = v; ui.bpm.value = v; ui.bpmOut.textContent = v; }
  ui.style.onchange = () => {
    const S = STYLES[ui.style.value];
    settings.style = ui.style.value;
    settings.chordInstr = S.chord; instrSel.chordInstr.value = S.chord; loadInstrument(S.chord);
    settings.bassInstr = S.bassIns; instrSel.bassInstr.value = S.bassIns; loadInstrument(S.bassIns);
    setBpm(S.bpm);
    if (S.prog && S.prog !== state.prog) { ui.prog.value = S.prog; ui.prog.onchange(); }
    buildBeats();
    step = 0; save();
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

  // ---------- Backing scheduler (step sequencer) ----------
  let step = 0, nextTime = 0, timer = null;
  const visQueue = [];
  function voicing(c) {
    const root = 48 + ((state.key + c[0]) % 12);
    return QUAL[c[1]].iv.map((i) => { let m = root + i; if (m < 52) m += 12; return m; });
  }
  const bassRoot = (c) => 33 + (((state.key + c[0]) % 12) - 9 + 12) % 12; // A1..G#2
  function bassNote(deg, c, next) {
    const r = bassRoot(c);
    if (deg === 'A') { const t = bassRoot(next); return t - 1 >= 28 ? t - 1 : t + 1; }
    if (deg === '3') return r + QUAL[c[1]].iv[1];
    return r + DEG[deg];
  }
  function playStep(st, c, next, s, t, sd) {
    const S = STYLES[settings.style];
    // drums
    for (const [voice, pat] of Object.entries(S.drums)) {
      const ch = pat[s];
      if (ch && ch !== '.') drum(voice, t, +ch / 9);
    }
    // bass
    for (const [at, deg, len, vel] of S.bass) {
      if (at === s) playSample(settings.bassInstr, bassNote(deg, c, next), t, vel, bus.bass, len * sd * 0.92);
    }
    // chords
    const ins = settings.chordInstr;
    const notes = voicing(c);
    if (INSTR[ins].pad && !S.skank) {
      if (s === 0) notes.forEach((m) => playSample(ins, m, t, 0.32, bus.chords, sd * S.sp * S.bpb - 0.02));
    } else {
      for (const [at, len, vel] of S.comp) {
        if (at === s) notes.forEach((m, i) => playSample(ins, m, t + i * 0.006, vel, bus.chords, len * sd * 0.9));
      }
    }
  }
  function schedule() {
    const S = STYLES[settings.style];
    const sd = 60 / state.bpm / S.sp; // seconds per step
    const barSteps = S.sp * S.bpb;
    while (nextTime < ctx.currentTime + 0.15) {
      const p = PROGS[state.prog];
      const bar = Math.floor(step / barSteps);
      const s = step % barSteps;
      const ci = bar % p.chords.length;
      const c = p.chords[ci], next = p.chords[(ci + 1) % p.chords.length];
      playStep(step, c, next, s, nextTime, sd);
      if (s % S.sp === 0) visQueue.push({ t: nextTime, ci, b: s / S.sp });
      nextTime += sd; step++;
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
    state.playing = true; step = 0; state.chordIdx = 0; visQueue.length = 0;
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
  ui.style.value = settings.style; setBpm(STYLES[settings.style].bpm);
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
