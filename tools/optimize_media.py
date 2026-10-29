"""Make the images and videos lighter for the live site (runs as part of make_live.py).

usage: python3 tools/optimize_media.py

- img/t/   lane-sized copies of img/s/ for the moving lanes on the homepage (max 720 px high,
           enough for a sharp tile on retina and phone screens). img/s/ stays as it is: Cases
           and the large views still use the full size.
- vid/     videos re-encoded in place: lane videos 640 px without sound, Cases videos at
           their own size, both with the index at the front so they start playing right away.
- img/case/, vid/*.jpg   re-saved as progressive JPEG (only kept when clearly smaller).

Files done before are listed in tools/media.json with the checksum of the result, so a
second run (or a run after "zet live" copied the same files again) skips them and never
compresses an image twice. A file that changed is done again.
"""
import hashlib, json, pathlib, shutil, subprocess, tempfile
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
mf = root / 'tools' / 'media.json'
done = json.loads(mf.read_text()) if mf.exists() else {}
sha = lambda p: hashlib.sha1(p.read_bytes()).hexdigest()[:16]
LANE_H = 720          # tile height on the wall, in device pixels, with room to spare
CASE_VIDEOS = {'tattoo-promo-2025', 'serrano-showreel-hd'}   # full screen in Cases


def jpeg(im, out, q):
    im.convert('RGB').save(out, 'JPEG', quality=q, optimize=True, progressive=True, subsampling='4:2:0')


def lane_images():
    (root / 'img/t').mkdir(exist_ok=True)
    n = 0
    for src in sorted((root / 'img/s').glob('*.jpg')):
        out = root / 'img/t' / src.name
        key = 'img/t/' + src.name
        if out.exists() and done.get(key) == sha(src):
            continue
        im = Image.open(src)
        if im.height > LANE_H:
            im = im.resize((round(im.width * LANE_H / im.height), LANE_H), Image.LANCZOS)
        jpeg(im, out, 80)
        done[key] = sha(src); n += 1
    # copies whose original is gone
    for out in (root / 'img/t').glob('*.jpg'):
        if not (root / 'img/s' / out.name).exists():
            out.unlink(); done.pop('img/t/' + out.name, None)
    return n


def resave(p, q):
    key = str(p.relative_to(root))
    if done.get(key) == sha(p):
        return 0
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as t:
        tmp = pathlib.Path(t.name)
    jpeg(Image.open(p), tmp, q)
    if tmp.stat().st_size < p.stat().st_size * .9:
        shutil.move(tmp, p)
    else:
        tmp.unlink()
    done[key] = sha(p)
    return 1


def video(p):
    key = str(p.relative_to(root))
    if done.get(key) == sha(p):
        return 0
    case = p.stem in CASE_VIDEOS
    # lane: small tile, so a lower bitrate looks the same; Cases: full screen, keep it crisp
    args = ['-crf', '24', '-maxrate', '3M', '-bufsize', '6M'] if case else \
           ['-crf', '27', '-maxrate', '1.2M', '-bufsize', '2.4M', '-vf', "scale='min(640,iw)':-2"]
    tmp = p.with_suffix('.tmp.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(p), '-an', '-c:v', 'libx264', '-preset', 'slow',
                    '-profile:v', 'high', '-pix_fmt', 'yuv420p', *args, '-movflags', '+faststart', str(tmp)], check=True)
    if tmp.stat().st_size < p.stat().st_size * .9:
        shutil.move(tmp, p)
    else:
        tmp.unlink()
    done[key] = sha(p)
    return 1


if __name__ == '__main__':
    before = sum(f.stat().st_size for d in ('img', 'vid') for f in (root / d).rglob('*') if f.is_file() and '/img/t/' not in str(f))
    n = lane_images()
    n += sum(resave(p, 84) for p in sorted((root / 'img/case').glob('*.jpg')))
    n += sum(resave(p, 82) for p in sorted((root / 'vid').glob('*.jpg')))
    n += sum(video(p) for p in sorted((root / 'vid').glob('*.mp4')) if not p.name.endswith('.tmp.mp4'))
    mf.write_text(json.dumps(dict(sorted(done.items())), indent=1) + '\n')
    after = sum(f.stat().st_size for d in ('img', 'vid') for f in (root / d).rglob('*') if f.is_file() and '/img/t/' not in str(f))
    lane = sum(f.stat().st_size for f in (root / 'img/t').glob('*.jpg'))
    print(f'{n} files done; img+vid {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB; lane images img/t {lane / 1e6:.1f} MB (img/s {sum(f.stat().st_size for f in (root / "img/s").glob("*.jpg")) / 1e6:.1f} MB)')
