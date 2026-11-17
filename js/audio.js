// Sample loading and playback. Works with the live AudioContext and with an
// OfflineAudioContext (for WAV export) — decoded AudioBuffers are shared.

const PC = { C: 0, Db: 1, D: 2, Ds: 3, Eb: 3, E: 4, F: 5, Fs: 6, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const grid = (names, octaves, extra = []) => octaves.flatMap((o) => names.map((n) => n + o)).concat(extra);
const FL = ['C', 'Eb', 'Gb', 'A'];

// gm = General MIDI program number used for MIDI export
export const INSTR = {
  piano:     { label: 'Grand piano',     dir: 'piano',     gm: 0,  notes: grid(['C', 'Ds', 'Fs', 'A'], [1, 2, 3, 4, 5, 6, 7], ['C8']), release: 0.35 },
  epiano:    { label: 'Electric piano',  dir: 'epiano',    gm: 4,  notes: grid(FL, [2, 3, 4, 5]), release: 0.3 },
  organ:     { label: 'Organ',           dir: 'organ',     gm: 16, notes: grid(FL, [2, 3, 4, 5]), release: 0.12, pad: true },
  strings:   { label: 'Strings',         dir: 'strings',   gm: 48, notes: grid(FL, [2, 3, 4, 5]), release: 0.7, attack: 0.15, pad: true },
  vibes:     { label: 'Vibraphone',      dir: 'vibes',     gm: 11, notes: grid(FL, [3, 4, 5, 6], ['C7']), release: 0.6 },
  nylon:     { label: 'Classical guitar', dir: 'nylon',    gm: 24, notes: grid(FL, [2, 3, 4, 5], ['C6']), release: 0.25 },
  eguitar:   { label: 'Electric guitar', dir: 'eguitar',   gm: 27, notes: grid(FL, [2, 3, 4, 5], ['C6']), release: 0.2 },
  altosax:   { label: 'Alto sax',        dir: 'altosax',   gm: 65, notes: grid(FL, [3, 4, 5], ['C6']), release: 0.12, attack: 0.02 },
  tenorsax:  { label: 'Tenor sax',       dir: 'tenorsax',  gm: 66, notes: grid(FL, [2, 3, 4], ['C5']), release: 0.12, attack: 0.02 },
  trumpet:   { label: 'Trumpet',         dir: 'trumpet',   gm: 56, notes: grid(FL, [3, 4, 5], ['C6']), release: 0.1, attack: 0.015 },
  flute:     { label: 'Flute',           dir: 'flute',     gm: 73, notes: grid(FL, [4, 5, 6], ['C7']), release: 0.12, attack: 0.03 },
  synthlead: { label: 'Synth lead',      dir: 'synthlead', gm: 80, notes: grid(FL, [2, 3, 4, 5, 6], ['C7']), release: 0.1 },
  upright:   { label: 'Upright bass',    dir: 'upright',   gm: 32, notes: grid(FL, [1, 2, 3], ['C4']), release: 0.15 },
  ebass:     { label: 'Electric bass',   dir: 'ebass',     gm: 33, notes: grid(FL, [1, 2, 3], ['C4']), release: 0.1 },
  drums:     { label: 'Drum kit', drums: true },
};
export const CHORD_INSTR = ['piano', 'epiano', 'strings', 'organ'];
export const BASS_INSTR = ['upright', 'ebass'];
export const TRACK_INSTR = ['piano', 'epiano', 'organ', 'strings', 'vibes', 'nylon', 'eguitar', 'altosax', 'tenorsax', 'trumpet', 'flute', 'synthlead', 'upright', 'ebass', 'drums'];

// voice → [sample file, playbackRate, cut-off seconds (0 = natural), gain]
const DRUM_VOICE = {
  kick: ['kick', 1, 0, 1], snare: ['snare', 1, 0, 1], hat: ['hihat', 1, 0, 1],
  rim: ['snare', 1.9, 0.07, 0.9], ride: ['hihat', 0.62, 0, 0.9],
  openhat: ['crash', 2.3, 0.45, 0.45], crash: ['crash', 1, 0, 0.8],
  clap: ['clap', 1, 0, 0.9], cowbell: ['cowbell', 1, 0, 0.7],
  tom1: ['tom1', 1, 0, 1], tom2: ['tom2', 1, 0, 1], tom3: ['tom3', 1, 0, 1],
};
const DRUM_FILES = ['kick', 'snare', 'hihat', 'crash', 'clap', 'cowbell', 'tom1', 'tom2', 'tom3'];

const AC = window.AudioContext || window.webkitAudioContext;
export const ctx = new AC({ latencyHint: 'interactive' });

const buffers = {};   // instrument -> [{midi, buf}] sorted
const loading = {};
let drumBufs = null, drumLoading = null;
let onProgress = () => {};
export function setProgressHandler(fn) { onProgress = fn; }

const noteToMidi = (n) => { const m = n.match(/^([A-G][sb]?)(\d)$/); return 12 * (+m[2] + 1) + PC[m[1]]; };

async function fetchBuf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const ab = await r.arrayBuffer();
  return await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
}
export function sampleCount(name) { return INSTR[name].drums ? DRUM_FILES.length : INSTR[name].notes.length; }
export function loadInstrument(name) {
  if (INSTR[name].drums) return loadDrums();
  if (loading[name]) return loading[name];
  const ins = INSTR[name];
  loading[name] = Promise.all(ins.notes.map(async (n) => {
    const buf = await fetchBuf(`samples/${ins.dir}/${n}.mp3`);
    onProgress();
    return { midi: noteToMidi(n), buf };
  })).then((list) => { buffers[name] = list.sort((a, b) => a.midi - b.midi); return list; });
  return loading[name];
}
export function loadDrums() {
  if (drumLoading) return drumLoading;
  drumLoading = Promise.all(DRUM_FILES.map((n) => fetchBuf(`samples/drums/${n}.mp3`).then((b) => { onProgress(); return [n, b]; })))
    .then((l) => { drumBufs = Object.fromEntries(l); });
  return drumLoading;
}
export const isLoaded = (name) => (INSTR[name].drums ? !!drumBufs : !!buffers[name]);

