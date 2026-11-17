// Improvise: improvisation trainer + multitrack MIDI studio.
import * as M from './music.js';
import * as A from './audio.js';
import { buildMidi, encodeWav, download } from './export.js';
import * as Store from './store.js';

const { ctx, INSTR } = A;
const $ = (id) => document.getElementById(id);
const ui = {
  style: $('style'), key: $('key'), prog: $('prog'), scale: $('scale'), bpm: $('bpm'), bpmOut: $('bpmOut'),
  play: $('play'), names: $('names'), mixer: $('mixer'),
  now: $('chordNow'), next: $('chordNext'), beats: $('beats'),
  kb: $('keyboard'), tip: $('tip'), progline: $('progline'),
  projSel: $('projSel'), projName: $('projName'), projNew: $('projNew'), projDel: $('projDel'),
  recInstr: $('recInstr'), passes: $('passes'), click: $('click'), countIn: $('countIn'), rec: $('recBtn'),
  midiStatus: $('midiStatus'), midiBtn: $('midiBtn'), lat: $('lat'), latOut: $('latOut'),
  tracks: $('tracks'), incBacking: $('incBacking'),
  expWav: $('expWav'), expMidi: $('expMidi'), expProj: $('expProj'), impProj: $('impProj'), impFile: $('impFile'),
  msg: $('studioMsg'),
};

// ---------- Preferences (per browser) ----------
const prefs = { mix: {}, recInstr: 'piano', click: true, countIn: true, latencyMs: 0, includeBacking: true, lastProject: null };
try {
  const old = JSON.parse(localStorage.getItem('improv-settings') || '{}');
  if (old.mix) { prefs.mix = old.mix; if (old.mix.piano) prefs.mix.live = old.mix.piano; }
  Object.assign(prefs, JSON.parse(localStorage.getItem('improv-prefs') || '{}'));
} catch (e) {}
const savePrefs = () => { try { localStorage.setItem('improv-prefs', JSON.stringify(prefs)); } catch (e) {} };

// ---------- Project ----------
let project = null;
function newProject(name) {
  return { id: Store.newId(), name, created: Date.now(), updated: Date.now(),
    key: 0, prog: 'pop', scale: 'majpent', style: 'pop', bpm: 96, passes: 1,
    chordInstr: 'piano', bassInstr: 'ebass', tracks: [] };
}
let saveTimer = null;
function saveProject() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    project.updated = Date.now();
    Store.putProject(project).then(renderProjectList).catch((e) => flash('Could not save: ' + e.message));
  }, 300);
}

const S = () => M.STYLES[project.style];
const P = () => M.PROGS[project.prog];
const bars = () => P().chords.length * project.passes;
const songBeats = () => bars() * S().bpb;
const spb = () => 60 / project.bpm;
const backingOpts = () => ({ key: project.key, prog: project.prog, style: project.style,
  chordInstr: project.chordInstr, bassInstr: project.bassInstr, chordPad: !!INSTR[project.chordInstr].pad });
const velGain = (v) => 0.12 + 0.78 * v;

// ---------- Live audio graph ----------
const G = A.makeGraph(ctx);
const CHANNELS = [
  { id: 'live',   label: 'Live input', vol: 0.85, send: 0.35 },
  { id: 'chords', label: 'Chords',     vol: 0.55, send: 0.45 },
  { id: 'bass',   label: 'Bass',       vol: 0.75, send: 0.1 },
  { id: 'drums',  label: 'Drums',      vol: 0.55, send: 0.15 },
  { id: 'reverb', label: 'Reverb',     vol: 0.5 },
  { id: 'master', label: 'Master',     vol: 0.85 },
];
const bus = { reverb: G.reverbOut, master: G.master };
CHANNELS.forEach((c) => { if (!bus[c.id]) bus[c.id] = G.channel(c.send); });
const clickBus = ctx.createGain(); clickBus.gain.value = 0.6; clickBus.connect(ctx.destination);
const mixGain = (id) => { const m = prefs.mix[id]; return m.mute ? 0 : A.curve(m.vol); };
const applyMix = (id) => bus[id].gain.setTargetAtTime(mixGain(id), ctx.currentTime, 0.02);

const trackBus = {};
const getTrackBus = (t) => (trackBus[t.id] ||= G.channel(0.3));
function audible(t) {
  if (T.recording && R.target === t) return false;
  const anySolo = project.tracks.some((x) => x.solo);
  return anySolo ? t.solo : !t.mute;
}
function applyTrackMix() {
  for (const t of project.tracks) getTrackBus(t).gain.setTargetAtTime(audible(t) ? A.curve(t.vol) : 0, ctx.currentTime, 0.02);
}

