# FAQ — Plotino

Domande frequenti per utenti e chi integra il bridge.

---

### Perché non posso aprire solo `index.html` dal Finder?

Molti browser bloccano `fetch()` da pagine servite come `file://` verso `http://127.0.0.1`. Avvia l’app con `./start.sh` (o un altro server HTTP) e usa un URL `http://…`.

---

### Cosa fa esattamente il bridge?

È un piccolo server Python in locale che:

1. **`POST /generate`** — chiama il provider IA (OpenAI, compatibile, Anthropic) con il tuo argomento e restituisce JSON con un post per piattaforma.
2. **`POST /publish`** — inoltra i post ai social usando token letti da **variabili d’ambiente** (consigliato) invece che solo dal browser.

Senza bridge non hai né generazione IA né pubblicazione automatica.

---

### Dove metto le chiavi: nel browser o in `plotino.env`?

| Approccio | Pro |
|-----------|-----|
| **`plotino.env`** (caricato da `start.sh`) | Le chiavi non restano nel profilo browser; adatto se il PC è condiviso o fai backup solo dei file env. |
| **Impostazioni nell’app** | Comodo per prove rapide; la chiave è in `localStorage`. |

Per uso quotidiano conviene **`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`** sul bridge e lasciare vuoto il campo nella pagina Impostazioni.

---

### Quanto costa «Genera con IA»?

Plotino non applica costi propri: paghi il provider (token di input/output) secondo il piano del modello scelto. Riduci costi usando modelli più piccoli (`gpt-4o-mini`, Haiku, ecc.) e brief più corti.

---

### Perché LinkedIn / Instagram danno errore dalla pubblicazione?

Il bridge implementa solo ciò che è indicato in [TECHNICAL.md](TECHNICAL.md): alcune piattaforme sono **stub** o richiedono flussi extra (OAuth, upload media). Verifica token, scope e messaggio di errore nel modale dopo «Vai».

---

### YouTube: perché a volte non pubblica?

Se nel concentratore non c’è un **file video**, il bridge non può fare upload nativo (serve API YouTube + OAuth). Puoi comunque generare **titolo e descrizione** con l’IA e incollarli in YouTube Studio.

---

### Che differenza c’è tra «Genera con IA» e «Adattamento locale»?

- **IA**: testi prodotti dal modello (hashtag e tono coerenti col prompt).
- **Adattamento locale**: regole fisse Plotino sul testo dell’argomento + hashtag euristici per rete, senza chiamata esterna.

«Adattamento locale» **azzera** la cache dei testi IA e ricalcola da zero.

---

### Posso usare modelli self-hosted (LM Studio, Ollama)?

Sì, se espongono un’API **compatibile OpenAI** (`/v1/chat/completions`). In Impostazioni scegli **Compatibile OpenAI** e imposta **URL base API** (es. `http://127.0.0.1:1234/v1`). Il bridge deve raggiungere quell’host (stessa macchina → OK).

---

### Il menu «Modello» in Impostazioni è vuoto o sbagliato

Serve il **bridge avviato** e una **chiave IA** valida (nel form o in `plotino.env`) affinché «Aggiorna dall’API» possa elencare i modelli. All’**avvio** si propone comunque un elenco **statico** per il provider scelto; al **cambio provider** l’elenco si aggiorna subito a quello tipico per la rete selezionata.

---

### Come resetto la configurazione nell’app?

Cancellazione manuale dai DevTools del browser: `Application` → `Local Storage` → chiavi che iniziano con `plotino-`. In alternativa usa una finestra anonima per prove pulite.
