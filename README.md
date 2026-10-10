# risultati-israele

Dashboard per seguire in diretta lo spoglio delle elezioni della 26ª Knesset (27 ottobre 2026). È costruita sulla falsariga di `risultati-svezia`: una sola pagina statica su GitHub Pages che legge i file della Commissione elettorale centrale (ועדת הבחירות המרכזית) attraverso un proxy Vercel.

## Cosa c'è

| File | A cosa serve |
|---|---|
| `index.html` | La dashboard, file unico. Mappa e base 2022 sono già incorporate. |
| `stime.json` | Exit poll (in seggi) e accordi di eccedenza. Si modifica a mano la sera del voto. |
| `dati/prova/expc-2022.csv` | Il file definitivo del 2022, usato per la prova generale. |
| `proxy/` | Il progetto Vercel: `api/cec.js` più la configurazione. |

## Da dove arrivano i dati

La Commissione non ha un'API JSON. Durante lo spoglio pubblica due CSV piatti, che nel 2022 erano aggiornati ogni pochi minuti:

- `https://media26.bechirot.gov.il/files/expc.csv`: una riga per località. Le colonne sono `סמל ועדה, שם ישוב, סמל ישוב, בזב, מצביעים, פסולים, כשרים`, poi una colonna per ogni lettera di scheda. È il file che la dashboard interroga ogni 60 secondi.
- `https://media26.bechirot.gov.il/files/expb.csv`: una riga per seggio. La dashboard lo legge un ciclo su tre e lo usa solo per contare i seggi già scrutinati. Se manca, l'avanzamento resta una stima basata sui volumi del 2022.

Le doppie buste (militari, diplomatici, ospedali, carceri) sono una riga sola, «מעטפות חיצוניות», con codice 9999. Si contano dopo i seggi ordinari.

Le colonne delle liste si leggono dall'intestazione, non sono scritte nel codice. Una lettera sconosciuta compare come «Lista X» fra le altre.

Codifica: windows-1255 fino al 2021, UTF-8 con BOM nel 2022. Il proxy riconosce da solo la codifica e restituisce sempre UTF-8.

**Attenzione:** a differenza del 2022, `media26` e `votes26` puntano oggi a CloudFront (AWS) e non più alla rete governativa israeliana. CloudFront può applicare un blocco geografico. Va verificato prima del 27, vedi la diagnostica qui sotto.

## 1. Pubblicare il proxy su Vercel

Il nome del progetto deve essere `israele-2026-feed-proxy`. In questo modo l'indirizzo coincide con quello predefinito nella pagina: `https://israele-2026-feed-proxy.vercel.app/api/cec`.

Da riga di comando:

```
cd proxy
npx vercel link        # crea il progetto «israele-2026-feed-proxy»
npx vercel --prod
```

In alternativa, dalla dashboard di Vercel: *Add New → Project*, importa questo repository e imposta **Root Directory = `proxy`**. Non serve un framework né un comando di build.

La funzione gira a Francoforte (`fra1`, in `vercel.json`). Le richieste ammesse arrivano da `https://angrisanidj.github.io` e da `localhost`. Per aggiungere altri domini, modifica l'array `ORIGINI` in `api/cec.js`.

### Diagnostica, da fare subito e poi il giorno prima

```
https://israele-2026-feed-proxy.vercel.app/api/cec?diag=1
```

Restituisce, per `media26` e `media25`, lo stato HTTP, la latenza, l'intestazione `server`/`via` e le prime righe del file.

| Esito | Significato |
|---|---|
| 200 | Tutto a posto. |
| 404 | Il file non è ancora pubblicato: normale prima della sera del voto. |
| 403 | Blocco geografico o anti-bot. Il proxy non può aggirarlo da solo, vedi «Piano B». |

Se l'indirizzo del 2026 dovesse cambiare, imposta su Vercel la variabile d'ambiente `CEC_BASE` (per esempio `https://media26.bechirot.gov.il/files/`) e ripubblica. Non serve toccare il codice.

## 2. Pubblicare la pagina

Crea il repository `angrisanidj/risultati-israele` e carica tutto tranne `proxy/`. Puoi anche lasciarlo: non dà fastidio. Poi attiva GitHub Pages dal branch `main`, cartella root.

## 3. La prova generale

- **`…/risultati-israele/?prova=2022`** riproduce lo spoglio vero del 2022, località per località, con un cursore da 0 a 100%. Al 100% il riparto deve dare Likud 32, Yesh Atid 24, Sionismo religioso 14, Unità nazionale 12, Shas 11, UTJ 7, Yisrael Beitenu 6, Ra'am 5, Hadash–Ta'al 5, Laburisti 4: è il risultato ufficiale. Il codice è verificato anche sul 2021 (file in windows-1255).
- **`…/risultati-israele/?ed=25`** usa il feed live, ma dal server del 2022 (`media25`). Prova l'intera catena browser → Vercel → Commissione.
- **`?proxy=https://…`** sostituisce il proxy predefinito.

