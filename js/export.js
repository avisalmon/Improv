// File writers: Standard MIDI File (type 1) and 16-bit WAV.

const PPQ = 480;

function vlq(n) {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}
const str = (s) => [...new TextEncoder().encode(s)];
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >>> 8) & 255, n & 255];

function chunk(type, data) { return [...str(type), ...u32(data.length), ...data]; }

function trackChunk(events) {
  // events: [{tick, data:[...bytes]}]; sorted, note-offs before note-ons at same tick
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const out = []; let last = 0;
  for (const e of events) { out.push(...vlq(Math.max(0, e.tick - last)), ...e.data); last = e.tick; }
  out.push(0, 0xff, 0x2f, 0x00);
  return chunk('MTrk', out);
}

/**
 * song = { name, bpm, bpb, tracks: [{ name, channel, program, notes: [[beat, dur, midi, vel0..1]] }] }
 */
export function buildMidi(song) {
  const tempo = Math.round(60000000 / song.bpm);
  const meta = [
    { tick: 0, order: 0, data: [0xff, 0x03, ...vlq(str(song.name).length), ...str(song.name)] },
    { tick: 0, order: 0, data: [0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255] },
    { tick: 0, order: 0, data: [0xff, 0x58, 0x04, song.bpb, 2, 24, 8] },
  ];
  const chunks = [trackChunk(meta)];
  for (const t of song.tracks) {
    const ch = t.channel & 15;
    const ev = [{ tick: 0, order: 0, data: [0xff, 0x03, ...vlq(str(t.name).length), ...str(t.name)] }];
    if (ch !== 9) ev.push({ tick: 0, order: 0, data: [0xc0 | ch, t.program & 127] });
    for (const [beat, dur, m, vel] of t.notes) {
      const on = Math.round(beat * PPQ), off = Math.max(on + 1, Math.round((beat + dur) * PPQ));
      const v = Math.max(1, Math.min(127, Math.round(vel * 127)));
      ev.push({ tick: on, order: 2, data: [0x90 | ch, m & 127, v] });
      ev.push({ tick: off, order: 1, data: [0x80 | ch, m & 127, 0] });
    }
    chunks.push(trackChunk(ev));
  }
  const header = chunk('MThd', [...u16(1), ...u16(chunks.length), ...u16(PPQ)]);
  return new Uint8Array([...header, ...chunks.flat()]);
}

export function encodeWav(audioBuffer) {
  const nch = audioBuffer.numberOfChannels, sr = audioBuffer.sampleRate, len = audioBuffer.length;
  const data = new DataView(new ArrayBuffer(44 + len * nch * 2));
  const w = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); data.setUint32(4, 36 + len * nch * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, nch, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * nch * 2, true); data.setUint16(32, nch * 2, true); data.setUint16(34, 16, true);
  w(36, 'data'); data.setUint32(40, len * nch * 2, true);
  const chans = [...Array(nch)].map((_, i) => audioBuffer.getChannelData(i));
  // normalise to -1 dBFS peak so quiet mixes are still usable
  let peak = 0;
  for (const d of chans) for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  const gain = peak > 0 ? Math.min(4, 0.89 / peak) : 1;
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i] * gain));
      data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
    }
  }
  return new Blob([data], { type: 'audio/wav' });
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
