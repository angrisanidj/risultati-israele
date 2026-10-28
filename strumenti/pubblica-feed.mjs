/* PUBBLICA LA COPIA DEL FEED — la sera del voto, finché la Commissione blocca il proxy.

   La Commissione risponde al proxy Vercel con una verifica anti-bot di AWS WAF (202 vuoto), quindi
   il file non arriva in automatico. La redazione lo scarica dal proprio browser, con un clic su un
   segnalibro, e questo script fa il resto:

   node strumenti/pubblica-feed.mjs              sorveglia la cartella Download e pubblica ogni expc/expb nuovo
   node strumenti/pubblica-feed.mjs --da D       sorveglia la cartella D invece di Download
   node strumenti/pubblica-feed.mjs --prova      pubblica in dati/prova/live/ invece di dati/live/
                                                 (la pagina la legge con ?ed=25&copia=prova)

   Per ogni file scaricato (expc.csv, expc (1).csv, expb.csv, …):
   - controlla che sia un CSV della Commissione, non una pagina d'errore;
   - lo converte in UTF-8 (la Commissione ha usato windows-1255 fino al 2021);
   - se è diverso dall'ultimo pubblicato lo copia in dati/live/, fa commit, pull --rebase e push,
     e controlla quando GitHub Pages lo serve;
   - lo sposta in Download/israele-2026/ con l'ora nel nome: la cartella Download resta pulita e
     resta l'archivio della notte.
   Se da un po' non arriva un file, ricorda di scaricarlo (notifica di Windows e messaggio qui).
   L'intervallo segue il ritmo con cui la Commissione ha cambiato il file finora, fra 2 e 45 minuti
   (dal 28 ottobre arriva un file ogni mezz'ora circa).
   Si ferma con Ctrl+C, e da solo il 5 novembre: i risultati ufficiali escono il 4. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';

const args = process.argv.slice(2);
const opz = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const PROVA = args.includes('--prova');
const DA = path.resolve(opz('--da') || path.join(os.homedir(), 'Downloads'));
const ARCHIVIO = path.join(DA, 'israele-2026');
const DEST = PROVA ? 'dati/prova/live/' : 'dati/live/';
const SITO = (process.env.URL_SITO || 'https://angrisanidj.github.io/risultati-israele/') + DEST;   /* sovrascrivibile solo per le prove */
const NOME = /^(expc|expb)(?: ?\(\d+\))?\.csv$/i;
const RICORDA_MIN = 5, RICORDA_DA = 2, RICORDA_A = 45;
const FINE = new Date('2026-11-05T00:00:00+01:00');   /* mezzanotte del 5 novembre, ora italiana */

if (!fs.existsSync(DA)) { console.error('Cartella non trovata: ' + DA); process.exit(1); }
fs.mkdirSync(ARCHIVIO, { recursive: true });
fs.mkdirSync(DEST, { recursive: true });