function notesOf(t) {
  if (!t.quant) return t.notes;
  const g = 1 / (S().sp === 3 ? 3 : 4);
  return t.notes.map(([b, d, m, v]) => [Math.round(b / g) * g, Math.max(g / 2, Math.round(d / g) * g || d), m, v]);
}
function playBacking(c, e, time, sp, buses) {
  if (e.part === 'drums') A.playDrum(c, e.voice, time, e.vel, buses.drums);
  else A.playNote(c, e.instr, e.m, time, e.vel, buses[e.part], e.dur * sp);
}
function playTrackNote(c, t, n, time, sp, dest) {
  if (t.instr === 'drums') A.playDrum(c, M.drumVoiceFor(n[2]), time, velGain(n[3]), dest);
  else A.playNote(c, t.instr, n[2], time, velGain(n[3]), dest, n[1] * sp);
}

// ---------- Transport ----------
const T = { playing: false, recording: false, songStart: 0, schedBeat: 0, countIn: 0 };
let timer = null, visQueue = [], curChord = 0;
function unlock() { if (ctx.state !== 'running') ctx.resume(); }

function startTransport(countIn = 0) {
  unlock();
  T.countIn = countIn;
  T.songStart = ctx.currentTime + 0.12 + countIn * spb();
  T.schedBeat = -countIn;
  T.playing = true; visQueue = [];
  timer = setInterval(schedule, 25); schedule();
  requestAnimationFrame(drawLoop);
  updateButtons();
}
function stopTransport() {
  if (!T.playing) return;
  T.playing = false; clearInterval(timer);
  if (T.recording) finishRecording();
  [...ui.beats.children].forEach((d) => d.classList.remove('on'));
  document.querySelectorAll('.ph').forEach((p) => (p.style.display = 'none'));
  updateButtons();
}
function schedule() {
  const b = spb(), L = songBeats(), bpb = S().bpb;
  const until = (ctx.currentTime + 0.15 - T.songStart) / b;
  if (until <= T.schedBeat) return;
  const from = T.schedBeat, to = until; T.schedBeat = until;
  const at = (beat) => T.songStart + beat * b;
  for (let k = Math.ceil(from - 1e-9); k < to; k++) {
    if (k < 0) {
      const inBar = (k + T.countIn) % bpb;
      A.click(ctx, at(k), inBar === 0, clickBus);
      visQueue.push({ t: at(k), b: inBar, count: -k });
      continue;
    }
    if (T.recording && k >= L) break;
    if (T.recording && prefs.click) A.click(ctx, at(k), k % bpb === 0, clickBus);
    const pos = k % L;
    visQueue.push({ t: at(k), b: pos % bpb, ci: Math.floor(pos / bpb) % P().chords.length });
  }
  const a0 = Math.max(from, 0);
  for (let loop = Math.floor(a0 / L); loop * L < to; loop++) {
    if (T.recording && loop > 0) break;
    const off = loop * L;
    scheduleWindow(Math.max(a0, off) - off, Math.min(to, off + L) - off, off);
  }
}
function scheduleWindow(s0, s1, off) {
  if (s1 <= s0) return;
  const bpb = S().bpb, b = spb(), o = backingOpts();
  const time = (beat) => T.songStart + (off + beat) * b;
  for (let bar = Math.floor(s0 / bpb); bar * bpb < s1; bar++) {
    for (const e of M.backingBar(o, bar)) {
      const beat = bar * bpb + e.beat;
      if (beat >= s0 && beat < s1) playBacking(ctx, e, time(beat), b, bus);
    }
  }
  for (const t of project.tracks) {
    if (T.recording && R.target === t) continue;
    const dest = getTrackBus(t);
    for (const n of notesOf(t)) if (n[0] >= s0 && n[0] < s1) playTrackNote(ctx, t, n, time(n[0]), b, dest);
  }
}
let lastRoll = 0;
function drawLoop() {
  if (!T.playing) return;
  const now = ctx.currentTime;
  while (visQueue.length && visQueue[0].t <= now) {
    const v = visQueue.shift();
    [...ui.beats.children].forEach((d, i) => d.classList.toggle('on', i === v.b));
    if (v.count) ui.rec.textContent = `Count-in… ${v.count}`;
    else if (T.recording) ui.rec.textContent = '■ Stop recording';
    if (v.ci != null && v.ci !== curChord) { curChord = v.ci; renderHighlights(); }
  }
  const L = songBeats();
  const pos = (now - T.songStart) / spb();
  document.querySelectorAll('.ph').forEach((p) => {
    p.style.display = pos >= 0 ? 'block' : 'none';
    p.style.left = ((pos % L) / L) * 100 + '%';
  });
  if (T.recording) {
    if (pos >= L) { stopTransport(); return; }
    if (now - lastRoll > 0.2) { lastRoll = now; drawRecordingRoll(pos); }
  }
  requestAnimationFrame(drawLoop);
}

// ---------- Live input + recording ----------
const R = { target: null, instr: 'piano', notes: [], open: {}, pedal: false };
const live = {}, held = new Set(), sustained = new Set();
const inputInstr = () => (T.recording ? R.instr : prefs.recInstr);
const beatAt = (tIn) => (tIn - (ctx.outputLatency || ctx.baseLatency || 0) - prefs.latencyMs / 1000 - T.songStart) / spb();

