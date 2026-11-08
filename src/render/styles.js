// Style contracts. Scene code never picks colors or fonts — it asks the style.
// Changing a value here re-skins every video that uses the style.
const path = require('path');
const F = f => path.resolve(__dirname, '../../assets/fonts', f);

module.exports = {
  lino: {
    key: 'lino', name: 'A · MÜHÜR (linocut)',
    mode: 'fill',               // masses = grainy ink, details carved out in paper color
    paper: '#EEE7D8', ink: '#1C1B1A', accent: '#2747D6', detail: '#EEE7D8',
    font: { title: 'Archivo Black', sub: 'Archivo Black' },
    fontFiles: [F('ArchivoBlack-Regular.ttf')],
    sub: 'box',
  },
  gece: {
    key: 'gece', name: 'B · GECE DEFTERİ (tebeşir)',
    mode: 'line',               // chalk outlines on dark, accent glows
    paper: '#15171C', ink: '#ECE7DC', accent: '#F4A62A', detail: '#ECE7DC',
    font: { title: 'Kalam', sub: 'Kalam' },
    fontFiles: [F('Kalam-Bold.ttf')],
    sub: 'plain',
  },
  kesik: {
    key: 'kesik', name: 'C · KESİK KÂĞIT (kolaj)',
    mode: 'cut',                // flat paper cut-outs with drop shadows
    paper: '#D8C6A5', ink: '#2D2F36', accent: '#0F8C6E', detail: '#F3ECDD',
    font: { title: 'Bebas Neue', sub: 'Archivo Black' },
    fontFiles: [F('BebasNeue-Regular.ttf'), F('ArchivoBlack-Regular.ttf')],
    sub: 'strip',
  },
  // --- palettes on top of the three drawing modes (agent-era styles) ---
  neon: {
    key: 'neon', name: 'D · NEON (karanlık psikoloji)',
    mode: 'line',
    paper: '#0B0E17', ink: '#D9E2FF', accent: '#FF3D7F', detail: '#D9E2FF',
    font: { title: 'Bebas Neue', sub: 'Archivo Black' },
    fontFiles: [F('BebasNeue-Regular.ttf'), F('ArchivoBlack-Regular.ttf')],
    sub: 'plain',
  },
  gazete: {
    key: 'gazete', name: 'E · GAZETE (siyaset)',
    mode: 'fill',
    paper: '#EFEBE1', ink: '#121212', accent: '#C8102E', detail: '#EFEBE1',
    font: { title: 'Archivo Black', sub: 'Archivo Black' },
    fontFiles: [F('ArchivoBlack-Regular.ttf')],
    sub: 'box',
  },
  plan: {
    key: 'plan', name: 'F · PLAN (teknik çizim)',
    mode: 'line',
    paper: '#0F3B66', ink: '#E8F1FA', accent: '#FFD23F', detail: '#E8F1FA',
    font: { title: 'Kalam', sub: 'Kalam' },
    fontFiles: [F('Kalam-Bold.ttf')],
    sub: 'plain',
  },
};
