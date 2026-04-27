# Documentazione tecnica Plotino

## Architettura generale

```
Browser (SPA statica)          Bridge Python (localhost)
─────────────────────          ─────────────────────────
index.html / app.js    ─HTTP──► POST /publish
config in localStorage         POST /generate
                               Env: token social + IA
```

- **Frontend**: HTML/CSS/JS senza build step. Stato UI e configurazione in **`localStorage`** (chiave `plotino-config-v1`). Selezione piattaforme salvata in `plotino-selection-v1`.
- **Bridge**: un solo processo `bridge/publish_server.py` (`http.server` standard library), endpoint **REST JSON** con CORS permissivo per sviluppo locale.

Non c è backend applicativo oltre al bridge: tutta la logica «smart» lato client o nei handler Python.

---

## Struttura repository

| Percorso | Ruolo |
|----------|--------|
| `index.html` | Shell pagina principale |
| `app.js` | UI, ricette per rete, hashtag profilati, cache testi IA (`aiPosts`), chiamate `/publish` e `/generate` |
| `config.js` | Load/save configurazione di default + merge |
| `settings.html` / `settings.js` | Form bridge + IA + toggle piattaforme |
| `styles.css` | Stili |
| `start.sh` | Carica `plotino.env`, avvia bridge + `python -m http.server` |
| `bridge/publish_server.py` | Pubblicazione social + proxy IA |
| `plotino.env.example` | Template variabili ambiente (non segreti in repo) |

---

## Configurazione frontend (`PlotinoConfig`)

Oggetto tipico (merge con default):

- `bridgeUrl`, `bridgeSecret`
- `platforms.<id>.enabled` — id: `x`, `instagram`, `linkedin`, `facebook`, `tiktok`, `youtube`
- `ai`: `provider` (`openai` \| `openai_compatible` \| `anthropic`), `model`, `baseUrl`, `apiKey`

---

## API bridge

Base URL configurabile (es. `http://127.0.0.1:8787`). Tutte le richieste sono `POST` con `Content-Type: application/json`.

### Autenticazione opzionale

Se è definita la variabile ambiente **`PUBLISH_SECRET`**, il body deve contenere `"secret": "<stesso valore>"`. In caso contrario il bridge risponde `401`.

### `POST /generate`

Generazione testi tramite LLM (OpenAI Chat Completions o Anthropic Messages).

**Body (campi principali)**

| Campo | Descrizione |
|-------|-------------|
| `topic` | Testo argomento/brief utente |
| `targets` | Array di stringhe id piattaforma |
| `provider` | Override provider |
| `model` | Nome modello |
| `base_url` | Base URL API OpenAI-compatibile (senza path finale `/chat/completions`) |
| `api_key` | Chiave inviata dal client (fallback se assente env sul server) |
| `media` | `{ "imageCount": n, "videoCount": n }` |

**Risposta successo**: `{ "ok": true, "posts": { "x": "...", ... } }`  
**Errore**: `{ "ok": false, "error": "..." }` con HTTP 400.

**Chiavi IA sul server** (se `api_key` nel body è vuota): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, opzionali `AI_MODEL`, `OPENAI_BASE_URL`, `AI_PROVIDER`.

Implementazione: prompt di sistema in italiano che impone JSON `{ "posts": { ... } }`. OpenAI usa `response_format: json_object` quando `provider === openai"`; in caso di errore HTTP 400 può essere ritentato senza JSON mode. Il contenuto viene parsato con stripping eventuale fence markdown.

### `POST /ai-models`

Elenco modelli chat disponibili sul provider (usato dalla pagina Impostazioni).

**Body:** `provider` (`openai`, `openai_compatible`, `anthropic`), opzionali `api_key`, `base_url`, `secret`.

**Risposta:** `{ "ok": true, "models": ["…"], "source": "api"|"fallback", "warning"? }`. Per OpenAI-compat: `GET …/models` con filtro euristico su id «chat»; Anthropic: `GET https://api.anthropic.com/v1/models` oppure fallback interno se la richiesta fallisce.

### `POST /publish`

Invio effettivo ai social (dove implementato).

**Body**

| Campo | Descrizione |
|-------|-------------|
| `targets` | Lista id piattaforma da pubblicare |
| `posts` | Mappa `id` → testo completo del post |
| `media` | Array `{ "mime", "base64" }` |

**Risposta**: `{ "ok": true, "results": { "<id>": { "ok": bool, "error"?, "note"?, "remote"? } } }`

---

## Stato implementazione pubblicazione

| Piattaforma | Comportamento nel bridge |
|-------------|---------------------------|
| X | POST tweet testuale (Bearer utente); media allegati richiedono Media Upload API (non inclusa). |
| Facebook Page | POST feed con token pagina. |
| LinkedIn | `ugcPosts` testuale. |
| Instagram | Stub / limitazioni Graph (hosting URL immagini). |
| TikTok | Stub. |
| YouTube | Stub upload; messaggio guida uso Studio. |

Estendere il bridge aggiungendo funzioni handler e voci in `HANDLERS`.

---

## Estensioni suggerite

- Validazione lunghezza post lato bridge prima dell’invio.
- Upload risorse su storage intermedio per Instagram/YouTube.
- OAuth completo per provider che non accettano solo bearer statico.
- Firma richieste lato server senza esporre chiavi nel browser (solo env).

---

## Sicurezza

- **`plotino.env`** è in `.gitignore**: non committare segreti.
- Chiavi IA nel **localStorage** sono visibili a chi ha accesso al profilo browser; per uso personale su una macchina è accettabile; in team preferire solo env sul bridge.
- Il bridge espone servizi su **localhost**: non esporre direttamente su Internet senza reverse proxy, TLS e autenticazione adeguata.

---

## Versioni e compatibilità

- Python: dipendenze solo dalla libreria standard per il bridge (urllib, ssl, http.server).
- Browser: ES2017+ consigliato (async/await, fetch).

---

## Vedi anche

- [FAQ.md](FAQ.md) — dettagli operativi su chiavi, costi IA e compatibilità browser.
- [DIAGRAMS.md](DIAGRAMS.md) — diagrammi di sequenza generate/publish e configurazione.
