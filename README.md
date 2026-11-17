# Improvise 🎹

An improvisation trainer and multitrack MIDI studio that runs in the browser.

**Live:** https://avisalmon.github.io/Improv/

## Practice
You pick a style, key and progression, a backing band plays, and the keyboard marks which notes fit:

- **Orange:** tones of the current chord. These are safe notes to land on.
- **Blue:** notes in the chosen scale.
- **Red ring:** the root of the key.

There are 9 styles (Pop, Rock, Ballad, Jazz swing, Bossa nova, Blues shuffle, Funk, Reggae and Waltz), 8 progressions (including a minor circle of fifths) and 8 scales, each scale with a practice tip. A mixer sets the volume of the live input, chords, bass, drums, reverb and master.

## Studio: record your own song
1. Connect a MIDI keyboard (Chrome or Edge), or use the on-screen keys or your computer keyboard.
2. Under **Record with**, choose an instrument: grand piano, electric piano, organ, strings, vibraphone, classical or electric guitar, alto or tenor sax, trumpet, flute, synth lead, upright or electric bass, or drum kit. In drum mode the keys follow the General MIDI drum map.
3. Press **● Record new track** (or Enter). After a one-bar count-in you record once through the song over the backing, with the earlier tracks playing along.
4. Repeat with other instruments. Each track has a name, instrument, volume, **M**ute, **S**olo, **Q**uantize, **⟲** re-record and **✕** delete.
5. Export a **WAV** audio mix or a multitrack **MIDI** file, with or without the backing.

The sustain pedal is supported. The **Timing offset** slider compensates if your recorded notes land slightly early or late.

Songs are saved automatically in the browser (IndexedDB). Use **Backup song** and **Import song** to keep copies or move songs between computers.

## Tech
Plain HTML, CSS and ES modules on Web Audio and Web MIDI, with no build step and no dependencies. GitHub Pages serves it from the root of `main`.

- `js/music.js`: theory, styles and the backing-pattern generator (timed in beats)
- `js/audio.js`: sample loading, voices, mixer graph (shared by live playback and offline WAV rendering)
- `js/export.js`: Standard MIDI File writer and WAV encoder
- `js/store.js`: IndexedDB song storage
- `js/app.js`: transport, recording, MIDI input and UI

## Credits
- Piano: Salamander Grand Piano V2 by Alexander Holm, CC-BY 3.0 (via Tone.js audio)
- Other instruments: FluidR3 GM soundfont, CC-BY 3.0 (via gleitz/midi-js-soundfonts)
- Drums: Tone.js audio acoustic kit, and crash, clap and cowbell from the OLPC Berklee sound library (CC-BY 3.0)
