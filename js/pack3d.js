// Glimmend 3D-zakje voor Work (Menge 2026-11-07).
// Lagen: img/pack/bag.webp (het zakje, doorzichtig eromheen), het zwarte vlak, type-zwart.svg en type-wit.svg.
// Alles ligt in dezelfde maat als bag.webp (1759 x 3295 in de svg's, nieuw zakje met verticale seal-ribbels). De schuifjes staan in het Work-paneel onder 'Pakje'.
import * as THREE from '../vendor/three.module.min.js';

const W = 1024, H = 1918, S = W / 1759;            // texturemaat en schaal van de svg-maat naar de texture
const BAND = [1236.5 * S, 2066.2 * S];                   // het zwarte vlak, over de hele breedte
const SEAL = [250 * S, 3070 * S];                   // boven en onder: de dichtgeseald randen
const ASPECT = H / W;

const load = src => new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = no; i.src = src; });
const cv = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;

// een kleine fotostudio als omgeving: donkere ruimte met een paar lichtbakken, zodat zwart echt zwart blijft en de glans in lange strepen valt
function studio(renderer) {
  const sc = new THREE.Scene(), box = new THREE.BoxGeometry(1, 1, 1);
  const room = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.BackSide }));
  room.scale.set(14, 10, 14); sc.add(room);
  const lamp = (x, y, z, sx, sy, sz, v) => { const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v) })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); sc.add(m); };
  lamp(-2.6, 1.2, 4.2, .5, 6, .1, 9);     // lange striplight links voor
  lamp(2.9, .4, 3.8, .35, 5, .1, 5);      // striplight rechts
  lamp(0, 4.6, 1.5, 6, .1, 2.2, 3.2);     // softbox boven
  lamp(0, 2.2, 6.8, 5, 3, .1, .9);        // grote zachte lichtbak voor, geeft het zwart een diepe glans
  lamp(-5, 0, -2, .1, 3, 3, 1.4);         // kantlicht achter
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(sc, .02);
  pm.dispose(); return rt.texture;
}