const sh = c => execSync(c, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const ora = (d = new Date()) => d.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const nf = n => n.toLocaleString('it-IT');
const log = m => console.log('[' + ora() + '] ' + m);

/* stessa logica del proxy: BOM, poi UTF-8 rigoroso, poi windows-1255 */
function decodifica(b) {
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return new TextDecoder('utf-8').decode(b.subarray(3));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
  catch (_) { return new TextDecoder('windows-1255').decode(b); }
}
/* Controlla il file e ne ricava tipo, righe e voti validi. null se non è un CSV della Commissione. */
function esamina(testo) {
  const righe = testo.split(/\r?\n/).filter(l => l.trim());
  if (!righe.length) return null;
  const h = righe[0].split(',').map(s => s.trim());
  const iK = h.indexOf('כשרים');
  if (h.indexOf('סמל ישוב') < 0 || iK < 0) return null;
  let validi = 0;
  for (const r of righe.slice(1)) validi += Number((r.split(',')[iK] || '').replace(/[^\d]/g, '')) || 0;
  return { tipo: h.includes('קלפי') ? 'expb' : 'expc', righe: righe.length - 1, validi };
}
const uguale = (a, b) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');

/* ---------- promemoria ---------- */
const S = { ultimoDownload: 0, cambi: [], ricordato: 0, inCorso: false };
function intervallo() {
  const d = S.cambi.slice(-6).map((t, i, a) => i ? t - a[i - 1] : null).filter(Boolean).sort((a, b) => a - b);
  const min = d.length ? d[Math.floor(d.length / 2)] / 60000 : RICORDA_MIN;
  return Math.min(RICORDA_A, Math.max(RICORDA_DA, Math.round(min)));
}
function notifica(titolo, testo) {
  if (process.platform !== 'win32') return;
  const q = s => "'" + s.replace(/'/g, "''") + "'";
  const ps = "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;" +
    '$x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);' +
    '$t = $x.GetElementsByTagName("text"); $t.Item(0).AppendChild($x.CreateTextNode(' + q(titolo) + ')) > $null; $t.Item(1).AppendChild($x.CreateTextNode(' + q(testo) + ')) > $null;' +
    "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($x))";
  try { spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore', windowsHide: true }).on('error', () => { }); } catch (_) { }
}
function promemoria() {
  if (!S.ultimoDownload || S.inCorso) return;
  const min = intervallo(), passati = (Date.now() - S.ultimoDownload) / 60000;
  if (passati >= min && Date.now() - S.ricordato >= min * 60000) {
    S.ricordato = Date.now();
    const m = 'Sono passati ' + Math.floor(passati) + ' minuti dall’ultimo download: scarica expc.csv dalla Commissione.';
    log('⏰ ' + m + '\x07');
    notifica('Spoglio Israele: scarica il file', m);
  }
}

/* ---------- pubblicazione ---------- */
function pubblica(tipo, testo, info) {
  const dest = DEST + tipo + '.csv';
  fs.writeFileSync(dest, testo);
  const t0 = Date.now();
  sh('git add -- ' + JSON.stringify(dest));
  if (sh('git diff --cached --name-only -- ' + JSON.stringify(dest))) {
    const msg = 'Feed: ' + tipo + '.csv delle ' + ora().slice(0, 5) + ' (' + nf(info.validi) + ' voti validi)' + (PROVA ? ' [prova]' : '');
    sh('git commit -m ' + JSON.stringify(msg) + ' -- ' + JSON.stringify(dest));
  } else if (sh('git rev-list --count @{u}..HEAD') === '0') return false;   /* niente di nuovo, e niente rimasto da un push fallito */
  sh('git pull --rebase --autostash');
  sh('git push');
  log('↑ Pushato ' + sh('git rev-parse --short HEAD') + ' in ' + Math.round((Date.now() - t0) / 1000) + ' s. Aspetto GitHub Pages…');
  attendiPages(tipo, testo, t0);
  return true;
}
/* In sottofondo: non blocca il file successivo. */
async function attendiPages(tipo, testo, t0) {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const r = await fetch(SITO + tipo + '.csv?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok && uguale(await r.text(), testo)) { log('✓ ' + tipo + '.csv online dopo ' + Math.round((Date.now() - t0) / 1000) + ' s: i lettori lo vedono entro un minuto.'); return; }
    } catch (_) { }
  }
  log('✗ Dopo 5 minuti Pages non serve ancora il nuovo ' + tipo + '.csv: controllare Actions → «Pubblica il sito».');
}

function archivia(file, tipo, quando) {
  const t = new Date(quando).toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).replace(/[: ]/g, '-');
  let dest = path.join(ARCHIVIO, tipo + '-' + t + '.csv'), n = 1;
  while (fs.existsSync(dest)) dest = path.join(ARCHIVIO, tipo + '-' + t + '-' + (n++) + '.csv');
  fs.renameSync(file, dest);
}

const visti = new Map();   /* nome → dimensione all'ultimo giro: si legge solo un file che ha smesso di crescere */
function giro() {
  if (S.inCorso) return;
  if (Date.now() >= FINE) {
    log('Fine: è il 5 novembre e i risultati ufficiali sono usciti il 4. Lo script si ferma.');
    process.exit(0);
  }
  let nomi;
  try { nomi = fs.readdirSync(DA).filter(n => NOME.test(n)); } catch (e) { log('✗ Non riesco a leggere ' + DA + ': ' + e.message); return; }
  const pronti = [];
  for (const n of nomi) {
    const p = path.join(DA, n);
    let st; try { st = fs.statSync(p); } catch (_) { continue; }
    if (visti.get(n) === st.size && st.size > 0) pronti.push({ n, p, mtime: st.mtimeMs });
    visti.set(n, st.size);
  }
  if (!pronti.length) return;
  S.inCorso = true;
  try {
    /* per tipo conta solo il più recente; gli altri vanno in archivio senza pubblicarli */
    pronti.sort((a, b) => a.mtime - b.mtime);
    const ultimo = {};
    for (const f of pronti) {
      const testo = decodifica(new Uint8Array(fs.readFileSync(f.p)));
      const info = esamina(testo);
      if (!info) {
        log('✗ ' + f.n + ' non è un CSV della Commissione (pagina d’errore o file vuoto): lo metto da parte, non pubblico niente.');
        archivia(f.p, 'scartato', f.mtime); visti.delete(f.n); continue;
      }
      ultimo[info.tipo] = { ...f, testo, info };
    }
    for (const f of pronti) {
      if (!fs.existsSync(f.p)) continue;
      const u = Object.values(ultimo).find(x => x.p === f.p);
      if (!u) { archivia(f.p, NOME.exec(f.n)[1].toLowerCase(), f.mtime); visti.delete(f.n); continue; }
      const { tipo, righe, validi } = u.info;
      const dest = DEST + tipo + '.csv';
      const prima = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
      const infoPrima = prima ? esamina(prima) : null;
      if (tipo === 'expc') S.ultimoDownload = Date.now(), S.ricordato = 0;
      if (prima && uguale(prima, u.testo)) {
        log('= ' + f.n + ' è identico all’ultimo pubblicato: la Commissione non ha ancora aggiornato. Prossimo promemoria fra ' + intervallo() + ' min.');
      } else {
        log('↓ ' + f.n + ': ' + tipo + ', ' + nf(righe) + ' righe, ' + nf(validi) + ' voti validi' +
          (infoPrima ? ' (prima ' + nf(infoPrima.validi) + ')' : '') + '.');
        if (infoPrima && validi < infoPrima.validi) log('! Ha meno voti validi dell’ultimo pubblicato: può essere una correzione della Commissione, o un file vecchio dalla cache del browser. Lo pubblico comunque.');
        if (pubblica(tipo, u.testo, u.info) && tipo === 'expc') S.cambi.push(Date.now());
      }
      archivia(f.p, tipo, f.mtime); visti.delete(f.n);
    }
  } catch (e) {
    log('✗ Pubblicazione non riuscita: ' + (e.stderr ? e.stderr.toString().trim() : e.message) + '\n  Il file resta in ' + DA + ': riprovo fra pochi secondi.');
  } finally { S.inCorso = false; }
}

console.log('Sorveglio ' + DA + (PROVA ? '  ·  PROVA: pubblico in ' + DEST : '') + '\n' +
  'Scarica dal browser https://media26.bechirot.gov.il/files/expc.csv (ed expb.csv, se vuoi l’avanzamento per seggi).\n' +
  'Ogni file nuovo va online da solo. Ctrl+C per fermare; si ferma da solo il 5 novembre.\n');
setInterval(giro, 1500);
setInterval(promemoria, 15000);
giro();
