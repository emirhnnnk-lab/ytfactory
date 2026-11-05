// usage:
//   node src/render/render.js <videoDir> <style> <lang> video
//   node src/render/render.js <videoDir> <style> <lang> stills 8.0,17.0,29.5
const fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const { Resvg } = require('@resvg/resvg-js');
const L = require('./lib'), STYLES = require('./styles');

const [, , vdirArg, styleKey, lang = 'tr', mode = 'video', arg] = process.argv;
const vdir = path.resolve(vdirArg), st = STYLES[styleKey];
if (!st) throw new Error('unknown style ' + styleKey);
const tl = JSON.parse(fs.readFileSync(path.join(vdir, `audio_${lang}`, 'timeline.json'), 'utf8'));
const T = Object.fromEntries(tl.lines.map(l => [l.id, l]));
const scenes = require(path.join(vdir, 'scenes.js'));
if (scenes.format === 'landscape') L.setFrame(1920, 1080);   // long-form: scenes.js sets module.exports.format
const FPS = 30, { W, H } = L;
const TAIL = .5, DUR = tl.duration + TAIL;
const outDir = path.join(vdir, 'out'); fs.mkdirSync(outDir, { recursive: true });

// scene i is active from its line's start until the next scene's line starts
const starts = scenes.map((s, i) => i === 0 ? 0 : T[s.from].start - .08);
function sceneAt(t) { let i = 0; while (i + 1 < scenes.length && t >= starts[i + 1]) i++; return i; }

// subtitles: each line split into chunks; a chunk starts exactly when its first word is spoken
const subs = [];
for (const ln of tl.lines) {
  const chunks = L.chunkLine(ln.text);
  const cum = []; let c = 0;
  for (const w of ln.words) { cum.push(c); c += L.normW(w.w).length; }
  let off = 0;
  const starts2 = chunks.map(ch => { const i = cum.findIndex(x => x >= off - 1); off += L.normW(ch.replace(/\s+/g, '')).length; return ln.words[Math.max(0, i)].start; });
  chunks.forEach((ch, i) => subs.push({ id: ln.id, text: ch, start: starts2[i], end: i + 1 < chunks.length ? starts2[i + 1] : ln.end }));
}
const subAt = t => subs.find(s => t >= s.start - .05 && t < s.end + .12);

const resvgOpts = (bg) => ({ fitTo: { mode: 'original' }, background: bg, font: { fontFiles: st.fontFiles, loadSystemFonts: false, defaultFontFamily: st.font.sub } });

function frameSvg(t, frame) {
  const i = sceneAt(t), sc = scenes[i], ls = t - starts[i];
  const nextStart = starts[i + 1] ?? DUR;
  const z = 1 + .035 * L.easeInOut(L.clamp(ls / Math.max(1, nextStart - starts[i])));   // slow push-in per scene
  const pop = 1 + .03 * (1 - L.easeOut(L.clamp(ls / .25)));                           // tiny punch on each cut
  const k = z * pop;
  let body = sc.draw(st, t, T);
  if (st.mode === 'line') body = `<g filter="url(#wob)">${body}</g>`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${L.defs(st, frame)}`;
  s += `<g transform="translate(${W / 2},${H / 2}) scale(${k}) translate(${-W / 2},${-H / 2})">${body}</g>`;
  if (sc.sub) { const su = subAt(t); if (su && T[sc.from] && su.id !== undefined) s += L.subtitle(st, su.text, t - su.start); }
  return s + '</svg>';
}

function bgPng() {
  const f = path.join(outDir, `bg_${st.key}_${W}x${H}.png`);
  fs.writeFileSync(f, new Resvg(L.background(st), resvgOpts(st.paper)).render().asPng());
  return f;
}

async function stills(times) {
  const bg = bgPng(), files = [];
  for (const t of times) {
    const fg = path.join(outDir, `_fg.png`), out = path.join(outDir, `still_${st.key}_${lang}_${t.toFixed(1)}.png`);
    const svgDbg = frameSvg(t, Math.round(t * FPS)); if (process.env.DUMP) fs.writeFileSync(path.join(outDir, "_dbg.svg"), svgDbg);
    fs.writeFileSync(fg, new Resvg(svgDbg, resvgOpts('rgba(0,0,0,0)')).render().asPng());
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', bg, '-i', fg, '-filter_complex', 'overlay', out]);
    files.push(out);
  }
  fs.unlinkSync(path.join(outDir, '_fg.png'));
  console.log(files.join('\n'));
}

// procedural sound design: whoosh on every cut, soft hit on stamps/crosses, low room tone
function sfxFilter() {
  const cuts = starts.slice(1).map(x => x.toFixed(2));
  const parts = [], labels = [];
  cuts.forEach((c, i) => {
    parts.push(`anoisesrc=d=0.45:c=pink:a=0.5,bandpass=f=900:w=1400,afade=t=in:d=0.18,afade=t=out:st=0.2:d=0.25,volume=0.32,adelay=${Math.round((c - .12) * 1000)}|${Math.round((c - .12) * 1000)}[w${i}]`);
    labels.push(`[w${i}]`);
  });
  parts.push(`anoisesrc=d=${DUR.toFixed(2)}:c=brown:a=0.2,lowpass=f=180,volume=0.22[room]`); labels.push('[room]');
  return { parts, labels };
}

async function video() {
  const bg = bgPng(), narr = path.join(vdir, `audio_${lang}`, 'narration.wav');
  const out = path.join(outDir, `${path.basename(vdir)}_${st.key}_${lang}.mp4`);
  const { parts, labels } = sfxFilter();
  const fc = [
    `[1:v]format=rgba[fg]`, `[0:v][fg]overlay=shortest=1,format=yuv420p[v]`,
    ...parts,
    `[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=1.0[nar]`,
    `[nar]${labels.join('')}amix=inputs=${labels.length + 1}:normalize=0:duration=first,alimiter=limit=0.95[a]`,
  ].join(';');
  const ff = spawn('ffmpeg', ['-y', '-v', 'error',
    '-loop', '1', '-framerate', String(FPS), '-i', bg,
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(FPS), '-i', '-',
    '-i', narr,
    '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-c:a', 'aac', '-b:a', '192k', '-t', DUR.toFixed(3), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.ceil(DUR * FPS), t0 = Date.now();
  for (let f = 0; f < N; f++) {
    const px = new Resvg(frameSvg(f / FPS, f), resvgOpts('rgba(0,0,0,0)')).render().pixels;
    if (!ff.stdin.write(px)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 150 === 0) process.stdout.write(`frame ${f}/${N} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('done', out, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

(mode === 'stills' ? stills(arg.split(',').map(Number)) : video()).catch(e => { console.error(e); process.exit(1); });