function inputOn(m, vel, tIn = ctx.currentTime) {
  unlock();
  held.add(m);
  keyDown(m, true);
  const instr = inputInstr();
  if (INSTR[instr].drums) {
    A.playDrum(ctx, M.drumVoiceFor(m), ctx.currentTime, velGain(vel), bus.live);
    if (T.recording) recordNote(M.foldDrum(m), vel, beatAt(tIn), 0.25);
    return;
  }
  if (live[m]) A.releaseNote(live[m], ctx.currentTime);
  sustained.delete(m);
  live[m] = A.playNote(ctx, instr, m, ctx.currentTime, velGain(vel), bus.live);
  if (T.recording) {
    if (R.open[m]) closeNote(m, beatAt(tIn));
    R.open[m] = { beat: beatAt(tIn), vel };
  }
}
function inputOff(m, tIn = ctx.currentTime) {
  held.delete(m);
  keyDown(m, false);
  if (R.pedal && !INSTR[inputInstr()].drums) { sustained.add(m); return; }
  releaseLive(m, tIn);
}
function releaseLive(m, tIn) {
  if (live[m]) { A.releaseNote(live[m], ctx.currentTime); delete live[m]; }
  if (T.recording && R.open[m]) closeNote(m, beatAt(tIn));
}
function pedal(down, tIn = ctx.currentTime) {
  R.pedal = down;
  if (!down) { for (const m of [...sustained]) if (!held.has(m)) releaseLive(m, tIn); sustained.clear(); }
}
function recordNote(m, vel, beat, dur) {
  const L = songBeats();
  if (beat < -0.5 || beat >= L) return;
  beat = Math.max(0, beat);
  R.notes.push([+beat.toFixed(4), +Math.max(0.05, Math.min(dur, L - beat)).toFixed(4), m, +vel.toFixed(3)]);
}
function closeNote(m, endBeat) {
  const o = R.open[m]; delete R.open[m];
  if (!o) return;
  recordNote(m, o.vel, o.beat, Math.min(endBeat, songBeats()) - Math.max(0, o.beat));
}

async function startRecording(target = null) {
  if (T.recording) { stopTransport(); return; }
  if (T.playing) stopTransport();
  const instr = target ? target.instr : prefs.recInstr;
  if (!A.isLoaded(instr)) { flash('Loading ' + INSTR[instr].label + '…'); await A.loadInstrument(instr); }
  Object.assign(R, { target, instr, notes: [], open: {} });
  T.recording = true;
  applyTrackMix();
  renderTracks();
  document.body.classList.add('recording');
  startTransport(prefs.countIn ? S().bpb : 0);
}
function finishRecording() {
  const end = songBeats();
  for (const m of Object.keys(R.open)) closeNote(+m, end);
  T.recording = false;
  document.body.classList.remove('recording');
  R.notes.sort((a, b) => a[0] - b[0]);
  if (!R.notes.length) {
    flash('Nothing was recorded. Play some notes after the count-in.');
  } else if (R.target) {
    R.target.notes = R.notes;
    flash(`Re-recorded ${R.target.name}.`);
  } else {
    const n = project.tracks.filter((t) => t.instr === R.instr).length + 1;
    project.tracks.push({ id: Store.newId(), name: `${INSTR[R.instr].label} ${n}`, instr: R.instr,
      vol: 0.8, mute: false, solo: false, quant: false, notes: R.notes });
    flash(`Added track: ${INSTR[R.instr].label} ${n} (${R.notes.length} notes).`);
  }
  R.target = null;
  applyTrackMix();
  renderTracks();
  saveProject();
}

// ---------- MIDI keyboard ----------
let midiAccess = null;
async function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    ui.midiStatus.textContent = 'This browser has no MIDI support. Use Chrome or Edge on your PC.';
    return;
  }
  try {
    midiAccess = await navigator.requestMIDIAccess();
    attachMidi();
    midiAccess.onstatechange = attachMidi;
  } catch (e) {
    ui.midiStatus.textContent = 'MIDI access was blocked. Allow MIDI for this site in the browser and try again.';
  }
}
function attachMidi() {
  const names = [];
  midiAccess.inputs.forEach((inp) => { inp.onmidimessage = onMidi; if (inp.state === 'connected') names.push(inp.name); });
  ui.midiStatus.textContent = names.length ? `🎹 MIDI: ${names.join(', ')}` : 'MIDI ready, but no keyboard found. Plug it in.';
  ui.midiStatus.classList.toggle('ok', names.length > 0);
  ui.midiBtn.hidden = names.length > 0;
}
function onMidi(e) {
  const [st, d1, d2] = e.data;
  const cmd = st & 0xf0;
  const tIn = ctx.currentTime - Math.max(0, performance.now() - e.timeStamp) / 1000;
  if (cmd === 0x90 && d2 > 0) inputOn(d1, d2 / 127, tIn);
  else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) inputOff(d1, tIn);
  else if (cmd === 0xb0 && d1 === 64) pedal(d2 >= 64, tIn);
}

