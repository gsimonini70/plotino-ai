# Guida utente Plotino

## Cosa fa Plotino

- **Concentratore**: un solo campo dove descrivi **argomento o brief** (anche informale o a elenco puntato).
- **Media**: puoi allegare **immagini** e **video** (anteprima in galleria); alcune piattaforme ne tengono conto nei suggerimenti o nella generazione IA.
- **Piattaforme**: selezioni con le checkbox quali reti preparare tra X, Instagram, LinkedIn, Facebook, TikTok, YouTube.
- **Colonna «Post ottimizzati»**: per ogni social selezionato compare una **scheda** con **titolo chiaro** (nome della rete, es. «Instagram», «X (Twitter)»), poi badge descrittivo, contatore caratteri, pulsanti copia e il testo del post.
- Per ogni rete hai un **post ottimizzato** (lunghezze e convenzioni tipiche), **suggerimenti** e **hashtag** adeguati alla piattaforma (in modalità solo adattamento locale).

Due modalità di contenuto nei riquadri:

1. **Adattamento locale** — regole interne Plotino sul testo dell’argomento (nessun costo IA).
2. **Generato con IA** — testi prodotti dal modello configurato (costo secondo il tuo provider).

---

## Flusso consigliato

1. Scrivi l’**argomento** nel campo principale (chi sei, cosa promuovi, pubblico, tono, date, link).
2. Seleziona le **piattaforme** da compilare.
3. Scegli una strada:
   - **Genera con IA** per bozze complete per ogni rete selezionata, hashtag inclusi dove ha senso.
   - Oppure **Adattamento locale** (pulsante dedicato) per usare solo le regole Plotino sullo stesso testo.
4. Rileggi e modifica manualmente copiando dai riquadri.
5. **Vai** invia al **bridge** i post pronti per la pubblicazione (serve bridge avviato e credenziali dei social dove applicabile).

---

## Generazione con IA

- Richiede il **bridge** in esecuzione (`./start.sh` o solo `python3 bridge/publish_server.py`) e una **chiave IA** valida.
- La chiave può stare in **`plotino.env`** sul computer (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, ecc.) oppure nel **form Impostazioni** (meno sicuro se il browser è condiviso).
- In **Impostazioni** scegli **provider** (OpenAI, compatibile OpenAI, Anthropic): il **menu Modello** si aggiorna con un elenco tipico per quel provider; puoi **Aggiorna dall’API** per caricare l’elenco reale dal bridge (`POST /ai-models`, chiave sul bridge o nel form). Opzione **«Altro (manuale)»** per un id modello personalizzato.
- Campi **URL base API** (solo compatibile OpenAI) e **chiave IA** opzionale come prima.
- L’IA usa le piattaforme **attualmente selezionate** nella colonna di destra e il contesto sul numero di immagini/video caricati.

Per tornare alle bozze Plotino senza testo IA: **Adattamento locale**.

---

## Pubblicazione («Vai»)

- Invia al bridge testo e media (in base64) per i target selezionati.
- **YouTube** senza file video nel concentratore non viene pubblicato automaticamente dal bridge (salvo bozza IA già generata come testo da incollare in Studio).
- Instagram / TikTok / YouTube sul bridge possono essere **parzialmente implementati** o in stub: leggi [TECHNICAL.md](TECHNICAL.md) per lo stato effettivo.

---

## Impostazioni

- **URL bridge**: deve coincidere con host/porta del server Python (es. `http://127.0.0.1:8787`).
- **Chiave condivisa**: opzionale; se imposti `PUBLISH_SECRET` nel bridge, usa la stessa stringa nell’app.
- **IA**: provider; **modello** (menu + aggiornamento da API); URL base (compatibile OpenAI); chiave opzionale.
- **Piattaforme**: puoi disabilitare reti che non usi (non compariranno nei checkbox).

La configurazione è salvata nel **browser** (`localStorage`), non sul server.

---

## Risoluzione problemi

| Problema | Cosa controllare |
|----------|------------------|
| «Genera con IA» fallisce | Bridge avviato? Chiave IA in `plotino.env` o in Impostazioni? Firewall su localhost? |
| Pagina bianca / fetch bloccato | Apri l’app via `http://127.0.0.1:…` dal `start.sh`, non come file `file://`. |
| Pubblicazione errore | Token social corretti in `plotino.env`? Piattaforma supportata dal bridge? |
| Hashtag strani in modalità locale | Prova a essere più specifico nell’argomento; in IA i tag sono guidati dal modello. |

---

## Vedi anche

- [FAQ.md](FAQ.md) — altre domande ricorrenti (file locale vs server, chiavi, modelli self-hosted).
- [DIAGRAMS.md](DIAGRAMS.md) — flussi visualizzati (generazione e pubblicazione).
