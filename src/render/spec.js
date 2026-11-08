// Declarative scene spec → scenes array (the format render.js expects).
// The agent writes JSON with a small vocabulary; this file owns layout and timing,
// so every element is anchored to a spoken word and positions stay inside the safe area.
const L = require('./lib');
const { wat, person, car, coin, house, book, giftBox, bigX, ground, text, stamp, label, bubble, prog, backOut, clamp, lerp, easeOut } = L;

const P = require('./props');
const VOCAB = ['title', 'stamp', 'label', 'person', 'row', 'counter', 'cross', 'bubble', 'walk', 'icon', 'chart', 'split', 'pair', 'crowd'];
const ITEMS = { car: (st, s, lit) => car(st, 0, 0, s, 1, lit), coin: (st, s, lit) => coin(st, 0, 0, s * 1.6, lit), house: (st, s) => house(st, 0, 0, s), book: (st, s, lit) => book(st, 0, 0, s, lit ? 1 : 0), gift: (st, s) => giftBox(st, 0, 0, s) };
for (const n of P.NAMES) ITEMS[n] = (st, s, lit, t = 0) => P.PROPS[n](st, s, lit, t);
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
      const hasPerson = sc.elements.some(e => ['person', 'walk', 'pair', 'crowd'].includes(e.type));
      let out = hasPerson ? ground(st, FEET) : '';
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
          for (let i = 0; i < n; i++) out += pop(lerp(W * .15, W * .85, n === 1 ? .5 : i / (n - 1)), Y[e.y] ?? (hasPerson ? Y.top : Y.mid), prog(t, lerp(t0, t1, i / Math.max(1, n - 1)) - .1, .3), ITEMS[e.item](st, (e.scale || (P.NAMES.includes(e.item) ? 1.1 : .5)) * (e.grow ? .7 + .6 * i / n : 1), e.highlight === i, t));
        }
        else if (e.type === 'counter') {
          const a = easeOut(prog(t, wat(T, sc.line, e.at), e.until ? Math.max(.3, wat(T, sc.line, e.until) - wat(T, sc.line, e.at)) : 1));
          const dec = (String(e.to).split('.')[1] || '').length, v = lerp(e.from || 0, e.to, a).toFixed(dec);
          out += pop(x, Y[e.y] ?? Y.mid, at(e.at, .25), text(st, 0, 0, e.size || 220, `${v}${e.suffix || ''}`, { fill: st.accent }));
        }
        else if (e.type === 'icon') {
          const lit = e.lit_at ? t > wat(T, sc.line, e.lit_at) - .1 : !!e.lit;
          const tilt = e.item === 'scale' ? (e.tilt || 0) * easeOut(prog(t, wat(T, sc.line, e.lit_at || e.at), .6)) : 0;
          const big = (e.scale || (hasPerson ? 1.3 : 1.6)), sh = 'scale' === e.item ? P.PROPS.scale(st, big, lit, t, tilt) : ITEMS[e.item](st, big, lit, t);
          out += pop(x, Y[e.y] ?? (hasPerson ? Y.top : Y.mid), at(e.at), sh);
        }
        else if (e.type === 'chart') {
          const t0 = wat(T, sc.line, e.at), t1 = e.until ? wat(T, sc.line, e.until) : t0 + 1.4;
          const a = at(e.at, .3); if (a > 0) out += `<g transform="translate(${W / 2},${Y[e.y] ?? Y.mid})" opacity="${clamp(a * 3)}">${P.chart(st, W * .62, portrait ? 420 : 380, e.kind || 'up', e.values, clamp((t - t0) / Math.max(.4, t1 - t0)))}</g>`;
          if (e.label && a > 0) out += label(st, W / 2, (Y[e.y] ?? Y.mid) + (portrait ? 290 : 250), e.label.toUpperCase());
        }
        else if (e.type === 'split') {
          const a = at(e.at, .4), b = e.right_at ? at(e.right_at, .4) : a;
          if (a > 0) out += `<path d="M${W / 2},${portrait ? 360 : 120} V${portrait ? 1330 : 960}" ${L.paint(st).limb(6)} opacity="${clamp(a * 2) * .6}"/>`;
          out += pop(W * .25, portrait ? 440 : 170, a, text(st, 0, 0, fit(e.left, portrait ? 76 : 90) , e.left.toUpperCase()));
          out += pop(W * .75, portrait ? 440 : 170, b, text(st, 0, 0, fit(e.right, portrait ? 76 : 90), e.right.toUpperCase(), { fill: st.accent }));
        }
        else if (e.type === 'pair') {
          const a = at(e.at), m = e.mood_at ? t > wat(T, sc.line, e.mood_at) : true;
          out += pop(W * .3, FEET, a, person(st, { x: 0, y: 0, s: .62, face: 1, hair: e.hair_left || 'none', expr: m ? (e.expr_left || 'neutral') : 'neutral', talk: e.talk === 'left' ? [0, 1e9] : null }, t));
          out += pop(W * .7, FEET, a, person(st, { x: 0, y: 0, s: .62, face: -1, hair: e.hair_right || 'pony', expr: m ? (e.expr_right || 'neutral') : 'neutral', talk: e.talk === 'right' ? [0, 1e9] : null }, t));
        }
        else if (e.type === 'crowd') {
          const n = Math.min(Math.max(e.n || 5, 3), 7), t0 = wat(T, sc.line, e.at), hairs = ['none', 'pony', 'curly', 'bun', 'cap', 'slick'];
          for (let i = 0; i < n; i++) {
            const hi = e.highlight === i, hl = hi && e.highlight_at ? t > wat(T, sc.line, e.highlight_at) : hi;
            out += pop(lerp(W * .12, W * .88, i / (n - 1)), FEET + (i % 2) * 14, prog(t, t0 - .1 + i * .07, .3), person(st, { x: 0, y: 0, s: .4, face: i < n / 2 ? 1 : -1, hair: hairs[i % 6], phase: i, expr: hl ? (e.expr || 'surprised') : 'neutral', build: hl ? 'heavy' : 'normal' }, t));
          }
        }
        else if (e.type === 'cross') out += bigX(st, x, Y[e.y] ?? Y.mid, e.size || 240, at(e.at, .5));
        else if (e.type === 'bubble') { const a = at(e.at), bw = Math.min(560, Math.max(260, e.text.length * 34 + 80)), bx = clamp(x, bw / 2 + 50, W - bw / 2 - 50); if (a > 0) out += `<g opacity="${clamp(a * 3)}">${bubble(st, bx, (Y[e.y] ?? Y.top) - 120, bw, 200, (x - bx) * .6, 160, text(st, 0, 20, 60, e.text), backOut(a))}</g>`; }   // kept inside the frame
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
      for (const k of ['at', 'until', 'mood_at', 'lit_at', 'right_at', 'highlight_at']) if (e[k] && !ws.some(w => w.startsWith(L.normW(e[k])))) errs.push(`${sc.line}: anchor ${k}="${e[k]}" is not a word in "${ids.get(sc.line)}"`);
      if (!e.at) errs.push(`${sc.line}: ${e.type} has no "at" word`);
      if ((e.type === 'row' || e.type === 'icon') && !ITEMS[e.item]) errs.push(`${sc.line}: row item "${e.item}" unknown (use ${Object.keys(ITEMS).join(', ')})`);
      if (e.type === 'person' && e.expr && !EXPR.includes(e.expr)) errs.push(`${sc.line}: expr "${e.expr}" unknown (use ${EXPR.join(', ')})`);
      if (e.type === 'person' && e.hair && !HAIR.includes(e.hair)) errs.push(`${sc.line}: hair "${e.hair}" unknown`);
      if (['title', 'stamp', 'label', 'bubble'].includes(e.type) && (!e.text || e.text.length > 22)) errs.push(`${sc.line}: ${e.type} text missing or longer than 22 chars`);
      if (e.type === 'counter' && typeof e.to !== 'number') errs.push(`${sc.line}: counter needs numeric "to"`);
      const nums = (ids.get(sc.line).replace(/,/g, '').match(/\d+(?:\.\d+)?/g) || []).map(Number);
      if (e.type === 'counter' && typeof e.to === 'number' && !nums.includes(e.to)) errs.push(`${sc.line}: counter to=${e.to} is not a number spoken in the line (spoken: ${nums.join(', ') || 'none'})`);
      if (e.type === 'split' && (!e.left || !e.right || e.left.length > 14 || e.right.length > 14)) errs.push(`${sc.line}: split needs "left" and "right" texts, max 14 chars each`);
      if (e.type === 'chart' && !['up', 'down', 'bars'].includes(e.kind || 'up')) errs.push(`${sc.line}: chart kind must be up, down or bars`);
      if (e.type === 'chart' && e.values && (!Array.isArray(e.values) || e.values.some(v => typeof v !== 'number'))) errs.push(`${sc.line}: chart values must be a list of numbers`);
      if (e.accent || e.type === 'counter' || e.type === 'stamp' || e.type === 'chart' || e.lit || e.lit_at) accents++;
    }
    if (accents > 2) errs.push(`${sc.line}: ${accents} accents, style bible allows max 2`);
    if ((sc.elements || []).length > 4) errs.push(`${sc.line}: more than 4 elements, keep frames simple`);
  }
  return errs;
}

