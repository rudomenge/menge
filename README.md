# menge.nl

Static portfolio site of Rudo Menge (poster lanes). No build step: Cloudflare Pages serves the repository root as is.

- `index.html` – the whole site
- `img/`, `img/s/` – images, `vid/` – looping videos (every file under 25 MiB, the Cloudflare Pages limit)
- Test panels: not on the live site (no ?test switch); testing happens in the artifact

## Version and visitor counter

Top left the live site shows `version – visitors`, e.g. `1.0 – 123`.

- `VERSION` holds the current version. Every "zet live" raises it by 0.1:
  `python3 tools/make_live.py <downloaded artifact index.html> --bump`
  (the script also applies the live-only edits: page title, test panels hidden for good).
- `functions/api/count.js` (Cloudflare Pages Function) counts each browser once, using a
  localStorage flag, no cookies. It needs a KV namespace bound as `COUNTER` to the Pages
  project; without it the label shows only the version.
