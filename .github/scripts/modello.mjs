/* L'ULTIMA PROIEZIONE DEL MODELLO PREVISIONALE, COPIATA IN stime.json.

   Uso: node .github/scripts/modello.mjs <cartella di modello-israele> <stime.json>

   Apre la pagina del modello (angrisanidj/modello-israele) in Chromium senza rete esterna,
   così il modello lavora sull'archivio dei sondaggi aggiornato dal suo lavoro notturno, e
   legge i seggi centrali e le quote di voto appena calcolati. Poi riscrive il solo campo
   «modello» di stime.json; tutto il resto del file resta com'è.

   Si ferma senza scrivere niente quando:
   - è passato il 26 ottobre 2026 (dal giorno del voto la proiezione resta quella della vigilia);
   - il modello non espone più i numeri dove ce li aspettiamo (è cambiato il suo codice);
   - i seggi non sommano a 120, oppure una lista con seggi non ha una lettera di scheda.
   Meglio una proiezione di ieri che una sbagliata. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [, , DIR, STIME] = process.argv;
const ULTIMO_GIORNO = '2026-10-26';
const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
if (oggi > ULTIMO_GIORNO) { console.log('Dopo il ' + ULTIMO_GIORNO + ': la proiezione resta quella della vigilia.'); process.exit(0); }

/* identificativi del modello → lettere di scheda. Le componenti («dentro») si sommano al contenitore. */
const LETTERA = {
  likud: 'מחל', shas: 'שס', utj: 'ג', otzma: 'ב', rzp_zehut: 'ט', sionismo_rel: 'ט', zehut: 'ט',
  byachad: 'רק', yesh_atid: 'רק', bennett26: 'רק', yashar: 'דרך', democratici: 'אמת', beitenu: 'ל', blue_white: 'כן',
  lista_araba: 'ודם', hadash_taal: 'ודם', balad: 'ודם', raam: 'עם',
  reserv_nep: 'די', economico: 'די', amcha: 'ך', israel_first: 'י', haredi_pubblico: 'זך'
};

const MARCA = ' SEG=dhondt(QUO);';
let html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
if (html.split(MARCA).length !== 2) throw new Error('Il codice del modello è cambiato: «' + MARCA.trim() + '» non compare una volta sola.');
html = html.replace(MARCA, MARCA + 'window.__M={QUO:QUO,SEG:SEG,ultimo:L[0].data,n:L.length};');

const TIPI = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html); }
  const f = path.join(DIR, path.normalize(p));
  if (!f.startsWith(path.resolve(DIR)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPI[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + srv.address().port + '/';

const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let M;
try {
  const p = await b.newPage();
  await p.route(u => !u.href.startsWith(base), r => r.abort());   /* niente Wikipedia: vale l'archivio */
  p.on('pageerror', e => console.log('errore nella pagina del modello:', e.message));
  await p.goto(base);
  await p.waitForFunction(() => window.__M && window.__M.SEG, null, { timeout: 90000 });
  M = await p.evaluate(() => JSON.parse(JSON.stringify(window.__M)));
} finally { await b.close(); srv.close(); }

const seggi = {}, voti = {};
for (const [id, n] of Object.entries(M.SEG)) {
  if (!n) continue;
  const l = LETTERA[id];
  if (!l) throw new Error('Lista del modello senza lettera di scheda: ' + id + ' (' + n + ' seggi). Va aggiunta a LETTERA.');
  seggi[l] = (seggi[l] || 0) + n;
}
for (const [id, q] of Object.entries(M.QUO)) { const l = LETTERA[id]; if (l && q > 0) voti[l] = Math.round(((voti[l] || 0) + q) * 100) / 100; }
const tot = Object.values(seggi).reduce((a, b) => a + b, 0);
if (tot !== 120) throw new Error('I seggi del modello sommano a ' + tot + ', non a 120.');

const ord = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
const nuovo = { data: oggi, ultimo: M.ultimo, rilevazioni: M.n, seggi: ord(seggi), voti: ord(voti) };
const st = JSON.parse(fs.readFileSync(STIME, 'utf8'));
/* confronto senza la data e senza badare all'ordine delle chiavi */
const norma = v => Array.isArray(v) ? v.map(norma) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, norma(v[k])])) : v;
const firma = o => JSON.stringify(norma({ ...o, data: null }));
if (st.modello && firma(st.modello) === firma(nuovo)) { console.log('Proiezione invariata: stime.json non cambia.'); process.exit(0); }
st.modello = nuovo;
/* lo stesso impaginato del file scritto a mano: un campo per riga, i valori brevi su una riga sola */
const compatto = v => Array.isArray(v) ? '[' + v.map(compatto).join(', ') + ']'
  : v && typeof v === 'object' ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + compatto(x)).join(', ') + '}' : JSON.stringify(v);
const aperto = v => v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).some(x => x && typeof x === 'object' && !Array.isArray(x));
const testo = '{\n' + Object.entries(st).map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + (aperto(v)
  ? '{\n' + Object.entries(v).map(([k2, v2]) => '    ' + JSON.stringify(k2) + ': ' + compatto(v2)).join(',\n') + '\n  }'
  : compatto(v))).join(',\n') + '\n}\n';
JSON.parse(testo);
fs.writeFileSync(STIME, testo);
console.log('Proiezione aggiornata (' + oggi + ', ultimo sondaggio ' + M.ultimo + ', ' + M.n + ' rilevazioni):', JSON.stringify(seggi));