// het aantal kaarten staat live op het pakje, in Neue Haas: '#18 CARDS' (Display 96 Black Italic) en het getal in het rondje (Display 75 Bold)
const TITLE = { font: 'italic 900 182.6px "NHG Display"', x: 867.48, y: 637.21 }, BADGE = { size: 109.9, font: '700 {s}px "NHG Display"', x: 232.04, y: 2805.59, max: 163.1 };
export function drawCount(x, n, mode) {   // x: 2d-context in de svg-maat (1759 breed); mode 'title' | 'badge' | 'cut'
  x.save(); x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  if (mode === 'title') { x.font = TITLE.font; x.fillText(`#${n} CARDS`, TITLE.x, TITLE.y); }
  else { let s = BADGE.size; x.font = BADGE.font.replace('{s}', s); const w = x.measureText(String(n)).width; if (w > BADGE.max) { s *= BADGE.max / w; x.font = BADGE.font.replace('{s}', s.toFixed(1)); }
    x.fillText(String(n), BADGE.x, BADGE.y - (BADGE.size - s) * .36); }
  x.restore();
}
export async function makePack(base = '', count = 18) {
  const [bag, tw, tb] = await Promise.all([load(base + 'img/pack/bag.webp'), load(base + 'img/pack/type-wit.svg'), load(base + 'img/pack/type-zwart.svg')]);
  try { await Promise.all([document.fonts.load(TITLE.font), document.fonts.load('700 110px "NHG Display"')]); } catch (e) {}
  // ---- maskers uit de lagen ----
  const grab = (img, filter, extra) => { const c = cv(), x = c.getContext('2d', { willReadFrequently: true }); if (filter) x.filter = filter; x.drawImage(img, 0, 0, W, H); if (extra) { x.save(); x.scale(S, S); extra(x); x.restore(); } return x.getImageData(0, 0, W, H).data; };
  const B = grab(bag), Bl = grab(bag, 'blur(14px)');
  const n = W * H, A = new Float32Array(n), L = new Float32Array(n), HP = new Float32Array(n), mW = new Float32Array(n), mB = new Float32Array(n), hW = new Float32Array(n), hB = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    A[i] = B[j + 3] / 255; L[i] = (B[j] * .3 + B[j + 1] * .59 + B[j + 2] * .11) / 255;
    HP[i] = L[i] - (Bl[j] * .3 + Bl[j + 1] * .59 + Bl[j + 2] * .11) / 255;   // de kreukels: wat lichter of donkerder is dan de omgeving
  }
  // gemiddelde helderheid van het zakje zelf (tussen de seals), zodat de kreukels rond nul schommelen
  let LM = 0, LN = 0; for (let y = (SEAL[0] + 40) | 0; y < SEAL[1] - 40; y += 4) for (let x = 80; x < W - 80; x += 4) { const i = y * W + x; if (A[i] > .9) { LM += L[i]; LN++; } } LM = LN ? LM / LN : .35;
  // extra kreukels: een netwerk van scherpe vouwen (ridged noise), vooral in de lengte zoals bij een foliezakje
  const CR = new Float32Array(n);
  { const rnd = (() => { let a = 1234567; return () => (a = (a * 1664525 + 1013904223) >>> 0) / 4294967296; })();
    const oct = [[70, 1], [34, .55], [16, .3]];
    for (const [cell, amp] of oct) {
      const gw = Math.ceil(W / (cell * .45)) + 2, gh = Math.ceil(H / (cell * 1.6)) + 2, G = new Float32Array(gw * gh); for (let k = 0; k < G.length; k++) G[k] = rnd();
      const sx = cell * .45, sy = cell * 1.6;
      for (let y = 0, i = 0; y < H; y++) { const fy = y / sy, y0 = fy | 0, ty = fy - y0, uy = ty * ty * (3 - 2 * ty);
        for (let x = 0; x < W; x++, i++) { const fx = x / sx + y * .004, x0 = fx | 0, tx = fx - x0, ux = tx * tx * (3 - 2 * tx), r0 = y0 * gw + x0, r1 = r0 + gw;
          const v = (G[r0] * (1 - ux) + G[r0 + 1] * ux) * (1 - uy) + (G[r1] * (1 - ux) + G[r1 + 1] * ux) * uy;
          CR[i] += (1 - Math.abs(v * 2 - 1)) * amp; } } }
    for (let i = 0; i < n; i++) CR[i] = Math.pow(CR[i] / 1.85, 3) - .2; }
  let cnt = count;
  function typeMasks() {
    const wx = x => { x.fillStyle = '#fff'; drawCount(x, cnt, 'title'); x.globalCompositeOperation = 'destination-out'; drawCount(x, cnt, 'badge'); };   // het getal is uit het witte rondje gesneden
    const bx = x => { x.fillStyle = '#000'; drawCount(x, cnt, 'badge'); };
    const TW = grab(tw, null, wx), TB = grab(tb, null, bx), TWb = grab(tw, 'blur(1.2px)', wx), TBb = grab(tb, 'blur(1.2px)', bx);
    for (let i = 0, j = 3; i < n; i++, j += 4) { mW[i] = TW[j] / 255; mB[i] = TB[j] / 255; hW[i] = TWb[j] / 255; hB[i] = TBb[j] / 255; }
  }
  typeMasks();
  const cA = cv(), cO = cv(), cH = cv(), xA = cA.getContext('2d'), xO = cO.getContext('2d'), xH = cH.getContext('2d');
  const iA = xA.createImageData(W, H), iO = xO.createImageData(W, H), iH = xH.createImageData(W, H);

  // ---- three ----
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  const canvas = renderer.domElement; canvas.className = 'pk-gl';
  const scene = new THREE.Scene(); scene.environment = studio(renderer);
  const cam = new THREE.PerspectiveCamera(24, 1, .1, 50);
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); t.flipY = true; return t; };
  const tA = tex(cA, true), tO = tex(cO, false), tH = tex(cH, false);
  const mat = new THREE.MeshPhysicalMaterial({ map: tA, roughnessMap: tO, metalnessMap: tO, clearcoatMap: tO, clearcoatRoughnessMap: tO, bumpMap: tH,
    roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: 1, transparent: true, alphaTest: .03, side: THREE.DoubleSide });
  const seg = [120, 200], geo = new THREE.PlaneGeometry(1, ASPECT, seg[0], seg[1]), pos = geo.attributes.position, flat = Float32Array.from(pos.array);
  const mesh = new THREE.Mesh(geo, mat); scene.add(mesh);
  const key = new THREE.DirectionalLight(0xffffff, 1.2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, .5); rim.position.set(-2, 1, -1); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, .05));

  const P = { crk: 0, met: 0, bandC: '#000000', bagC: '#000000', tC: '#000000', bag: .05, fold: .6, bagG: .72, env: 1, bandA: .7, bandK: .02, bandG: .35, tK: 0, tG: 1, tH: .4, wV: .94, wG: .5, bulge: .5, key: 1 };
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  function shape() {   // het zakje bol blazen: midden het dikst, de seals plat
    const bz = P.bulge * .075;
    for (let i = 0; i < pos.count; i++) {
      const x = flat[i * 3], y = flat[i * 3 + 1], u = x + .5, v = .5 - y / ASPECT;
      const fx = Math.pow(Math.max(0, 1 - Math.pow(2 * u - 1, 2)), .55);
      const vy = v * H, fy = smooth(SEAL[0] - 10, SEAL[0] + 120, vy) * (1 - smooth(SEAL[1] - 120, SEAL[1] + 10, vy));
      const ripple = Math.sin(u * 9.4 + v * 3) * .06 + Math.sin(v * 13 - u * 5) * .04;   // een beetje golving, folie is nooit strak
      pos.array[i * 3 + 2] = bz * fx * fy * (1 + ripple);
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
  }
  function maps() {
    const a = iA.data, o = iO.data, h = iH.data;
    const rough = g => .03 + (1 - g) * .72;
    // kleur: het kleurvakje geeft de tint, 'hoe zwart' mengt er grijs doorheen (zwart vakje + 0 = het diepste zwart)
    const hex = c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16) / 255);
    const mix = (c3, t, k) => { for (let q = 0; q < 3; q++) c3[q] = c3[q] * (1 - k) + t[q] * k; }, bk = hex(P.bandC).map(x => P.bandK + x * (1 - P.bandK)), wv = [P.wV, P.wV, P.wV];
    const sa = Math.min(1, Math.max(...hex(P.bagC)) * 1.6);   // hoe gekleurd het zakje is: zwart laat de zilvergrijze seals zoals ze waren
    const bc = hex(P.bagC).map(x => P.bag + x * (1 - P.bag)), tc = hex(P.tC).map(x => P.tK + x * (1 - P.tK));
    for (let y = 0, i = 0; y < H; y++) {
      const band = y >= BAND[0] && y < BAND[1], seal = y < SEAL[0] || y > SEAL[1];
      for (let x = 0; x < W; x++, i++) {
        const j = i * 4, l = L[i];
        const ck = CR[i] * P.crk; let r, cc, me, ht = .5 + HP[i] * P.fold * 2.2 + ck * .22;
        let c3;
        // seals: in de kleur van het zakje, met de krimp-ribbels erin
        if (seal) { const v = .06 + l * .6 * .35 / LM, sv = (l - LM) * .55; c3 = [0, 1, 2].map(q => v * (1 - sa) + clamp(bc[q] * 1.1 + sv) * sa); r = .3; cc = .6; me = .55; ht = .5 + HP[i] * 2.4; }
        else {
          const f = (l - LM) * P.fold * .22 + ck * .03; c3 = [bc[0] + f, bc[1] + f, bc[2] + f]; r = rough(P.bagG); cc = P.bagG; me = 0;
          if (band) { const k = P.bandA; mix(c3, bk, k); r = r * (1 - k) + rough(P.bandG) * k; cc = cc * (1 - k) + P.bandG * k; }
          const b = mB[i], w = mW[i];
          if (b) { mix(c3, tc, b); r = r * (1 - b) + rough(P.tG) * b; cc = cc * (1 - b) + P.tG * b; }
          if (P.met) { const m = P.met; for (let q = 0; q < 3; q++) c3[q] = c3[q] * (1 - m) + (.42 + clamp(c3[q]) * .58) * m; me = m; r *= 1 - m * .5; }   // metallic: spiegelzilver schemert door de kleur heen
          if (w) { mix(c3, wv, w); me *= 1 - w; r = r * (1 - w) + rough(P.wG) * w; cc = cc * (1 - w) + P.wG * .35 * w; }
          ht += (hB[i] + hW[i]) * P.tH * .5;
        }
        a[j] = clamp(c3[0]) * 255; a[j + 1] = clamp(c3[1]) * 255; a[j + 2] = clamp(c3[2]) * 255; a[j + 3] = A[i] * 255;
        o[j] = clamp(cc) * 255; o[j + 1] = clamp(r) * 255; o[j + 2] = me * 255; o[j + 3] = 255;
        h[j] = h[j + 1] = h[j + 2] = clamp(ht) * 255; h[j + 3] = 255;
      }
    }
    xA.putImageData(iA, 0, 0); xO.putImageData(iO, 0, 0); xH.putImageData(iH, 0, 0);
    tA.needsUpdate = tO.needsUpdate = tH.needsUpdate = true;
  }
  let pend = 0;
  function set(p) {
    const sh = 'bulge' in p && p.bulge !== P.bulge; Object.assign(P, p);
    mat.envMapIntensity = P.env * 1.6; key.intensity = P.key * 1.2; mat.bumpScale = 1.6;
    if (sh) shape();
    if (!pend) pend = requestAnimationFrame(() => { pend = 0; maps(); api.render(); });
  }
  let rx = 0, ry = 0, tx = 0, ty = 0, raf = 0, w0 = 0, h0 = 0;
  const api = {
    canvas, P, flat: cA,
    size(w, h) {   // w x h = het vakje van het pakje; het canvas is ruimer zodat er bij draaien niets afvalt
      const dpr = Math.min(2, devicePixelRatio || 1), cw = Math.round(w * 1.4), ch = Math.round(h * 1.4);
      if (cw === w0 && ch === h0) return; w0 = cw; h0 = ch;
      renderer.setPixelRatio(dpr); renderer.setSize(cw, ch, false);
      cam.aspect = cw / ch; const vis = ASPECT * 1.4;   // het zakje vult precies het vakje
      cam.position.set(0, 0, vis / 2 / Math.tan(cam.fov * Math.PI / 360)); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
      api.render();
    },
    tilt(x, y) { tx = x; ty = y; },
    render() {
      key.position.set(1.4 - ry * 1.5, 1.6 + rx * 1.2, 2.6);
      mesh.rotation.set(rx, ry, 0); renderer.render(scene, cam);
    },
    start() { if (raf) return; const loop = () => { raf = requestAnimationFrame(loop); rx += (tx - rx) * .12; ry += (ty - ry) * .12; api.render(); }; loop(); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    snap() { rx = ry = tx = ty = 0; api.render(); return canvas.toDataURL('image/png'); },
    set,
    count(c) { if (c === cnt || !c) return; cnt = c; typeMasks(); maps(); api.render(); },
  };
  shape(); set({});
  maps();
  return api;
}
