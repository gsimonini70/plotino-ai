# Diagrammi — Plotino

Diagrammi in **Mermaid** (supportati su GitHub nella visualizzazione Markdown). Utile per onboarding tecnico.

---

## Generazione contenuti con IA

```mermaid
sequenceDiagram
    participant U as Utente
    participant B as Browser (app.js)
    participant S as Bridge Python
    participant L as Provider IA

    U->>B: Argomento + checkbox piattaforme
    U->>B: Clic «Genera con IA»
    B->>S: POST /generate<br/>topic, targets, provider, media counts
    Note over S: auth opzionale secret
    S->>L: Chat / Messages + prompt italiano
    L-->>S: JSON posts per piattaforma
    S-->>B: { ok, posts: { x, instagram, ... } }
    B->>B: Cache aiPosts + refresh UI
```

---

## Pubblicazione sul bridge

```mermaid
sequenceDiagram
    participant U as Utente
    participant B as Browser
    participant S as Bridge Python
    participant N as API social esterne

    U->>B: Clic «Vai»
    B->>B: Costruisce posts (+ media base64)
    B->>S: POST /publish<br/>targets, posts, media
    Note over S: Legge token da env
    loop Per ogni target
        S->>N: HTTP API specifica (Graph, X, ecc.)
        N-->>S: risposta o errore
    end
    S-->>B: { ok, results per piattaforma }
    B->>U: Modale esito
```

---

## Flusso dati configurazione

```mermaid
flowchart LR
    subgraph Browser
        LS[(localStorage<br/>plotino-config-v1)]
        UI[Interfaccia Plotino]
        LS <--> UI
    end
    subgraph Host locale
        ENV[plotino.env]
        SH[start.sh]
        BR[bridge publish_server.py]
        ENV --> SH
        SH --> BR
    end
    UI -->|HTTP POST| BR
```

La configurazione **bridge URL / IA** è nel browser; i **segreti sensati** restano preferibilmente in `plotino.env` process environment del processo bridge.