// ---------- Practice UI ----------
const LOW = 48, HIGH = 84;
M.KEY_NAMES.forEach((n, i) => ui.key.add(new Option(n, i)));
Object.entries(M.PROGS).forEach(([k, p]) => ui.prog.add(new Option(p.name, k)));
Object.entries(M.SCALES).forEach(([k, s]) => ui.scale.add(new Option(s.name, k)));
Object.entries(M.STYLES).forEach(([k, s]) => ui.style.add(new Option(s.name, k)));
A.TRACK_INSTR.forEach((k) => ui.recInstr.add(new Option(INSTR[k].label, k)));
[1, 2, 3, 4, 6, 8].forEach((n) => ui.passes.add(new Option(n === 1 ? 'Once through' : `${n}× through`, n)));

function buildBeats() {
  ui.beats.innerHTML = '';
  for (let i = 0; i < S().bpb; i++) ui.beats.appendChild(document.createElement('i'));
}

const instrSel = {};
function buildMixer() {
  const extra = {
    chords: ['chordInstr', A.CHORD_INSTR],
    bass: ['bassInstr', A.BASS_INSTR],
  };
  CHANNELS.forEach((c) => {
    const m = prefs.mix[c.id] = Object.assign({ vol: c.vol, mute: false }, prefs.mix[c.id]);
    const row = document.createElement('div');
    row.className = 'ch' + (c.id === 'master' ? ' master' : '');
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = c.label;
    if (extra[c.id]) {
      const [key, opts] = extra[c.id];
      const sel = document.createElement('select');
      opts.forEach((v) => sel.add(new Option(INSTR[v].label, v)));
      instrSel[key] = sel;
      sel.onchange = () => { project[key] = sel.value; A.loadInstrument(sel.value); saveProject(); };
      nm.appendChild(sel);
    }
    const sl = document.createElement('input');
    sl.type = 'range'; sl.min = 0; sl.max = 100; sl.value = Math.round(m.vol * 100);
    sl.setAttribute('aria-label', c.label + ' volume');
    sl.oninput = () => { m.vol = sl.value / 100; applyMix(c.id); savePrefs(); };
    const mute = document.createElement('button');
    mute.className = 'mute'; mute.textContent = 'M'; mute.title = 'Mute';
    const sync = () => { mute.classList.toggle('on', m.mute); row.classList.toggle('muted', m.mute); };
    mute.onclick = () => { m.mute = !m.mute; sync(); applyMix(c.id); savePrefs(); };
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
    el.innerHTML = `<span class="dot"></span><span class="nm">${M.NOTE_NAMES[pc]}</span><span class="dl">${M.DRUM_KEY_LABEL[M.drumVoiceFor(m)]}</span>`;
    if (isBlack) blacks.push([el, whiteIdx]);
    else el.dataset.wi = whiteIdx++;
    keyEls[m] = el;
    ui.kb.appendChild(el);
  }
  const layout = () => {
    const w = wk();
    Object.values(keyEls).forEach((el) => { if (el.classList.contains('w')) el.style.left = el.dataset.wi * w + 'px'; });
    blacks.forEach(([el, wi]) => { el.style.left = (wi * w - w * 0.31) + 'px'; });
    ui.kb.style.width = whiteIdx * w + 'px';
  };
  layout();
  addEventListener('resize', layout);
})();
function keyDown(m, on) {
  const el = keyEls[m]; if (!el) return;
  el.classList.toggle('down', on);
  if (on && INSTR[inputInstr()].drums) setTimeout(() => el.classList.remove('down'), 120);
}
const syncDrumMode = () => document.body.classList.toggle('drummode', !!INSTR[prefs.recInstr].drums);

function renderProgline() {
  ui.progline.innerHTML = P().chords.map((c, i) => `<span class="${i === curChord ? 'cur' : ''}">${M.chordName(project.key, c)}</span>`).join('');
}
function renderHighlights() {
  const p = P();
  const c = p.chords[curChord % p.chords.length];
  const scalePCs = new Set(M.SCALES[project.scale].iv.map((i) => (project.key + i) % 12));
  const tones = new Set(M.chordPCs(project.key, c));
  for (const [m, el] of Object.entries(keyEls)) {
    const pc = m % 12;
    el.classList.toggle('scale', scalePCs.has(pc));
    el.classList.toggle('tone', tones.has(pc));
    el.classList.toggle('root', pc === project.key);
    el.classList.toggle('out', !scalePCs.has(pc) && !tones.has(pc));
  }
  ui.now.textContent = M.chordName(project.key, c);
  ui.next.textContent = M.chordName(project.key, p.chords[(curChord + 1) % p.chords.length]);
  ui.progline.querySelectorAll('span').forEach((s, i) => s.classList.toggle('cur', i === curChord));
}
function renderTip() {
  ui.tip.innerHTML = `<b>${M.KEY_NAMES[project.key]} ${M.SCALES[project.scale].name}:</b> ${M.SCALES[project.scale].tip}`;
}
function renderPractice() {
  ui.style.value = project.style; ui.key.value = project.key; ui.prog.value = project.prog; ui.scale.value = project.scale;
  ui.bpm.value = project.bpm; ui.bpmOut.textContent = project.bpm; ui.passes.value = project.passes;
  instrSel.chordInstr.value = project.chordInstr; instrSel.bassInstr.value = project.bassInstr;
  curChord = 0;
  buildBeats(); renderProgline(); renderHighlights(); renderTip();
}

