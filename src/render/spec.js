// Declarative scene spec → scenes array (the format render.js expects).
// The agent writes JSON with a small vocabulary; this file owns layout and timing,
// so every element is anchored to a spoken word and positions stay inside the safe area.
const L = require('./lib');
const { wat, person, car, coin, house, book, giftBox, bigX, ground, text, stamp, label, bubble, prog, backOut, clamp, lerp, easeOut } = L;

const VOCAB = ['title', 'stamp', 'label', 'person', 'row', 'counter', 'cross', 'bubble', 'walk'];
const ITEMS = { car: (st, s, lit) => car(st, 0, 0, s, 1, lit), coin: (st, s, lit) => coin(st, 0, 0, s * 1.6, lit), house: (st, s) => house(st, 0, 0, s), book: (st, s, lit) => book(st, 0, 0, s, lit ? 1 : 0), gift: (st, s) => giftBox(st, 0, 0, s) };
const EXPR = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'smug', 'worried', 'fear'];
const HAIR = ['none', 'pony', 'curly', 'bun', 'cap', 'slick'];

const pop = (x, y, a, inner, rot = 0) => a > 0 ? `<g transform="translate(${x},${y}) rotate(${rot}) scale(${backOut(a)})" opacity="${clamp(a * 3)}">${inner}</g>` : '';

function compile(spec) {
  const portrait = spec.format !== 'landscape';
  const W = portrait ? 1080 : 1920, FEET = portrait ? 1250 : 900;
  const X = { left: W * .25, center: W * .5, right: W * .75 };
  const Y = { top: portrait ? 520 : 230, mid: portrait ? 900 : 560, low: portrait ? 1150 : 820 };
  const scenes = spec.scenes.map(sc => ({
    from: sc.line, sub: sc.sub !== false,
    draw: (st, t, T) => {
      const at = (w, d = .35) => prog(t, wat(T, sc.line, w) - .1, d);
      const hasPerson = sc.elements.some(e => e.type === 'person' || e.type === 'walk');
      let out = sc.elements.some(e => e.type === 'person' || e.type === 'walk') ? ground(st, FEET) : '';
      const fit = (str, size) => Math.min(size, Math.floor(W * .86 / (str.length * .56)));   // never wider than the safe area
      for (const e of sc.elements) {
        const x = X[e.pos] ?? X.center;
        if (e.type === 'title') out += pop(x, Y[e.y] ?? Y.top, at(e.at), text(st, 0, 0, fit(e.text, e.size || (portrait ? 150 : 130)), e.text.toUpperCase(), e.accent ? { fill: st.accent } : {}), e.accent ? -3 : 0);
        else if (e.type === 'stamp') out += stamp(st, x, Y[e.y] ?? Y.top, fit(e.text, e.size || 120), e.text.toUpperCase(), at(e.at), -5);
        else if (e.type === 'label') out += at(e.at) > 0 ? label(st, x, Y[e.y] ?? Y.low, e.text.toUpperCase()) : '';
        else if (e.type === 'person') out += pop(x, FEET, at(e.at), person(st, { x: 0, y: 0, s: e.scale || .7, face: e.face || (e.pos === 'right' ? -1 : 1), hair: e.hair || 'none', expr: t > wat(T, sc.line, e.mood_at || e.at) ? (e.expr || 'neutral') : 'neutral', sweat: e.expr === 'fear' && t > wat(T, sc.line, e.mood_at || e.at) }, t));
        else if (e.type === 'walk') { const a = easeOut(prog(t, wat(T, sc.line, e.at) - .1, 2)); out += person(st, { x: lerp(-200, W + 200, a), y: FEET, s: .65, face: 1, hair: e.hair || 'none', expr: e.expr || 'neutral' }, t); }
        else if (e.type === 'row') {
          const n = Math.min(e.n || 3, 6), t0 = wat(T, sc.line, e.at), t1 = e.until ? wat(T, sc.line, e.until) : t0 + .6;
          for (let i = 0; i < n; i++) out += pop(lerp(W * .15, W * .85, n === 1 ? .5 : i / (n - 1)), Y[e.y] ?? (hasPerson ? Y.top : Y.mid), prog(t, lerp(t0, t1, i / Math.max(1, n - 1)) - .1, .3), ITEMS[e.item](st, (e.scale || .5) * (e.grow ? .7 + .6 * i / n : 1), e.highlight === i));
        }
        else if (e.type === 'counter') {
          const a = easeOut(prog(t, wat(T, sc.line, e.at), e.until ? Math.max(.3, wat(T, sc.line, e.until) - wat(T, sc.line, e.at)) : 1));
          const dec = (String(e.to).split('.')[1] || '').length, v = lerp(e.from || 0, e.to, a).toFixed(dec);
          out += pop(x, Y[e.y] ?? Y.mid, at(e.at, .25), text(st, 0, 0, e.size || 220, `${v}${e.suffix || ''}`, { fill: st.accent }));
        }
        else if (e.type === 'cross') out += bigX(st, x, Y[e.y] ?? Y.mid, e.size || 240, at(e.at, .5));
        else if (e.type === 'bubble') { const a = at(e.at); if (a > 0) out += `<g opacity="${clamp(a * 3)}">${bubble(st, x, (Y[e.y] ?? Y.top) - 120, 560, 200, x - 60, Y[e.y] ?? Y.top, text(st, 0, 20, 60, e.text), backOut(a))}</g>`; }
      }
      return out;
    },
  }));
  if (!portrait) scenes.format = 'landscape';
  return scenes;
}