// ---------- Graph ----------
export const curve = (v) => v * v * 1.6; // slider 0..1 → gain

function makeIR(c) {
  const len = Math.floor(c.sampleRate * 2.4), b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return b;
}

/** Build master chain + reverb. Returns { master, reverbIn, reverbOut, channel(sendLevel) } */
export function makeGraph(c) {
  const master = c.createGain();
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3;
  master.connect(comp); comp.connect(c.destination);
  const reverbIn = c.createConvolver();
  reverbIn.buffer = makeIR(c);
  const reverbOut = c.createGain();
  reverbIn.connect(reverbOut); reverbOut.connect(master);
  function channel(send) {
    const g = c.createGain(); g.connect(master);
    const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(reverbIn);
    return g;
  }
  return { c, master, reverbIn, reverbOut, channel };
}

// ---------- Voices ----------
export function playNote(c, instr, midi, time, vel, dest, dur) {
  const list = buffers[instr]; if (!list) return null;
  let best = list[0];
  for (const s of list) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
  const ins = INSTR[instr];
  const src = c.createBufferSource();
  src.buffer = best.buf;
  src.playbackRate.value = Math.pow(2, (midi - best.midi) / 12);
  const g = c.createGain();
  const atk = ins.attack || 0.004;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(vel, time + atk);
  src.connect(g); g.connect(dest);
  src.start(time);
  const h = { c, src, g, rel: ins.release };
  if (dur != null) releaseNote(h, time + Math.max(dur, atk + 0.01));
  return h;
}
export function releaseNote(h, time) {
  const t = Math.max(time, h.c.currentTime);
  h.g.gain.cancelScheduledValues(t);
  h.g.gain.setTargetAtTime(0, t, h.rel / 4);
  try { h.src.stop(t + h.rel * 2 + 0.05); } catch (e) {}
}
export function playDrum(c, voice, time, vel, dest) {
  if (!drumBufs) return;
  const [buf, rate, cut, gain] = DRUM_VOICE[voice] || DRUM_VOICE.kick;
  const s = c.createBufferSource(); s.buffer = drumBufs[buf]; s.playbackRate.value = rate;
  const g = c.createGain(); g.gain.setValueAtTime(vel * gain, time);
  if (cut) g.gain.setTargetAtTime(0, time + cut * 0.3, cut / 3);
  s.connect(g); g.connect(dest); s.start(time);
}
export function click(c, time, accent, dest) {
  const o = c.createOscillator(); o.frequency.value = accent ? 1760 : 1175;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
  o.connect(g); g.connect(dest); o.start(time); o.stop(time + 0.08);
}
