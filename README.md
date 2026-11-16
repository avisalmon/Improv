# Improvise 🎹

A browser-based piano improvisation trainer. You pick a key and a chord progression, the backing track plays, and the on-screen keyboard lights up the notes that fit:

- **Orange:** tones of the current chord. These are safe notes to land on.
- **Blue:** notes in the chosen scale.
- **Red ring:** the root of the key.

**Live:** https://avisalmon.github.io/Improv/

## Features
- 7 progressions: pop I–V–vi–IV, jazz ii–V–I, 12-bar blues, minor, Dorian vamp, Andalusian, funk vamp
- 8 scales, plus a practice tip for each one
- Backing track with pad chords, bass and hi-hat, tempo 50–180 BPM
- Play by touch or mouse (you can slide across the keys), or with the computer keyboard (`A`–`;`, `Z`/`X` to change octave, `Space` to start or stop the backing)

## Tech
Plain HTML, CSS and JS using Web Audio, with no build step and no dependencies. GitHub Pages serves it from the root of `main`, and every push to `main` redeploys the site.
