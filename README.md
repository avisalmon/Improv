# Improvise 🎹

A browser-based piano improvisation trainer. You pick a key and a chord progression, the backing track plays, and the on-screen keyboard lights up the notes that fit:

- **Orange:** tones of the current chord. These are safe notes to land on.
- **Blue:** notes in the chosen scale.
- **Red ring:** the root of the key.

**Live:** https://avisalmon.github.io/Improv/

## Features
- 9 styles, each with its own drum groove, bass line and comping rhythm: Pop, Rock, Ballad, Jazz swing (walking bass), Bossa nova, Blues shuffle, Funk, Reggae one-drop and Waltz in 3/4. Choosing a style also sets its tempo and instruments.
- 8 progressions: circle of fifths in minor (Am ×4, Dm, G, C, F, Bdim, E7), pop I–V–vi–IV, jazz ii–V–I, 12-bar blues, minor, Dorian vamp, Andalusian, funk vamp
- 8 scales, plus a practice tip for each one
- Real recorded instruments: Salamander grand piano for you, a choice of piano, electric piano, strings or organ for the chords, upright or electric bass, and an acoustic drum kit
- Mixer with volume and mute for your piano, chords, bass, drums, reverb and master. Settings are remembered in your browser.
- Touch velocity: tapping lower on a key plays louder
- Tempo 50–180 BPM
- Play by touch or mouse (you can slide across the keys), or with the computer keyboard (`A`–`;`, `Z`/`X` to change octave, `Space` to start or stop the backing)

## Tech
Plain HTML, CSS and JS using Web Audio, with no build step and no dependencies. The samples (about 3.6 MB) are in `samples/`.

## Credits
- Piano: Salamander Grand Piano V2 by Alexander Holm, CC-BY 3.0 (via Tone.js audio)
- Electric piano, strings, organ and basses: FluidR3 GM soundfont, CC-BY 3.0 (via gleitz/midi-js-soundfonts)
- Drums: Tone.js audio acoustic kit GitHub Pages serves it from the root of `main`, and every push to `main` redeploys the site.
