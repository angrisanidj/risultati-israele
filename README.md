# risultati-israele

Dashboard per seguire in diretta lo spoglio delle elezioni della 26ª Knesset (27 ottobre 2026). È costruita sulla falsariga di `risultati-svezia`: una sola pagina statica su GitHub Pages che legge i file della Commissione elettorale centrale (ועדת הבחירות המרכזית) attraverso un proxy Vercel.

## Cosa c'è

| File | A cosa serve |
|---|---|
| `index.html` | La dashboard, file unico. Mappa e base 2022 sono già incorporate. |
| `stime.json` | Exit poll (in seggi), accordi di eccedenza e ultima proiezione del modello previsionale. Si modifica a mano. |
| `dati/prova/expc-2022.csv` | Il file definitivo del 2022, usato per la prova generale. |
| `proxy/` | Il progetto Vercel: `api/cec.js` più la configurazione. |
| `.github/` | Il workflow che copia ogni giorno la proiezione del modello in `stime.json`, con il suo script. |
| `strumenti/pubblica-stime.mjs` | La sera del voto: controlla `stime.json`, lo pubblica e aspetta GitHub Pages. |

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
- **Feed spento fino alla sera del voto:** senza parametri la pagina non chiama il proxy fino a martedì 27 ottobre alle 20 italiane, poi si accende da sola. **`?feed=1`** la accende subito, per le prove. Il proxy su Vercel resta attivo: la diagnostica `?diag=1` funziona sempre.

## La sera del voto

**Orari:** i seggi chiudono alle 22 israeliane, le **21 in Italia**. L'ora legale è già finita in entrambi i paesi, quindi la differenza è di un'ora.

### Exit poll

Kan 11, Canale 12, 13 e 14 pubblicano gli exit poll in seggi. I lettori li vedono in sola lettura, come sono in `stime.json`. Per inserirli serve la **modalità redazione**.

**Attivarla.** Apri una volta la pagina con `?redazione=CHIAVE`. Il browser ricorda la chiave e la toglie dalla barra degli indirizzi; con `?redazione=esci` la dimentica. La chiave non è in questo repository: nel codice c'è solo la sua impronta SHA-256.

In modalità redazione compaiono:
- il pulsante «Cerca su Wikipedia»;
- le caselle degli exit poll;
- l'inserimento manuale;
- «Importa CSV»;
- la scheda «Card per X».

Non è una protezione vera, perché la pagina è statica. Ma quello che vedono i lettori lo decide solo `stime.json`, e lì scrive solo chi fa il push.

**La sera del voto, la strada principale: dagli screenshot a `stime.json`.**

1. Alle 21 italiane gli screenshot dei grafici delle reti vanno a Claude, anche in ebraico. Claude:
   - legge i seggi;
   - assegna ogni lista alla sua lettera di scheda con la tabella qui sotto;
   - scrive `stime.json` nella cartella del progetto.
2. Claude Code esegue `node strumenti/pubblica-stime.mjs`. Lo script:
   - controlla che ogni rete sommi a 120, con lettere valide e nessuna lista fra 1 e 3 seggi;
   - fa commit, `pull --rebase` e push;
   - aspetta che GitHub Pages serva il file nuovo.
   Se un controllo fallisce non pubblica niente e dice cosa correggere.
3. Per una prova senza pubblicare: `node strumenti/pubblica-stime.mjs --prova un-file.json`.

Le reti aggiornano i numeri nella notte: si ripete con la nuova ora.

**L'ora.** In `stime.json`, e nelle caselle della redazione, l'ora va scritta com'è nei grafici delle reti, cioè in ora israeliana: per esempio «נכון לשעה 01:00» si scrive `01:00`. La pagina la mostra ai lettori in ora italiana, un'ora indietro (01:00 → 00:00). Le ore prima di mezzogiorno valgono per la notte dopo il voto.

**Come compaiono le liste nei grafici delle reti**

