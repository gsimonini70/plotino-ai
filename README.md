# Plotino

Applicazione web statica per preparare **post multi-piattaforma** a partire da un argomento o brief, con **adattamento locale** (regole e hashtag per rete), **generazione assistita da IA** e opzionale **pubblicazione** tramite un bridge Python locale.

## Requisiti

- Browser moderno (accesso a `http://localhost`, fetch verso il bridge).
- **Python 3** per il bridge (`bridge/publish_server.py`) e per servire i file statici (`start.sh`).
- Chiavi API dove serve (social e/o modelli IA): vedi `plotino.env.example`.

## Avvio rapido

```bash
chmod +x start.sh
cp plotino.env.example plotino.env   # opzionale: configura chiavi e segreti
./start.sh
```

Si apre (su macOS) il browser su `http://127.0.0.1:5500/`. Il bridge ascolta di default su `http://127.0.0.1:8787` (`POST /publish`, `POST /generate`, `POST /ai-models`).

Variabili utili: `HTTP_PORT`, `BRIDGE_PORT`, `SKIP_BRIDGE=1`, `OPEN_BROWSER=0`.

## Documentazione

| Documento | Contenuto |
|-----------|-----------|
| [docs/USER.md](docs/USER.md) | Guida utente: interfaccia, IA, pubblicazione, impostazioni |
| [docs/TECHNICAL.md](docs/TECHNICAL.md) | Architettura, API del bridge, estensioni e sicurezza |
| [docs/FAQ.md](docs/FAQ.md) | FAQ: `file://`, chiavi, costi, piattaforme, reset |
| [docs/DIAGRAMS.md](docs/DIAGRAMS.md) | Diagrammi Mermaid (generazione IA, pubblicazione, config) |

## Repository

Codice e asset sono nella root del progetto (`index.html`, `app.js`, `styles.css`, ecc.); logica server solo in `bridge/`.
