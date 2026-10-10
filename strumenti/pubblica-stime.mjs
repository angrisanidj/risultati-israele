/* PUBBLICA stime.json — la sera del voto, in un comando solo.

   node strumenti/pubblica-stime.mjs            controlla stime.json, commit, push, aspetta Pages
   node strumenti/pubblica-stime.mjs --prova F   controlla soltanto il file F: niente git, niente sito
   aggiungendo --2022 la prova usa le liste e le lettere del 2022, per gli exit poll di allora

   Controlli prima di pubblicare (se uno fallisce non si pubblica niente):
   - il file è JSON valido;
   - ogni exit poll con dei seggi somma esattamente a 120, con numeri interi;
   - ogni lettera di scheda esiste fra le 38 liste del 2026;
   - nessuna lista ha da 1 a 3 seggi (sotto la soglia del 3,25% non se ne prendono: è un errore di battitura);
   - gli accordi di eccedenza sono coppie di lettere valide;
   - la proiezione del modello, se c'è, somma a 120.
   Poi: commit, pull --rebase (il workflow del modello può aver scritto nel frattempo), push,
   e attesa finché il stime.json servito da GitHub Pages è identico a quello appena pubblicato. */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const URL_PUBBLICO = process.env.URL_STIME || 'https://angrisanidj.github.io/risultati-israele/stime.json';   /* sovrascrivibile solo per le prove */
const LETTERE = new Set(['רק', 'דרך', 'צדק', 'ד', 'צף', 'ך', 'י', 'ה', 'קה', 'בד', 'ל', 'קץ', 'נף', 'ב', 'קך', 'די', 'אמת', 'עם', 'שס', 'זך', 'פה', 'זץ', 'נקי', 'יק', 'ז', 'בקר', 'נץ', 'נר', 'מחל', 'כן', 'ט', 'צבי', 'בי', 'ק', 'ודם', 'רץ', 'ג', 'ני', 'אחר']);
const NOMI = { 'מחל': 'Likud', 'דרך': 'Yashar', 'רק': 'Beyachad', 'אמת': 'Democratici', 'ל': 'Yisrael Beitenu', 'ב': 'Otzma Yehudit', 'שס': 'Shas', 'ג': 'UTJ', 'ט': 'SR–Zehut', 'עם': "Ra'am", 'ודם': 'Lista unita', 'די': 'Riservisti', 'ך': "Popolo d'Israele", 'כן': 'Blu e Bianco', 'ני': 'Noam', 'י': 'Israel First', 'זך': 'Haredi' };
const BLOCCO = { 'מחל': 'N', 'ט': 'N', 'ב': 'N', 'שס': 'N', 'ג': 'N', 'ני': 'N', 'ך': 'N', 'רק': 'O', 'דרך': 'O', 'אמת': 'O', 'ל': 'O', 'כן': 'O', 'עם': 'A', 'ודם': 'A' };
/* le liste del 2022, solo per la prova generale con gli exit poll di allora */
const L22 = { 'מחל': ['Likud', 'N'], 'פה': ['Yesh Atid', 'O'], 'ט': ['Sionismo religioso', 'N'], 'כן': ['Unità nazionale', 'O'], 'שס': ['Shas', 'N'], 'ג': ['UTJ', 'N'], 'ל': ['Yisrael Beitenu', 'O'],
  'עם': ["Ra'am", 'A'], 'ום': ["Hadash–Ta'al", 'A'], 'אמת': ['Laburisti', 'O'], 'מרצ': ['Meretz', 'O'], 'ד': ['Balad', 'A'], 'ב': ['Casa ebraica', 'X'] };
const RETI = { kan: 'Kan 11', c12: 'Canale 12', c13: 'Canale 13', c14: 'Canale 14' };

const args = process.argv.slice(2), iP = args.indexOf('--prova');
const PROVA = iP >= 0, FILE = PROVA ? args[iP + 1] : 'stime.json';
if (args.includes('--2022')) {
  if (!PROVA) { console.error('--2022 vale solo con --prova.'); process.exit(1); }
  LETTERE.clear(); for (const k in NOMI) delete NOMI[k]; for (const k in BLOCCO) delete BLOCCO[k];
  for (const [l, [n, b]] of Object.entries(L22)) { LETTERE.add(l); NOMI[l] = n; BLOCCO[l] = b; }
}
if (!FILE || !fs.existsSync(FILE)) { console.error('File non trovato: ' + FILE); process.exit(1); }