| Lettera | Nella dashboard | Nei grafici (ebraico) | In inglese |
|---|---|---|---|
| מחל | Likud | הליכוד, ליכוד | Likud |
| דרך | Yashar | ישר!, איזנקוט | Yashar (Eisenkot) |
| רק | Beyachad | ביחד, בנט | Beyachad / Together (Bennett) |
| אמת | Democratici | הדמוקרטים | The Democrats |
| ל | Yisrael Beitenu | ישראל ביתנו, ליברמן | Yisrael Beiteinu |
| ב | Otzma Yehudit | עוצמה יהודית, בן גביר | Otzma Yehudit |
| שס | Shas | ש״ס | Shas |
| ג | UTJ | יהדות התורה | United Torah Judaism |
| ט | SR–Zehut | הציונות הדתית, סמוטריץ׳, זהות | Religious Zionism–Zehut |
| עם | Ra'am | רע״ם | Ra'am |
| ודם | Lista unita | הרשימה המשותפת, חד״ש-תע״ל, בל״ד | Joint List |
| די | Riservisti | המילואימניקים, הנדל | The Reservists |
| ך | Popolo d'Israele | עמך ישראל, וינטר | Amcha Yisrael (Winter) |
| כן | Blu e Bianco | כחול לבן, גנץ | Blue and White |
| ני | Noam | נעם | Noam |
| י | Israel First | ישראל תחילה, השכל | Israel First |
| זך | Haredi | הציבור החרדי | Haredi Public |