// ---------- visual quality checks (soft: fed back to the model, logged if it cannot fix them) ----------
// Which spoken words make an object a sensible picture for a line. No match = the object is probably decoration.
const MEANS = {
  car: 'car driv vehicle traffic road crosswalk brak', coin: 'money pay cash price win rich wealth cost dollar gambl bet coin reward',
  money: 'money pay cash price win rich wealth cost dollar gambl bet salary income reward', house: 'home house neighbo famil',
  book: 'book read study learn student lecture school class', gift: 'gift present give', phone: 'phone call mobile screen text app',
  clock: 'time hour minute late wait speed fast slow reaction delay', brain: 'brain mind think neural memory attention learn scan cognit circuit reward process',
  heart: 'love heart feel emotion pleasant stress kind', bulb: 'idea insight learn understand realiz concept discover', lock: 'control secur lock freedom restrict',
  trophy: 'win prize jackpot success reward best', scale: 'compare fair balance justice versus than', globe: 'world global countr everyone international',
  pill: 'drug medic pill health treat', bed: 'sleep night rest tired dream', laptop: 'laptop computer typ keyboard', pen: 'pen writ hand note longhand',
  eye: 'eye see look visual attention notice watch track', house_: '',
};
function visualCheck(spec, script) {
  const warn = [], ids = new Map(script.lines.map(l => [l.id, l.text.toLowerCase()]));
  const sc = spec.scenes || [];
  sc.forEach((s, i) => {
    const txt = ids.get(s.line) || '', words = txt.split(/\s+/).map(L.normW);
    for (const e of s.elements || []) {
      if ((e.type === 'icon' || e.type === 'row') && MEANS[e.item] && !MEANS[e.item].split(' ').some(k => txt.includes(k)))
        warn.push(`[visual] ${s.line}: "${e.item}" has nothing to do with "${ids.get(s.line)}". Pick an object the line talks about, or use a title/split/chart instead`);
    }
    // dead air: the first thing on screen appears after more than half of the line is spoken
    const first = Math.min(...(s.elements || []).map(e => { const k = words.findIndex(w => e.at && w.startsWith(L.normW(e.at))); return k < 0 ? 0 : k; }));
    if ((s.elements || []).length && words.length > 6 && first > words.length * .5) warn.push(`[visual] ${s.line}: nothing appears until word ${first + 1} of ${words.length}; anchor the first element to an earlier word`);
    if (!(s.elements || []).length) warn.push(`[visual] ${s.line}: empty scene`);
  });
  // variety: the same main element three scenes in a row, or a lone person over and over
  const main = sc.map(s => ((s.elements || [])[0] || {}).type || '');
  const runs = [];
  for (let i = 2; i < main.length; i++) if (main[i] && main[i] === main[i - 1] && main[i] === main[i - 2]) runs.push(sc[i].line);
  if (runs.length) warn.push(`[visual] "${main[main.indexOf(main.find((m, i) => i >= 2 && m === main[i - 1] && m === main[i - 2]))]}" is the main picture in 3+ scenes in a row (up to ${runs[runs.length - 1]}); vary the pictures`);
  const lonePerson = sc.filter(s => (s.elements || []).some(e => e.type === 'person') && !(s.elements || []).some(e => ['icon', 'row', 'chart', 'split', 'counter', 'pair', 'crowd'].includes(e.type))).length;
  if (lonePerson > 2) warn.push(`[visual] ${lonePerson} scenes show only a standing person; replace some with objects, charts, a split or a crowd`);
  return warn;
}

module.exports = compile;
module.exports.validate = validate;
module.exports.visualCheck = visualCheck;
module.exports.VOCAB = VOCAB;
module.exports.ITEMS = Object.keys(ITEMS);
module.exports.EXPR = EXPR;
module.exports.HAIR = HAIR;