/* ---------- controlli ---------- */
let j;
try { j = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, '')); }
catch (e) { console.error('✗ ' + FILE + ' non è JSON valido: ' + e.message); process.exit(1); }
const errori = [], righe = [];
const somma = o => Object.values(o).reduce((a, b) => a + b, 0);
for (const [k, x] of Object.entries(j.exit || {})) {
  if (!RETI[k]) { errori.push('rete sconosciuta: ' + k); continue; }
  const s = x && x.seggi || {};
  if (!Object.keys(s).length) { righe.push(RETI[k].padEnd(10) + ' —'); continue; }
  for (const [l, n] of Object.entries(s)) {
    if (!LETTERE.has(l)) errori.push(RETI[k] + ': lettera di scheda sconosciuta «' + l + '»');
    if (!Number.isInteger(n) || n < 0) errori.push(RETI[k] + ': ' + (NOMI[l] || l) + ' ha un valore non valido (' + n + ')');
    else if (n > 0 && n < 4) errori.push(RETI[k] + ': ' + (NOMI[l] || l) + ' con ' + n + ' seggi, sotto la soglia non è possibile');
  }
  const t = somma(s);
  if (t !== 120) errori.push(RETI[k] + ': i seggi sommano a ' + t + ', non a 120');
  const b = { N: 0, O: 0, A: 0, X: 0 }; for (const [l, n] of Object.entries(s)) b[BLOCCO[l] || 'X'] += n;
  righe.push(RETI[k].padEnd(10) + ' ore ' + (x.ora || '?').padEnd(6) + ' Netanyahu ' + b.N + ' · opposizione ' + b.O + ' · arabi ' + b.A + (b.X ? ' · altri ' + b.X : '') + '   (' +
    Object.entries(s).filter(([, n]) => n > 0).sort((a, c) => c[1] - a[1]).map(([l, n]) => (NOMI[l] || l) + ' ' + n).join(', ') + ')');
}
for (const c of j.accordi || []) if (!Array.isArray(c) || c.length !== 2 || !c.every(l => LETTERE.has(l))) errori.push('accordo non valido: ' + JSON.stringify(c));
if (j.modello && j.modello.seggi && somma(j.modello.seggi) !== 120) errori.push('la proiezione del modello somma a ' + somma(j.modello.seggi) + ', non a 120');

console.log('Exit poll in ' + FILE + ':\n  ' + righe.join('\n  '));
if (errori.length) { console.error('\n✗ NON PUBBLICATO. Da correggere:\n  - ' + errori.join('\n  - ')); process.exit(1); }
console.log('\n✓ Controlli superati.');
if (PROVA) { console.log('Modalità prova: niente commit, niente push.'); process.exit(0); }

/* ---------- pubblicazione ---------- */
const sh = c => execSync(c, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const t0 = Date.now();
sh('git add stime.json');
if (!sh('git diff --cached --name-only')) { console.log('stime.json è già quello pubblicato: niente da fare.'); process.exit(0); }
const ore = Object.entries(j.exit || {}).filter(([, x]) => x && Object.keys(x.seggi || {}).length).map(([k, x]) => k + ' ' + (x.ora || '')).join(', ');
sh('git commit -m ' + JSON.stringify('Exit poll: ' + (ore || 'aggiornamento stime')));
sh('git pull --rebase --autostash');
sh('git push');
console.log('Pushato ' + sh('git rev-parse --short HEAD') + ' in ' + Math.round((Date.now() - t0) / 1000) + ' s. Aspetto GitHub Pages…');
const atteso = JSON.stringify(JSON.parse(fs.readFileSync('stime.json', 'utf8').replace(/^﻿/, '')));
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 5000));
  try {
    const r = await fetch(URL_PUBBLICO + '?t=' + Date.now(), { cache: 'no-store' });
    if (r.ok && JSON.stringify(await r.json()) === atteso) { console.log('✓ Online dopo ' + Math.round((Date.now() - t0) / 1000) + ' s: i lettori lo vedono entro due minuti.'); process.exit(0); }
  } catch (_) { }
}
console.error('✗ Dopo 5 minuti Pages serve ancora la versione precedente: controllare Actions → pages-build-deployment.');
process.exit(1);