I nomi completi e le lettere delle 38 liste sono quelli pubblicati dalla Commissione ([Davar](https://www.davar1.co.il/698869/)). Nei grafici una lista sotto soglia compare spesso con 0 o non compare: in `stime.json` si omette.

**Piano B, dalla pagina in modalità redazione:**

1. Premi **Cerca su Wikipedia**. La pagina legge la tabella «Opinion polling for the 2026 Israeli legislative election» e cerca le righe del 27 ottobre di Kan 11, Canale 12, 13 e 14: nel 2022 gli exit poll erano lì, datati il giorno del voto. Le caselle si riempiono in ambra.
2. Verifica i numeri con la diretta, aggiungi l'ora e premi **Salva stime**.
3. Per pubblicarli premi **Copia per stime.json**, incolla in `stime.json` e fai il commit. Le pagine aperte rileggono il file ogni due minuti.

Le reti aggiornano i numeri nella notte: ripeti l'operazione con la nuova ora.

Se Wikipedia non ha ancora le righe, inserisci i seggi a mano. Per provare il pulsante prima del voto, `?wikidata=2026-10-07` cerca le righe di un altro giorno.

### Emiciclo

Con la fonte su «Automatica», l'emiciclo mostra la proiezione del [modello previsionale](https://angrisanidj.github.io/modello-israele/) fino agli exit poll. Poi segue l'exit poll (prima Canale 12, poi Kan, 13 e 14) fino a metà scrutinio, e da lì passa ai voti contati. Il selettore «Fonte» forza una fonte qualsiasi.

### Il modello alla prova

Il riquadro confronta la proiezione del modello con le fonti della notte, lista per lista e per blocco. Accanto a ogni numero c'è lo scarto dal modello. «Seggi spostati» è la metà della somma degli scarti.

- **Exit poll:** entrano appena sono in `stime.json`.
- **Scrutinio:** entra solo al 50% dei seggi contati (`CONFRONTO_DA`). Nel 2022 lo spoglio era al 44,4% alle 6:38 e al 62% alle 7:34 del mattino israeliano, cioè circa nove ore dopo la chiusura. Prima di quella soglia, le località che riportano per prime non rappresentano il paese.

**Aggiornare la proiezione.** Il campo `modello` di `stime.json` contiene:

- la data della proiezione;
- la data dell'ultimo sondaggio;
- il numero di rilevazioni;
- i seggi per lettera di scheda, che devono sommare 120;
- le quote di voto stimate.

Lo aggiorna da solo il workflow **Proiezione del modello** (`.github/workflows/modello.yml`), due volte al giorno (13:17 e 19:17 UTC) dal 10 al 26 ottobre:

1. apre la pagina del modello in Chromium, sull'archivio dei sondaggi del suo lavoro notturno;
2. legge seggi e quote;
3. riscrive solo il campo `modello`, e solo se la proiezione è cambiata.

Dal 27 ottobre non tocca più niente. Si ferma senza scrivere se il codice del modello cambia, se i seggi non sommano a 120 o se compare una lista senza lettera di scheda: in quel caso GitHub manda l'email del job fallito e resta la proiezione del giorno prima. Si può lanciare a mano da *Actions → Proiezione del modello → Run workflow*.

Siccome il workflow fa commit su `main`, prima di un push a mano conviene un `git pull --rebase`.

Se il campo manca o non somma a 120, la pagina usa la copia incorporata nel codice (`MODELLO_BASE`).

### Blocchi

Le pastiglie e i totali seguono le stesse ipotesi del modello:

- **Popolo d'Israele (Ofer Winter)** è nel blocco Netanyahu: Winter si è impegnato a raccomandare solo Netanyahu ed esclude governi dei suoi rivali.
- **Riservisti e Partito economico** sono fra le «altre liste»: non si schierano e non escludono nessuno.

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

## Condivisione

- **Pulsanti per i lettori.** Sono sette, in testa alla pagina: X, Threads, Facebook, LinkedIn, Telegram, WhatsApp e il link. Il testo segue i dati: prima del voto presenta la pagina, poi riporta i seggi del blocco Netanyahu. Il pulsante del link sul telefono apre il menu di condivisione del sistema, altrove copia l'indirizzo. Le icone vengono da [Bootstrap Icons](https://icons.getbootstrap.com) (licenza MIT), caricate da jsDelivr.
- **Anteprima del link.** Quando l'indirizzo viene condiviso su X, WhatsApp, Facebook o Telegram compare `condivisione.jpg`, 1200×630, attraverso i tag Open Graph e Twitter Card.
- **Card per X e Instagram.** Si trovano nella scheda in modalità redazione. «Formato» passa da X (16:9, 1600×900) a Instagram (4:5, 1080×1350), con un'impaginazione propria. Le card sono sei: il voto, seggi e blocchi, gli exit poll, la mappa, la soglia e «Il modello alla prova». Quest'ultima si attiva con il primo exit poll: confronta il modello con exit poll e scrutinio e riporta gli scarti e i seggi spostati. Per ogni card ci sono tre pulsanti:
  - **Scarica PNG** scarica l'immagine;
  - **Condividi** apre il menu del sistema con immagine e testo, da cui scegli Instagram, X o WhatsApp; dove il menu non c'è, scarica e copia il testo;
  - **Pubblica su X** apre X con il testo già scritto; l'immagine va allegata a mano.

## Liste e colori

Lettere di scheda approvate dalla Commissione per il 2026, fonti Ynet e Kan del 27 settembre 2026. Blocchi come nel modello previsionale:

| Blocco | Liste |
|---|---|
| Netanyahu | Likud (מחל), Sionismo religioso–Zehut (ט), Otzma Yehudit (ב), Shas (שס), UTJ (ג), Noam (ני), Popolo d'Israele (ך) |
| Opposizione | Beyachad (רק), Yashar (דרך), Democratici (אמת), Yisrael Beitenu (ל), Blu e Bianco (כן) |
| Partiti arabi | Ra'am (עם), Lista unita (ודם) |
| Altri | Riservisti e Partito economico (די), Israel First (י), Pubblico haredi (זך) |

Liste, colori e blocchi stanno in testa allo script, nella costante `LISTE['26']`.

## Fonti e licenze

- Voti: Commissione elettorale centrale (bechirot.gov.il).
- Confini delle località: Ufficio centrale di statistica, nella versione TopoJSON di [DarthVictor/israel-election-results](https://github.com/DarthVictor/israel-election-results) (licenza MIT), semplificata con mapshaper. L'unione con i dati avviene sul codice di località `סמל ישוב`. Le tribù beduine non riconosciute e i campi militari non hanno un poligono: entrano nei totali ma non nella mappa.
- Sagoma del paese e sottodistretti: [geoBoundaries](https://www.geoboundaries.org) ISR ADM2 (CC0), semplificati. La mappa ha due livelli. In «Aree» ogni località confluisce nel suo sottodistretto, con un'assegnazione spaziale fatta una volta e incorporata nella pagina. Le tribù beduine senza poligono vanno nell'area di Be'er Sheva; gli insediamenti in Cisgiordania formano un sedicesimo gruppo, «Giudea e Samaria». In «Località» c'è il dettaglio per centro abitato. Toccando un'area la mappa ci entra: ingrandisce sui suoi confini, colora ogni località al suo interno con il proprio risultato e nell'elenco mostra le località dell'area; «← Tutto il paese» torna alla vista d'insieme. I confini interni dei sottodistretti sono quelli a piena risoluzione di geoBoundaries. La linea di costa invece viene da [Natural Earth](https://www.naturalearthdata.com) (pubblico dominio), uguale per tutte le aree: il file di geoBoundaries lascia fuori alcune strisce costiere (Hadera, costa del Carmelo, baia di Haifa, Nahariya, Ashdod) e in altri tratti sconfina in mare. Coprono il territorio di Israele entro la Linea verde più il Golan: la Cisgiordania resta senza sfondo e gli insediamenti vi compaiono come poligoni isolati.
- Base 2022: `expc.csv` definitivo della Knesset 25.