ui.key.onchange = () => { project.key = +ui.key.value; renderProgline(); renderHighlights(); renderTip(); saveProject(); };
ui.scale.onchange = () => { project.scale = ui.scale.value; renderHighlights(); renderTip(); saveProject(); };
ui.prog.onchange = () => {
  const p = M.PROGS[ui.prog.value];
  Object.assign(project, { prog: ui.prog.value, scale: p.scale, key: p.key });
  ui.scale.value = p.scale; ui.key.value = p.key;
  curChord = 0; renderProgline(); renderHighlights(); renderTip(); renderTracks(); saveProject();
};
ui.style.onchange = () => {
  const st = M.STYLES[ui.style.value];
  Object.assign(project, { style: ui.style.value, chordInstr: st.chord, bassInstr: st.bassIns });
  A.loadInstrument(st.chord); A.loadInstrument(st.bassIns);
  instrSel.chordInstr.value = st.chord; instrSel.bassInstr.value = st.bassIns;
  setBpm(st.bpm);
  if (st.prog && st.prog !== project.prog) { ui.prog.value = st.prog; ui.prog.onchange(); }
  buildBeats(); renderTracks(); saveProject();
};
function setBpm(v) {
  if (T.playing) { const nb = (ctx.currentTime - T.songStart) / spb(); project.bpm = v; T.songStart = ctx.currentTime - nb * spb(); }
  else project.bpm = v;
  ui.bpm.value = v; ui.bpmOut.textContent = v;
}
ui.bpm.oninput = () => { setBpm(+ui.bpm.value); saveProject(); };
ui.names.onchange = () => document.body.classList.toggle('shownames', ui.names.checked);
ui.play.onclick = () => (T.playing ? stopTransport() : startTransport(0));

function updateButtons() {
  ui.play.textContent = T.playing && !T.recording ? '■ Stop' : '▶ Play';
  ui.play.classList.toggle('on', T.playing && !T.recording);
  ui.play.disabled = !ready || T.recording;
  ui.rec.disabled = !ready;
  ui.rec.classList.toggle('on', T.recording);
  if (!T.recording) ui.rec.textContent = '● Record new track';
  for (const el of [ui.style, ui.key, ui.prog, ui.bpm, ui.passes, ui.recInstr, ui.projSel, ui.projNew, ui.projDel]) el.disabled = T.recording;
}

// ---------- On-screen keyboard + computer keyboard ----------
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
  pointerNote[e.pointerId] = h.m; inputOn(h.m, h.vel);
});
ui.kb.addEventListener('pointermove', (e) => {
  if (!(e.pointerId in pointerNote)) return;
  const h = hit(e.clientX, e.clientY);
  if (h && h.m !== pointerNote[e.pointerId]) { inputOff(pointerNote[e.pointerId]); pointerNote[e.pointerId] = h.m; inputOn(h.m, h.vel); }
});
const pointerUp = (e) => { if (e.pointerId in pointerNote) { inputOff(pointerNote[e.pointerId]); delete pointerNote[e.pointerId]; } };
addEventListener('pointerup', pointerUp); addEventListener('pointercancel', pointerUp);

const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };
let octBase = 60;
const kbHeld = {};
addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'SELECT' || tag === 'TEXTAREA' || (tag === 'INPUT' && !['checkbox', 'range'].includes(e.target.type))) return;
  const k = e.key.toLowerCase();
  if (e.code === 'Space') { e.preventDefault(); if (ready && !T.recording) T.playing ? stopTransport() : startTransport(0); return; }
  if (e.key === 'Enter' && ready) { e.preventDefault(); startRecording(); return; }
  if (k === 'z') { octBase = Math.max(36, octBase - 12); return; }
  if (k === 'x') { octBase = Math.min(72, octBase + 12); return; }
  if (!(k in KEYMAP) || kbHeld[k] != null || e.repeat) return;
  const m = octBase + KEYMAP[k]; kbHeld[k] = m; inputOn(m, 0.8);
});
addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (kbHeld[k] != null) { inputOff(kbHeld[k]); delete kbHeld[k]; }
});

// ---------- Studio UI ----------
let flashTimer = null;
function flash(text) {
  ui.msg.textContent = text; ui.msg.classList.add('show');
  clearTimeout(flashTimer); flashTimer = setTimeout(() => ui.msg.classList.remove('show'), 5000);
}
function confirmTwice(btn, label, fn) {
  if (btn.dataset.armed) { delete btn.dataset.armed; btn.classList.remove('armed'); fn(); return; }
  const orig = btn.textContent;
  btn.dataset.armed = 1; btn.classList.add('armed'); btn.textContent = label;
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.classList.remove('armed'); btn.textContent = orig; } }, 3000);
}

