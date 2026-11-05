// Channel art: banner (2560x1440, text inside the 1546x423 safe area) and avatar (800x800) per channel.
// usage: node channels/brand.js   -> channels/<key>/banner.png, avatar.png
const fs = require('fs'), path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const L = require('../src/render/lib'), STYLES = require('../src/render/styles');

const CH = [
  { key: 'mixed-en', style: 'gece', name: 'MIND AFTER DARK', tag: 'the psychology behind what people do', hair: 'slick', outfit: 'suit', expr: 'smug' },
  { key: 'shorts-tr', style: 'kesik', name: 'BEYİN KESİTİ', size: 200, tag: 'davranışın arkasındaki bilim', hair: 'curly', outfit: 'coat', expr: 'surprised' },
  { key: 'long-en', style: 'lino', name: 'THE STATUS ENGINE', size: 112, tag: 'long reads on class, money and the mind', hair: 'cap', outfit: 'worker', expr: 'worried' },
];

const opts = st => ({ fitTo: { mode: 'original' }, font: { fontFiles: st.fontFiles, loadSystemFonts: false, defaultFontFamily: st.font.sub } });
// the 1080x1920 background rendered on its own (resvg dislikes its filters when nested), then laid over the canvas
const bg = (st, w, h) => {
  const png = new Resvg(L.background(st), { fitTo: { mode: 'original' } }).render().asPng().toString('base64');
  return `<image width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${png}"/>`;
};

for (const c of CH) {
  const st = STYLES[c.style], dir = path.join(__dirname, c.key); fs.mkdirSync(dir, { recursive: true });
  const wob = s => st.mode === 'line' ? `<g filter="url(#wob)">${s}</g>` : s;
  const fig = (x, y, s, face, extra = {}) => L.person(st, { x, y, s, face, hair: c.hair, outfit: c.outfit, expr: c.expr, ...extra }, 1);

  // banner: name + tagline centred, two figures just outside the safe area on desktop
  const b = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440">${L.defs(st, 0)}${bg(st, 2560, 1440)}${wob(
    L.text(st, 1280, 730, c.size || 150, c.name)
    + `<path d="M${1280 - 330},790 H${1280 + 330}" stroke="${st.accent}" stroke-width="12" stroke-linecap="round"/>`
    + L.text(st, 1280, 870, 64, c.tag, { font: st.font.sub })
    + fig(330, 1100, .85, 1) + fig(2230, 1100, .85, -1, { hair: 'pony', outfit: 'coat', expr: 'neutral' }))}</svg>`;
  fs.writeFileSync(path.join(dir, 'banner.png'), new Resvg(b, opts(st)).render().asPng());

  // avatar: one figure's head and shoulders (YouTube crops it to a circle)
  const a = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">${L.defs(st, 0)}${bg(st, 800, 800)}${wob(fig(400, 1180, 1.3, 1))}<circle cx="400" cy="400" r="392" fill="none" stroke="${st.accent}" stroke-width="16"/></svg>`;
  fs.writeFileSync(path.join(dir, 'avatar.png'), new Resvg(a, opts(st)).render().asPng());
  console.log(dir);
}
