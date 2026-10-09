/* Proxy dei file di scrutinio della Commissione elettorale centrale israeliana.

   GET /api/cec?file=expc            CSV per località (quello che serve alla dashboard)
   GET /api/cec?file=expb            CSV per seggio (più pesante: serve solo per contare i seggi scrutinati)
   GET /api/cec?file=expc&ed=25      stesso file delle elezioni del 2022, per la prova generale
   GET /api/cec?diag=1               diagnostica: raggiungibilità, stato HTTP, latenza, regione Vercel

   Il CSV arriva sempre in UTF-8, senza BOM. La Commissione ha usato windows-1255 fino al
   2021 e UTF-8 con BOM nel 2022 (cambiato poche ore prima della chiusura dei seggi):
   il proxy riconosce il BOM, poi prova UTF-8 rigoroso, poi ripiega su windows-1255.

   Last-Modified ed ETag della Commissione vengono inoltrati, e If-Modified-Since /
   If-None-Match del browser vengono girati alla Commissione: un ciclo senza novità costa
   un 304 vuoto. La cache del CDN di Vercel (s-maxage) fa sì che molti lettori aperti sulla
   pagina generino comunque una sola richiesta alla Commissione ogni 20 secondi. */

const EDIZIONI = {
  '26': process.env.CEC_BASE || 'https://media26.bechirot.gov.il/files/',
  '25': 'https://media25.bechirot.gov.il/files/'
};
const FILE = { expc: 'expc.csv', expb: 'expb.csv' };

/* Origini ammesse. Aggiungi qui il dominio se la pagina va anche altrove. */
const ORIGINI = [
  'https://angrisanidj.github.io',
  'http://localhost', 'http://127.0.0.1', 'null'
];

function cors(req, res) {
  const o = req.headers.origin || '';
  const ok = ORIGINI.some(a => o === a || o.startsWith(a + ':'));
  res.setHeader('Access-Control-Allow-Origin', ok ? o : ORIGINI[0]);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'If-Modified-Since, If-None-Match');
  res.setHeader('Access-Control-Expose-Headers',
    'Last-Modified, ETag, X-Cec-Status, X-Cec-Encoding, X-Cec-Url, X-Cec-Fetched');
}

function decodifica(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF)
    return { testo: new TextDecoder('utf-8').decode(b.subarray(3)), enc: 'utf-8-bom' };
  try {
    return { testo: new TextDecoder('utf-8', { fatal: true }).decode(b), enc: 'utf-8' };
  } catch (_) {
    return { testo: new TextDecoder('windows-1255').decode(b), enc: 'windows-1255' };
  }
}

async function scarica(url, extra = {}, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
        'Accept': 'text/csv,text/plain,*/*',
        'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        ...extra
      }
    });
  } finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const q = req.query || {};
  const ed = EDIZIONI[q.ed] ? String(q.ed) : '26';

  if (q.diag) {
    const out = { regione: process.env.VERCEL_REGION || 'sconosciuta', quando: new Date().toISOString(), prove: [] };
    for (const e of ['26', '25']) {
      for (const f of ['expc']) {
        const url = EDIZIONI[e] + FILE[f];
        const t0 = Date.now();
        try {
          const r = await scarica(url, { Range: 'bytes=0-511' }, 10000);
          const buf = await r.arrayBuffer();
          out.prove.push({ url, stato: r.status, ms: Date.now() - t0,
            server: r.headers.get('server'), via: r.headers.get('via'),
            cache: r.headers.get('x-cache'), lastModified: r.headers.get('last-modified'),
            tipo: r.headers.get('content-type'),
            inizio: decodifica(buf).testo.slice(0, 160) });
        } catch (err) {
          out.prove.push({ url, errore: String(err && err.message || err), ms: Date.now() - t0 });
        }
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(out);
  }

  const nome = FILE[q.file] || FILE.expc;
  const url = EDIZIONI[ed] + nome;
  const cond = {};
  if (req.headers['if-modified-since']) cond['If-Modified-Since'] = req.headers['if-modified-since'];
  if (req.headers['if-none-match']) cond['If-None-Match'] = req.headers['if-none-match'];

  let r;
  try {
    r = await scarica(url, cond);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(504).json({ errore: 'Commissione non raggiungibile', dettaglio: String(err && err.message || err), url });
  }

  res.setHeader('X-Cec-Status', String(r.status));
  res.setHeader('X-Cec-Url', url);
  res.setHeader('X-Cec-Fetched', new Date().toISOString());
  const lm = r.headers.get('last-modified'); if (lm) res.setHeader('Last-Modified', lm);
  const et = r.headers.get('etag'); if (et) res.setHeader('ETag', et);
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=40');

  if (r.status === 304) return res.status(304).end();
  if (!r.ok) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ errore: 'La Commissione ha risposto ' + r.status, url });
  }

  const { testo, enc } = decodifica(await r.arrayBuffer());
  res.setHeader('X-Cec-Encoding', enc);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  return res.status(200).send(testo);
}