async function renderProjectList() {
  const list = (await Store.listProjects()).sort((a, b) => b.updated - a.updated);
  ui.projSel.innerHTML = '';
  for (const p of list) ui.projSel.add(new Option(p.id === project.id ? project.name : p.name, p.id));
  ui.projSel.value = project.id;
}
async function openProject(p) {
  if (T.playing) stopTransport();
  project = Object.assign(newProject(''), p);
  prefs.lastProject = project.id; savePrefs();
  ui.projName.value = project.name;
  renderPractice(); renderTracks(); applyTrackMix(); renderProjectList();
  const need = new Set(['piano', 'drums', project.chordInstr, project.bassInstr, prefs.recInstr, ...project.tracks.map((t) => t.instr)]);
  await Promise.all([...need].map((k) => A.loadInstrument(k)));
}
ui.projSel.onchange = async () => { const p = await Store.getProject(ui.projSel.value); if (p) openProject(p); };
ui.projName.oninput = () => { project.name = ui.projName.value || 'Untitled'; saveProject(); };
ui.projNew.onclick = async () => {
  const n = (await Store.listProjects()).length + 1;
  const p = newProject(`Song ${n}`);
  Object.assign(p, { key: project.key, prog: project.prog, scale: project.scale, style: project.style, bpm: project.bpm,
    chordInstr: project.chordInstr, bassInstr: project.bassInstr });
  await Store.putProject(p);
  openProject(p);
  flash(`Created ${p.name}.`);
};
ui.projDel.onclick = () => confirmTwice(ui.projDel, 'Tap again to delete', async () => {
  await Store.deleteProject(project.id);
  const list = (await Store.listProjects()).sort((a, b) => b.updated - a.updated);
  const next = list[0] || newProject('Song 1');
  if (!list[0]) await Store.putProject(next);
  openProject(next);
  flash('Song deleted.');
});

ui.recInstr.onchange = () => { prefs.recInstr = ui.recInstr.value; savePrefs(); A.loadInstrument(prefs.recInstr); syncDrumMode(); };
ui.passes.onchange = () => { project.passes = +ui.passes.value; renderTracks(); saveProject(); };
ui.click.onchange = () => { prefs.click = ui.click.checked; savePrefs(); };
ui.countIn.onchange = () => { prefs.countIn = ui.countIn.checked; savePrefs(); };
ui.lat.oninput = () => { prefs.latencyMs = +ui.lat.value; ui.latOut.textContent = prefs.latencyMs; savePrefs(); };
ui.incBacking.onchange = () => { prefs.includeBacking = ui.incBacking.checked; savePrefs(); };
ui.rec.onclick = () => startRecording();
ui.midiBtn.onclick = connectMidi;

const TRACK_COLORS = ['#f5a524', '#4f8cff', '#30c48d', '#e5484d', '#b07cff', '#ff7ab6', '#36c5d6', '#d9c84a'];
function drawRoll(canvas, notes, isDrum, color) {
  const dpr = devicePixelRatio || 1;
  const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
  if (!w) return;
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, w, h);
  const L = songBeats(), bpb = S().bpb;
  g.fillStyle = 'rgba(255,255,255,.06)';
  for (let bar = 0; bar <= L / bpb; bar++) g.fillRect(Math.round((bar * bpb / L) * w), 0, 1, h);
  if (!notes.length) return;
  let lo = Infinity, hi = -Infinity;
  for (const n of notes) { lo = Math.min(lo, n[2]); hi = Math.max(hi, n[2]); }
  lo -= 1; hi += 1;
  const nh = Math.max(2 * dpr, Math.min(6 * dpr, h / (hi - lo + 1)));
  g.fillStyle = color;
  for (const [b, d, m, v] of notes) {
    if (b >= L) continue;
    const x = (b / L) * w, y = h - ((m - lo) / (hi - lo)) * (h - nh) - nh;
    g.globalAlpha = 0.45 + 0.55 * v;
    g.fillRect(x, y, Math.max(2 * dpr, (isDrum ? 0.2 : Math.min(d, L - b)) / L * w), nh);
  }
  g.globalAlpha = 1;
}
function drawRecordingRoll(pos) {
  const c = ui.tracks.querySelector('.trk.rec canvas');
  if (!c) return;
  const open = Object.entries(R.open).map(([m, o]) => [Math.max(0, o.beat), Math.max(0.05, pos - o.beat), +m, o.vel]);
  drawRoll(c, [...R.notes, ...open], INSTR[R.instr].drums, '#e5484d');
}

