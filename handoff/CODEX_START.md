# Codex quick start

Paste the prompt below into a new Codex task after cloning the repository.

```text
You are continuing development of Audio Visual Lab.

Repository: https://github.com/haodman/Audio-Visual-Lab
Local entry: http://127.0.0.1:8765/music-fx-lab.html
Public experience: https://haodman.com/audio-visual-lab/

Before changing code, read AGENTS.md, README.md, handoff/PROJECT_STATE.md,
handoff/DESIGN_DECISIONS.md, handoff/QA_CHECKLIST.md, and design-qa.md.

This is a local-first music-reactive visual-effect workbench. Preserve the
existing page structure, phone preview, material library, music library, shared
right-side drawer, and all existing effects unless the request explicitly says
otherwise. Effects must visibly react to real audio features such as kick,
snare, high frequency, bass, beat, energy, section, or drop.

Edit src/app.html and src/app.js, then run node --check src/app.js,
python3 src/build.py, and git diff --check. Start a local server on port 8765
and visually test the actual interaction in the browser. Do not claim success
from a build alone. Do not deploy until I explicitly request deployment.

First inspect the current branch and working tree, then summarize your
understanding of the requested change in 3-5 concise lines and implement it.
```

## First commands

```bash
git clone https://github.com/haodman/Audio-Visual-Lab.git
cd Audio-Visual-Lab
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/music-fx-lab.html`.

For a change branch:

```bash
git pull --rebase origin main
git switch -c feature/short-description
```

## What to attach to a new Codex task

- The exact reference image or video when requesting a visual effect.
- A screenshot of the current bad state.
- The relevant song or test material when timing matters.
- A statement saying whether the request is local-only or should also deploy.
- Concrete feedback such as “too fast,” “mask edge is rough,” or “should react to kick,” rather than only “looks wrong.”