// Validation shared with the agent: returns a list of human-readable problems ([] = OK).
function validate(spec, script) {
  const errs = [], ids = new Map(script.lines.map(l => [l.id, l.text]));
  const words = txt => txt.split(/\s+/).map(L.normW);
  for (const sc of spec.scenes || []) {
    if (!ids.has(sc.line)) { errs.push(`scene line "${sc.line}" not in script`); continue; }
    const ws = words(ids.get(sc.line));
    let accents = 0;
    for (const e of sc.elements || []) {
      if (!VOCAB.includes(e.type)) errs.push(`${sc.line}: unknown element "${e.type}" (use ${VOCAB.join(', ')})`);
      for (const k of ['at', 'until', 'mood_at']) if (e[k] && !ws.some(w => w.startsWith(L.normW(e[k])))) errs.push(`${sc.line}: anchor ${k}="${e[k]}" is not a word in "${ids.get(sc.line)}"`);
      if (!e.at) errs.push(`${sc.line}: ${e.type} has no "at" word`);
      if (e.type === 'row' && !ITEMS[e.item]) errs.push(`${sc.line}: row item "${e.item}" unknown (use ${Object.keys(ITEMS).join(', ')})`);
      if (e.type === 'person' && e.expr && !EXPR.includes(e.expr)) errs.push(`${sc.line}: expr "${e.expr}" unknown (use ${EXPR.join(', ')})`);
      if (e.type === 'person' && e.hair && !HAIR.includes(e.hair)) errs.push(`${sc.line}: hair "${e.hair}" unknown`);
      if (['title', 'stamp', 'label', 'bubble'].includes(e.type) && (!e.text || e.text.length > 22)) errs.push(`${sc.line}: ${e.type} text missing or longer than 22 chars`);
      if (e.type === 'counter' && typeof e.to !== 'number') errs.push(`${sc.line}: counter needs numeric "to"`);
      const nums = (ids.get(sc.line).replace(/,/g, '').match(/\d+(?:\.\d+)?/g) || []).map(Number);
      if (e.type === 'counter' && typeof e.to === 'number' && !nums.includes(e.to)) errs.push(`${sc.line}: counter to=${e.to} is not a number spoken in the line (spoken: ${nums.join(', ') || 'none'})`);
      if (e.accent || e.type === 'counter' || e.type === 'stamp') accents++;
    }
    if (accents > 2) errs.push(`${sc.line}: ${accents} accents, style bible allows max 2`);
    if ((sc.elements || []).length > 4) errs.push(`${sc.line}: more than 4 elements, keep frames simple`);
  }
  return errs;
}

module.exports = compile;
module.exports.validate = validate;
module.exports.VOCAB = VOCAB;
module.exports.ITEMS = Object.keys(ITEMS);
module.exports.EXPR = EXPR;
module.exports.HAIR = HAIR;