function renderTracks() {
  ui.tracks.innerHTML = '';
  const rows = [...project.tracks];
  if (!rows.length && !T.recording) {
    ui.tracks.innerHTML = '<p class="empty">No tracks yet. Pick an instrument, press <b>● Record new track</b> (or Enter) and play over the backing. The recording runs once through the song.</p>';
  }
  rows.forEach((t, i) => {
    const color = TRACK_COLORS[i % TRACK_COLORS.length];
    const row = document.createElement('div');
    row.className = 'trk' + (T.recording && R.target === t ? ' rec' : '');
    row.style.setProperty('--tc', color);
    row.innerHTML = `
      <div class="trk-top">
        <input class="tname" value="" aria-label="Track name">
        <select class="tinstr" aria-label="Instrument"></select>
        <button class="tb m" title="Mute">M</button>
        <button class="tb s" title="Solo">S</button>
        <button class="tb q" title="Quantize: snap notes to the beat grid">Q</button>
        <button class="tb rr" title="Record this track again">⟲</button>
        <button class="tb del" title="Delete track">✕</button>
      </div>
      <div class="trk-bot">
        <input type="range" class="tvol" min="0" max="100" aria-label="Track volume">
        <div class="roll"><canvas></canvas><i class="ph"></i></div>
      </div>`;
    const $r = (s) => row.querySelector(s);
    $r('.tname').value = t.name;
    $r('.tname').oninput = (e) => { t.name = e.target.value; saveProject(); };
    const sel = $r('.tinstr');
    A.TRACK_INSTR.forEach((k) => sel.add(new Option(INSTR[k].label, k)));
    sel.value = t.instr;
    sel.onchange = () => { t.instr = sel.value; A.loadInstrument(t.instr); drawRoll($r('canvas'), notesOf(t), INSTR[t.instr].drums, color); saveProject(); };
    const vol = $r('.tvol'); vol.value = Math.round(t.vol * 100);
    vol.oninput = () => { t.vol = vol.value / 100; applyTrackMix(); saveProject(); };
    const tog = (cls, key) => {
      const b = $r(cls); b.classList.toggle('on', !!t[key]);
      b.onclick = () => { t[key] = !t[key]; b.classList.toggle('on', t[key]); applyTrackMix(); if (key === 'quant') drawRoll($r('canvas'), notesOf(t), INSTR[t.instr].drums, color); saveProject(); };
    };
    tog('.m', 'mute'); tog('.s', 'solo'); tog('.q', 'quant');
    $r('.rr').onclick = () => startRecording(t);
    $r('.del').onclick = (e) => confirmTwice(e.currentTarget, 'Delete?', () => {
      project.tracks = project.tracks.filter((x) => x !== t);
      renderTracks(); applyTrackMix(); saveProject(); flash(`Deleted ${t.name}.`);
    });
    ui.tracks.appendChild(row);
    requestAnimationFrame(() => drawRoll($r('canvas'), notesOf(t), INSTR[t.instr].drums, color));
  });
  if (T.recording && !R.target) {
    const row = document.createElement('div');
    row.className = 'trk rec';
    row.innerHTML = `<div class="trk-top"><span class="recname">● Recording: ${INSTR[R.instr].label}</span></div>
      <div class="trk-bot"><span></span><div class="roll"><canvas></canvas><i class="ph"></i></div></div>`;
    ui.tracks.appendChild(row);
  }
}
addEventListener('resize', () => renderTracks());

// ---------- Export ----------
function songMeta() { return { L: songBeats(), b: spb(), bpb: S().bpb, bars: bars() }; }
async function ensureLoaded() {
  const need = new Set(project.tracks.filter(audible).map((t) => t.instr));
  if (prefs.includeBacking) { need.add(project.chordInstr); need.add(project.bassInstr); need.add('drums'); }
  await Promise.all([...need].map((k) => A.loadInstrument(k)));
}
const safeName = () => (project.name || 'song').replace(/[^\w\- ]+/g, '').trim() || 'song';

ui.expWav.onclick = async () => {
  if (T.playing) stopTransport();
  const btn = ui.expWav, label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Rendering…';
  try {
    await ensureLoaded();
    const { L, b, bpb, bars: nb } = songMeta();
    const t0 = 0.05, dur = t0 + L * b + 3;
    const oc = new OfflineAudioContext(2, Math.ceil(dur * ctx.sampleRate), ctx.sampleRate);
    const g = A.makeGraph(oc);
    g.master.gain.value = A.curve(prefs.mix.master.vol);
    g.reverbOut.gain.value = mixGain('reverb');
    const buses = {};
    for (const c of CHANNELS.slice(1, 4)) { buses[c.id] = g.channel(c.send); buses[c.id].gain.value = mixGain(c.id); }
    if (prefs.includeBacking) {
      const o = backingOpts();
      for (let bar = 0; bar < nb; bar++) for (const e of M.backingBar(o, bar)) playBacking(oc, e, t0 + (bar * bpb + e.beat) * b, b, buses);
    }
    for (const t of project.tracks) {
      if (!audible(t)) continue;
      const dest = g.channel(0.3); dest.gain.value = A.curve(t.vol);
      for (const n of notesOf(t)) if (n[0] < L) playTrackNote(oc, t, n, t0 + n[0] * b, b, dest);
    }
    const buf = await oc.startRendering();
    download(encodeWav(buf), safeName() + '.wav');
    flash('WAV exported.');
  } catch (e) { console.error(e); flash('Export failed: ' + e.message); }
  btn.disabled = false; btn.textContent = label;
};