## La sera del voto

**Orari:** i seggi chiudono alle 22 israeliane, le **21 in Italia**. L'ora legale è già finita in entrambi i paesi, quindi la differenza è di un'ora.

### Exit poll

Kan 11, Canale 12, 13 e 14 pubblicano gli exit poll in seggi. Inseriscili nel riquadro «Exit poll», con l'ora, e premi **Salva stime**: restano solo nel tuo browser. Per pubblicarli a tutti:

1. premi **Copia per stime.json**;
2. incolla il contenuto in `stime.json` e fai il commit.

Le pagine aperte rileggono il file ogni due minuti. Le reti aggiornano i numeri nella notte: ripeti l'operazione con la nuova ora.

### Emiciclo

Con la fonte su «Automatica», l'emiciclo segue l'exit poll (prima Canale 12, poi Kan, 13 e 14) fino a metà scrutinio. Da lì passa ai voti contati. Il selettore «Fonte» forza una fonte qualsiasi.

### Accordi di eccedenza

Il termine per depositarli è il **16 ottobre**. Oggi in `stime.json` ci sono i quattro accordi firmati:

- Beyachad–Yisrael Beitenu;
- Yashar–Democratici;
- Likud–Sionismo religioso/Zehut;
- Lista unita–Ra'am.

Dopo il 16 ottobre, correggi l'elenco con quelli effettivamente depositati. Un accordo vale solo se entrambe le liste superano il 3,25%: la pagina lo segnala sotto la tabella.

### Se il feed si blocca

- **Importa CSV:** scarica `expc.csv` o `expb.csv` a mano dal sito della Commissione e caricalo. Il feed va in pausa finché non premi «Riprendi».
- **Inserimento manuale:** inserisci i voti nazionali per lista. Soglia e seggi si ricalcolano e il risultato manuale ha la precedenza finché non lo rimuovi.

### Piano B se CloudFront blocca le richieste dall'estero

Il proxy Vercel non ha una regione in Israele, quindi un blocco geografico va aggirato da fuori. Due strade:

- una funzione equivalente su un servizio con regione israeliana: Google Cloud `me-west1` (Tel Aviv) oppure AWS `il-central-1`. Il codice di `api/cec.js` si adatta in pochi minuti. Poi la si indica con `?proxy=`;
- in serata, i due fallback qui sopra.

## Liste e colori

Lettere di scheda approvate dalla Commissione per il 2026, fonti Ynet e Kan del 27 settembre 2026. Blocchi come nel modello previsionale:

| Blocco | Liste |
|---|---|
| Netanyahu | Likud (מחל), Sionismo religioso–Zehut (ט), Otzma Yehudit (ב), Shas (שס), UTJ (ג), Noam (ני) |
| Opposizione | Beyachad (רק), Yashar (דרך), Democratici (אמת), Yisrael Beitenu (ל), Blu e Bianco (כן) |
| Partiti arabi | Ra'am (עם), Lista unita (ודם) |
| Altri | Riservisti e Partito economico (די), Amcha Yisrael (ך), Israel First (י), Pubblico haredi (זך) |

Liste, colori e blocchi stanno in testa allo script, nella costante `LISTE['26']`.

## Fonti e licenze

- Voti: Commissione elettorale centrale (bechirot.gov.il).
- Confini delle località: Ufficio centrale di statistica, nella versione TopoJSON di [DarthVictor/israel-election-results](https://github.com/DarthVictor/israel-election-results) (licenza MIT), semplificata con mapshaper. L'unione con i dati avviene sul codice di località `סמל ישוב`. Le tribù beduine non riconosciute e i campi militari non hanno un poligono: entrano nei totali ma non nella mappa.
- Sagoma del paese e sottodistretti: [geoBoundaries](https://www.geoboundaries.org) ISR ADM2 (CC0), semplificati. La mappa ha due livelli. In «Aree» ogni località confluisce nel suo sottodistretto, con un'assegnazione spaziale fatta una volta e incorporata nella pagina. Le tribù beduine senza poligono vanno nell'area di Be'er Sheva; gli insediamenti in Cisgiordania formano un sedicesimo gruppo, «Giudea e Samaria». In «Località» c'è il dettaglio per centro abitato. Coprono il territorio di Israele entro la Linea verde più il Golan: la Cisgiordania resta senza sfondo e gli insediamenti vi compaiono come poligoni isolati.
- Base 2022: `expc.csv` definitivo della Knesset 25.
