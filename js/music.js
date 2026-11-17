// Music theory data, styles, and the backing-track event generator.
// Everything here is timed in BEATS so it can drive live playback, recording and export.

export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const SCALES = {
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

export const QUAL = {
  maj: { iv: [0, 4, 7], sfx: '' },
  min: { iv: [0, 3, 7], sfx: 'm' },
  '7': { iv: [0, 4, 7, 10], sfx: '7' },
  m7: { iv: [0, 3, 7, 10], sfx: 'm7' },
  maj7: { iv: [0, 4, 7, 11], sfx: 'maj7' },
  dim: { iv: [0, 3, 6], sfx: 'dim' },
};

// chord = [semitones above key, quality]; every chord lasts one bar
export const PROGS = {
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
  fifths: { name: 'Circle of fifths (minor)', scale: 'minor', key: 9,
    chords: [[0, 'min'], [0, 'min'], [0, 'min'], [0, 'min'], [5, 'min'], [10, 'maj'], [3, 'maj'], [8, 'maj'], [2, 'dim'], [7, '7']] },
  funk:   { name: 'Funk vamp  I7', scale: 'mixolydian', key: 7,
    chords: [[0, '7']] },
};

// sp = steps per beat (4 = 16ths, 3 = triplets → swing feel), bpb = beats per bar.
// Drum strings: one char per step, '.' = rest, '1'..'9' = velocity.
// Bass: [step, degree, lengthInSteps, velocity]. Degrees: R 3 5 6 b7 8 (chord-aware 3rd),
//   A = chromatic approach to the next chord's root.
// Comp: [step, lengthInSteps, velocity]. Pad instruments (strings/organ) just hold the bar.
export const STYLES = {
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

export const chordName = (key, c) => KEY_NAMES[(key + c[0]) % 12] + QUAL[c[1]].sfx;
export const chordPCs = (key, c) => QUAL[c[1]].iv.map((i) => (key + c[0] + i) % 12);

export function voicing(key, c) {
  const root = 48 + ((key + c[0]) % 12);
  return QUAL[c[1]].iv.map((i) => { let m = root + i; if (m < 52) m += 12; return m; });
}
const bassRoot = (key, c) => 33 + (((key + c[0]) % 12) - 9 + 12) % 12; // A1..G#2
function bassNote(key, deg, c, next) {
  const r = bassRoot(key, c);
  if (deg === 'A') { const t = bassRoot(key, next); return t - 1 >= 28 ? t - 1 : t + 1; }
  if (deg === '3') return r + QUAL[c[1]].iv[1];
  return r + DEG[deg];
}

/**
 * Backing events for one bar, with beats relative to the bar start.
 * o = { key, prog, style, chordInstr, bassInstr, chordPad }
 * Returns [{ part: 'drums'|'bass'|'chords', beat, dur, vel, voice? , instr?, m? }]
 */
export function backingBar(o, bar) {
  const S = STYLES[o.style], p = PROGS[o.prog];
  const ci = bar % p.chords.length;
  const c = p.chords[ci], next = p.chords[(ci + 1) % p.chords.length];
  const sb = 1 / S.sp;
  const ev = [];
  for (const [voice, pat] of Object.entries(S.drums)) {
    for (let s = 0; s < pat.length; s++) {
      const ch = pat[s];
      if (ch !== '.') ev.push({ part: 'drums', beat: s * sb, dur: sb, vel: +ch / 9, voice });
    }
  }
  for (const [at, deg, len, vel] of S.bass) {
    ev.push({ part: 'bass', beat: at * sb, dur: len * sb * 0.92, vel, instr: o.bassInstr, m: bassNote(o.key, deg, c, next) });
  }
  const notes = voicing(o.key, c);
  if (o.chordPad && !S.skank) {
    notes.forEach((m) => ev.push({ part: 'chords', beat: 0, dur: S.bpb - 0.02, vel: 0.32, instr: o.chordInstr, m }));
  } else {
    for (const [at, len, vel] of S.comp) {
      notes.forEach((m, i) => ev.push({ part: 'chords', beat: at * sb + i * 0.01, dur: len * sb * 0.9, vel, instr: o.chordInstr, m }));
    }
  }
  return ev;
}

// General MIDI drum note → our drum voice. Notes outside the GM range fold into 36–47
// so any key on any keyboard plays something sensible.
const GM_DRUM = {
  35: 'kick', 36: 'kick', 37: 'rim', 38: 'snare', 39: 'clap', 40: 'snare', 41: 'tom3', 42: 'hat',
  43: 'tom3', 44: 'hat', 45: 'tom2', 46: 'openhat', 47: 'tom2', 48: 'tom1', 49: 'crash', 50: 'tom1',
  51: 'ride', 52: 'crash', 53: 'ride', 54: 'hat', 55: 'crash', 56: 'cowbell', 57: 'crash', 59: 'ride',
};
export function foldDrum(m) {
  if (GM_DRUM[m]) return m;
  if (m >= 35 && m <= 59) return 36 + ((m - 36) % 12);
  return 36 + (((m - 36) % 12) + 12) % 12;
}
export const drumVoiceFor = (m) => GM_DRUM[foldDrum(m)] || 'kick';
// Our drum voice → GM note (for MIDI export of the backing)
export const VOICE_GM = { kick: 36, rim: 37, snare: 38, clap: 39, hat: 42, openhat: 46, crash: 49, ride: 51, cowbell: 56, tom1: 48, tom2: 45, tom3: 41 };
// Labels shown on the on-screen keys when recording drums
export const DRUM_KEY_LABEL = { kick: 'Kick', rim: 'Rim', snare: 'Snr', clap: 'Clap', hat: 'HH', openhat: 'OH', crash: 'Crash', ride: 'Ride', cowbell: 'Bell', tom1: 'Tom1', tom2: 'Tom2', tom3: 'Tom3' };