ui.expMidi.onclick = () => {
  const { L, bpb, bars: nb } = songMeta();
  const tracks = [];
  let ch = 0;
  const nextCh = () => { const c = ch; ch = ch + 1 === 9 ? 10 : ch + 1; return Math.min(c, 15); };
  for (const t of project.tracks) {
    if (!audible(t)) continue;
    const drums = !!INSTR[t.instr].drums;
    tracks.push({ name: t.name, channel: drums ? 9 : nextCh(), program: INSTR[t.instr].gm || 0,
      notes: notesOf(t).filter((n) => n[0] < L).map(([bt, d, m, v]) => [bt, drums ? 0.25 : Math.min(d, L - bt), m, v]) });
  }
  if (prefs.includeBacking) {
    const o = backingOpts();
    const parts = { chords: [], bass: [], drums: [] };
    for (let bar = 0; bar < nb; bar++) {
      for (const e of M.backingBar(o, bar)) {
        if (prefs.mix[e.part].mute) continue;
        const beat = bar * bpb + e.beat;
        parts[e.part].push(e.part === 'drums' ? [beat, 0.2, M.VOICE_GM[e.voice], e.vel] : [beat, e.dur, e.m, e.vel]);
      }
    }
    if (parts.chords.length) tracks.push({ name: 'Backing chords', channel: nextCh(), program: INSTR[project.chordInstr].gm, notes: parts.chords });
    if (parts.bass.length) tracks.push({ name: 'Backing bass', channel: nextCh(), program: INSTR[project.bassInstr].gm, notes: parts.bass });
    if (parts.drums.length) tracks.push({ name: 'Backing drums', channel: 9, program: 0, notes: parts.drums });
  }
  if (!tracks.length) { flash('Nothing to export yet.'); return; }
  const bytes = buildMidi({ name: project.name, bpm: project.bpm, bpb, tracks });
  download(new Blob([bytes], { type: 'audio/midi' }), safeName() + '.mid');
  flash('MIDI exported.');
};

ui.expProj.onclick = () => {
  const blob = new Blob([JSON.stringify({ format: 'improv-project', version: 1, project }, null, 1)], { type: 'application/json' });
  download(blob, safeName() + '.improv.json');
};
ui.impProj.onclick = () => ui.impFile.click();
ui.impFile.onchange = async () => {
  const f = ui.impFile.files[0]; ui.impFile.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const p = data.project || data;
    if (!Array.isArray(p.tracks) || !M.PROGS[p.prog] || !M.STYLES[p.style]) throw new Error('not an Improvise project file');
    p.tracks = p.tracks.filter((t) => INSTR[t.instr] && Array.isArray(t.notes));
    Object.assign(p, { id: Store.newId(), name: (p.name || 'Imported') + ' (imported)', updated: Date.now() });
    await Store.putProject(p);
    await openProject(p);
    flash(`Imported ${p.name}.`);
  } catch (e) { flash('Import failed: ' + e.message); }
};

// ---------- Init ----------
let ready = false;
if (innerWidth < 700) $('mixerBox').open = false;
ui.recInstr.value = prefs.recInstr; ui.click.checked = prefs.click; ui.countIn.checked = prefs.countIn;
ui.lat.value = prefs.latencyMs; ui.latOut.textContent = prefs.latencyMs; ui.incBacking.checked = prefs.includeBacking;
syncDrumMode();
updateButtons();

(async () => {
  let list = [];
  try { list = await Store.listProjects(); } catch (e) { flash('Browser storage is unavailable, so songs will not be saved.'); }
  let p = list.find((x) => x.id === prefs.lastProject) || list.sort((a, b) => b.updated - a.updated)[0];
  if (!p) { p = newProject('My first song'); try { await Store.putProject(p); } catch (e) {} }
  project = Object.assign(newProject(''), p);
  prefs.lastProject = project.id; savePrefs();
  ui.projName.value = project.name;
  renderPractice(); renderTracks(); applyTrackMix(); renderProjectList().catch(() => {});
  requestAnimationFrame(() => { const mc = keyEls[60]; if (mc) ui.kb.parentElement.scrollLeft = mc.offsetLeft - 20; });

  const first = [...new Set(['piano', 'drums', project.chordInstr, project.bassInstr, prefs.recInstr, ...project.tracks.map((t) => t.instr)])];
  let loaded = 0; const total = first.reduce((n, k) => n + A.sampleCount(k), 0);
  A.setProgressHandler(() => { loaded++; if (!ready) ui.play.textContent = `Loading sounds… ${Math.min(100, Math.round(100 * loaded / total))}%`; });
  try {
    await Promise.all(first.map((k) => A.loadInstrument(k)));
    ready = true; updateButtons();
    A.TRACK_INSTR.forEach((k, i) => setTimeout(() => A.loadInstrument(k), 400 + i * 150));
  } catch (e) { ui.play.textContent = 'Could not load sounds'; console.error(e); }

  if (navigator.requestMIDIAccess) {
    try {
      const st = await navigator.permissions.query({ name: 'midi' });
      if (st.state === 'granted') connectMidi();
    } catch (e) {}
  } else {
    ui.midiStatus.textContent = 'No MIDI support in this browser. Use Chrome or Edge on your PC. The on-screen keys still work.';
    ui.midiBtn.hidden = true;
  }
})();
