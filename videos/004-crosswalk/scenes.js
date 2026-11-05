// 004 — Status and the crosswalk (Piff et al. 2012, PNAS, study 2). All timing anchored to words.
const L = require('../../src/render/lib');
const { wat, person, car, bubble, bigX, ground, text, stamp, label, paint, prog, easeOut, backOut, lerp, clamp } = L;

const FEET = 1250;
const W_ = (T, id, w) => wat(T, id, w) - .1;   // animations land a beat before the word

const pop = (x, y, a, inner, rot = 0) => a > 0 ? `<g transform="translate(${x},${y}) rotate(${rot}) scale(${backOut(a)})" opacity="${clamp(a * 3)}">${inner}</g>` : '';
// zebra stripes on the road, seen from the side as short dashes along the ground
const zebra = (st, x, y) => [0, 1, 2, 3].map(i => `<path d="M${x - 120 + i * 70},${y + 14} h40" stroke="${st.mode === 'line' ? st.ink : st.paper}" stroke-width="12" stroke-linecap="round" opacity=".8"/>`).join('');

module.exports = [
  { // hook: the pricier the car, the less it stops for you
    from: 'l1', sub: true,
    draw: (st, t, T) => {
      const go = W_(T, 'l1', 'less'), stopW = W_(T, 'l1', 'stop');
      const cx = lerp(-260, 1350, easeOut(prog(t, go, 2.2)));
      return ground(st, FEET) + zebra(st, 540, FEET)
        + person(st, { x: 540, y: FEET, s: .62, face: -1, hair: 'pony', expr: t > stopW ? 'fear' : 'neutral', look: 'up', sweat: t > stopW }, t)
        + car(st, cx, FEET + 40, .9, 1, t > W_(T, 'l1', 'expensive'))
        + bigX(st, 540, 420, 240, prog(t, stopW, .5));
    },
  },
  { // it's published
    from: 'l2', sub: false,
    draw: (st, t, T) => {
      const a = prog(t, T.l2.start - .05, .3), b = prog(t, W_(T, 'l2', 'published'), .3);
      const p = paint(st);
      const doc = `<g${p.shadow}><path d="M-120,-160 H70 L120,-110 V160 H-120Z" ${p.card}/></g>${[-90, -50, -10, 30, 70].map((y, i) => `<path d="M-80,${y} H${i === 2 ? 80 : 50}" stroke="${p.cardInk}" stroke-width="10" stroke-linecap="round" opacity=".7"/>`).join('')}<path d="M-80,110 H20" ${p.aStroke(14)}/>`;
      return pop(540, 760, a, text(st, 0, 0, 120, 'A PUBLISHED'))
        + pop(540, 930, b, text(st, 0, 0, 140, 'FINDING', { fill: st.accent }), -3)
        + pop(540, 1320, b, doc, 4);
    },
  },
  { // California: a pedestrian at a marked crosswalk
    from: 'l3', sub: true,
    draw: (st, t, T) => {
      const k = prog(t, W_(T, 'l3', 'California'), .35), ped = prog(t, W_(T, 'l3', 'pedestrian'), .35), cw = prog(t, W_(T, 'l3', 'crosswalk'), .3);
      return ground(st, FEET) + (cw > 0 ? `<g opacity="${clamp(cw * 2)}">${zebra(st, 600, FEET)}</g>` : '')
        + person(st, { x: 220, y: FEET, s: .8, face: 1, hair: 'curly', build: 'thin', expr: 'neutral', pose: 'offer', look: 'down' }, t)
        + pop(620, FEET, ped, person(st, { x: 0, y: 0, s: .7, face: -1, hair: 'pony', expr: 'neutral' }, t))
        + stamp(st, 540, 330, 120, 'CALIFORNIA', k, -4);
    },
  },
  { // 152 drivers, every car rated cheap → luxurious
    from: 'l4', sub: true,
    draw: (st, t, T) => {
      const n = prog(t, W_(T, 'l4', 'hundred'), .35), r0 = W_(T, 'l4', 'old'), r1 = W_(T, 'l4', 'luxurious');
      let g = '';
      for (let i = 0; i < 5; i++) {
        const a = prog(t, lerp(r0, r1, i / 4), .3);
        g += pop(160 + i * 190, 1050, a, car(st, 0, 0, .32 + i * .07, 1, i === 4));
      }
      return pop(540, 520, n, text(st, 0, 0, 220, '152', { fill: st.accent }), -3)
        + pop(540, 680, n, text(st, 0, 0, 90, 'DRIVERS'))
        + `<path d="M120,1080 H960" ${paint(st).limb(0)}/>`
        + g + (t > r0 ? label(st, 170, 1160, 'CHEAP') : '') + (t > r1 ? label(st, 920, 1160, 'LUXURY') : '');
    },
  },
  { // about one in three didn't stop
    from: 'l5', sub: true,
    draw: (st, t, T) => {
      const a = prog(t, W_(T, 'l5', 'one'), .3), x = prog(t, W_(T, 'l5', 'not'), .5);
      let g = '';
      for (let i = 0; i < 3; i++) g += pop(220 + i * 320, 1000, prog(t, T.l5.start + i * .15, .3), car(st, 0, 0, .65, 1, i === 2));
      return g + `<path d="M120,1010 H960" ${paint(st).limb(0)}/>`
        + pop(540, 520, a, text(st, 0, 0, 170, '1 IN 3'))
        + bigX(st, 860, 900, 200, x);
    },
  },
  { // fancier car → more likely to drive straight through
    from: 'l6', sub: true,
    draw: (st, t, T) => {
      const g0 = W_(T, 'l6', 'fancier'), base = 1150, p = paint(st);
      let g = `<path d="M120,${base} H960" ${p.limb(0)}/>`;
      for (let i = 0; i < 5; i++) {
        const h = (140 + i * 95) * easeOut(prog(t, g0 + i * .25, .6));
        if (h > 0) g += `<rect x="${170 + i * 160}" y="${base - h}" width="110" height="${h}" ${i === 4 ? p.aFill : (st.mode === 'line' ? `fill="${st.paper}" stroke="${st.ink}" stroke-width="7"` : p.mass)}${p.shadow}/>`;
      }
      return g + label(st, 540, base + 70, 'CAR STATUS')
        + pop(540, 380, prog(t, W_(T, 'l6', 'straight'), .3), text(st, 0, 0, 100, 'DIDN’T STOP', { fill: st.accent }), -3);
    },
  },
  { // controls
    from: 'l6b', sub: true,
    draw: (st, t, T) => ['age', 'sex', 'time'].map((w, i) => pop(540, 600 + i * 200, prog(t, W_(T, 'l6b', w), .3), text(st, -40, 0, 110, ['AGE', 'SEX', 'TIME'][i]) + `<path d="M150,-40 l30,30 l60,-70" stroke="${st.ink}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`)).join('')
      + pop(540, 380, prog(t, W_(T, 'l6b', 'accounting'), .3), text(st, 0, 0, 80, 'CONTROLLED FOR')),
  },
  { // wealth makes the rules feel optional
    from: 'l7', sub: true,
    draw: (st, t, T) => {
      const b = prog(t, W_(T, 'l7', 'wealth'), .35), x = prog(t, W_(T, 'l7', 'optional'), .5);
      return ground(st, FEET)
        + person(st, { x: 780, y: FEET, s: .8, face: -1, outfit: 'suit', hair: 'slick', expr: 'smug' }, t)
        + car(st, 300, FEET, .8, 1, true)
        + bubble(st, 600, 520, 420, 220, 380, 640, text(st, 0, 20, 100, 'RULES'), backOut(b), true)
        + bigX(st, 600, 520, 200, x);
    },
  },
  { // name it
    from: 'l8', sub: false,
    draw: (st, t, T) => {
      const a = prog(t, W_(T, 'l8', 'upper'), .3), b = prog(t, W_(T, 'l8', 'entitlement') + .6, .3);
      return pop(540, 420, a, text(st, 0, 0, 110, 'UPPER-CLASS'))
        + pop(540, 600, b, text(st, 0, 0, 140, 'ENTITLEMENT', { fill: st.accent }), -4)
        + ground(st, FEET + 100)
        + car(st, 560, FEET + 140, 1, 1, true)
        + person(st, { x: 940, y: FEET + 100, s: .6, face: -1, hair: 'pony', expr: 'worried' }, t);
    },
  },
];
