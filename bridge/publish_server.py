#!/usr/bin/env python3
"""
Plotino — bridge di pubblicazione locale.
Legge i token da variabili d'ambiente (o da file .env caricabile manualmente).

Avvio:
  export PUBLISH_SECRET='la-tua-chiave'
  export X_BEARER_TOKEN='...'
  python3 publish_server.py

Endpoint:
  POST /publish — pubblicazione social
  POST /generate — generazione testi con IA (OpenAI / Anthropic / compatibile)
  Content-Type: application/json

Corpo publish:
{
  "secret": "opzionale — deve coincidere con PUBLISH_SECRET se impostato",
  "targets": ["x", "facebook", ...],
  "posts": { "x": "testo", ... },
  "media": [ { "mime": "image/jpeg", "base64": "..." }, ... ]
}
"""

from __future__ import annotations

import json
import os
import re
import ssl
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def _env(name: str) -> str | None:
    v = os.environ.get(name)
    return v if v else None


def _json_response(handler: BaseHTTPRequestHandler, status: int, obj: dict) -> None:
    b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(b)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(b)


def _read_body(handler: BaseHTTPRequestHandler, limit: int = 50 * 1024 * 1024) -> bytes:
    length = handler.headers.get("Content-Length")
    if not length:
        return b""
    n = int(length)
    if n > limit:
        raise ValueError("payload troppo grande")
    return handler.rfile.read(n)


def publish_x(text: str, media: List[Dict[str, Any]]) -> Dict[str, Any]:
    token = _env("X_BEARER_TOKEN")
    if not token:
        return {"ok": False, "error": "X_BEARER_TOKEN non impostato sul bridge"}

    payload = {"text": text[:280]}
    body = json.dumps(payload).encode("utf-8")
    req = Request(
        "https://api.twitter.com/2/tweets",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(req, timeout=60, context=ssl.create_default_context()) as resp:
            raw = resp.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
            out: Dict[str, Any] = {"ok": True, "remote": data}
            if media:
                out["note"] = (
                    "Immagini ricevute; allegare richiede Media Upload API v2 (non inclusa in questo bridge)."
                )
            return out
    except HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        return {"ok": False, "error": f"HTTP {e.code}: {err_body[:500]}"}
    except URLError as e:
        return {"ok": False, "error": str(e.reason)}


def publish_facebook(text: str, media: List[Dict[str, Any]]) -> Dict[str, Any]:
    page_token = _env("FACEBOOK_PAGE_ACCESS_TOKEN")
    page_id = _env("FACEBOOK_PAGE_ID")
    if not page_token or not page_id:
        return {
            "ok": False,
            "error": "FACEBOOK_PAGE_ACCESS_TOKEN o FACEBOOK_PAGE_ID mancanti",
        }

    # Feed testuale; foto richiede /photos separato
    q = urlencode({"message": text, "access_token": page_token})
    url = f"https://graph.facebook.com/v21.0/{page_id}/feed?{q}"
    req = Request(url, method="POST")
    try:
        with urlopen(req, timeout=60, context=ssl.create_default_context()) as resp:
            raw = resp.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
            out = {"ok": True, "remote": data}
            if media:
                out["note"] = (
                    "Immagini ricevute; per album/carousel usa Graph API /photos (estensione futura)."
                )
            return out
    except HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        return {"ok": False, "error": f"HTTP {e.code}: {err_body[:500]}"}
    except URLError as e:
        return {"ok": False, "error": str(e.reason)}


def publish_linkedin(text: str, media: List[Dict[str, Any]]) -> Dict[str, Any]:
    token = _env("LINKEDIN_ACCESS_TOKEN")
    author = _env("LINKEDIN_AUTHOR_URN")
    if not token or not author:
        return {
            "ok": False,
            "error": "LINKEDIN_ACCESS_TOKEN o LINKEDIN_AUTHOR_URN mancanti",
        }

    api = "https://api.linkedin.com/v2/ugcPosts"
    body_obj = {
        "author": author,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text[:2900]},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    body = json.dumps(body_obj).encode("utf-8")
    req = Request(
        api,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        },
    )
    try:
        with urlopen(req, timeout=60, context=ssl.create_default_context()) as resp:
            raw = resp.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
            out = {"ok": True, "remote": data}
            if media:
                out["note"] = "Immagini: per ugcPosts servono asset upload (non incluso qui)."
            return out
    except HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        return {"ok": False, "error": f"HTTP {e.code}: {err_body[:500]}"}
    except URLError as e:
        return {"ok": False, "error": str(e.reason)}


def publish_instagram(text: str, media: List[Dict[str, Any]]) -> Dict[str, Any]:
    token = _env("INSTAGRAM_ACCESS_TOKEN")
    ig_id = _env("INSTAGRAM_ACCOUNT_ID")
    if not token or not ig_id:
        return {
            "ok": False,
            "error": "INSTAGRAM_ACCESS_TOKEN o INSTAGRAM_ACCOUNT_ID mancanti",
        }
    if not media:
        return {
            "ok": False,
            "error": "Instagram richiede almeno un media (immagine) — aggiungi foto nel concentratore.",
        }
    # Stub: creazione container richiede URL pubblico immagine; base64 non va bene direttamente
    return {
        "ok": False,
        "error": "Instagram Graph richiede hosting immagini accessibile via URL; estendi il bridge con upload.",
    }


def publish_tiktok(text: str, media: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "ok": False,
        "error": "TikTok Content Posting API non configurata in questo bridge (stub).",
    }


def publish_youtube(text: str, media: List[Dict[str, Any]]) -> Dict[str, Any]:
    has_video = any(
        (m.get("mime") or "").startswith("video/") for m in media if isinstance(m, dict)
    )
    if not has_video:
        return {
            "ok": False,
            "error": "Serve almeno un file video nel payload media per YouTube.",
        }
    return {
        "ok": False,
        "error": "YouTube Data API (upload resumable + OAuth) non integrata in questo bridge — usa Studio o estendi lo script.",
        "note": "Titolo/descrizione sono già stati generati nell’interfaccia; incollali in Studio.",
    }


def parse_llm_json(content: str) -> Dict[str, Any]:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", content)
        content = re.sub(r"\s*```\s*$", "", content)
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            return json.loads(content[start : end + 1])
        raise


def build_generation_prompt(
    topic: str, targets: List[str], image_count: int, video_count: int
) -> tuple[str, str]:
    system = (
        "Sei un copywriter e strategist italiano per social media. "
        "Devi produrre testi pronti alla pubblicazione, con hashtag mirati all’audience giusta per l’argomento. "
        "Rispondi SOLO con JSON valido UTF-8: oggetto con chiave \"posts\" (oggetto che mappa id piattaforma -> stringa testo completa). "
        "Niente markdown fuori dal JSON, niente commenti."
    )
    rules = (
        "Regole per piattaforma:\n"
        '- "x": massimo 280 caratteri TOTALI. Stile conciso, forte apertura; 1–2 hashtag pertinenti (non spam).\n'
        '- "instagram": caption con hook nelle prime righe; corpo leggibile; poi tre righe solo con "." poi blocco hashtag pertinenti (circa 15–22 tag mirati su nicchia/discovery).\n'
        '- "linkedin": tono professionale, paragrafi brevi; 3–5 hashtag in #ParolaConMaiuscolaIniziale per parola significativa.\n'
        '- "facebook": tono social e chiaro; 2–6 hashtag tematici.\n'
        '- "tiktok": caption breve; 5–7 hashtag corti orientati al discovery.\n'
        '- "youtube": se non c\'è video nel progetto, prepara comunque TITOLO (≤100 car.) e DESCRIZIONE lunga con parole chiave SEO e hashtag in fondo; indica che il file video va caricato in Studio.\n'
        "Usa SOLO questi id come chiavi in posts: "
        + ", ".join(f'"{t}"' for t in targets)
        + ".\n"
    )
    user = (
        f"Argomento / brief dell'utente:\n---\n{topic}\n---\n\n"
        f"Media nel progetto: {image_count} immagini, {video_count} video.\n\n"
        + rules
        + '\nEsempio struttura JSON: {"posts":{"x":"..."}}\n'
        "Includi sempre tutte le piattaforme richieste con testo non vuoto."
    )
    return system, user


def call_openai_chat(
    base: str,
    api_key: str,
    model: str,
    system: str,
    user: str,
    json_mode: bool,
) -> str:
    url = base.rstrip("/") + "/chat/completions"
    payload: Dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.72,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    body = json.dumps(payload).encode("utf-8")
    req = Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    with urlopen(req, timeout=180, context=ssl.create_default_context()) as resp:
        raw = resp.read().decode("utf-8")
    data = json.loads(raw) if raw else {}
    choices = data.get("choices") or []
    if not choices:
        raise ValueError("risposta OpenAI senza choices")
    msg = choices[0].get("message") or {}
    return str(msg.get("content") or "")


def call_openai_chat_fallback_no_json_mode(
    base: str, api_key: str, model: str, system: str, user: str
) -> str:
    return call_openai_chat(base, api_key, model, system, user, False)


def call_anthropic_chat(api_key: str, model: str, system: str, user: str) -> str:
    url = "https://api.anthropic.com/v1/messages"
    payload: Dict[str, Any] = {
        "model": model,
        "max_tokens": 8192,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    body = json.dumps(payload).encode("utf-8")
    req = Request(
        url,
        data=body,
        method="POST",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
    )
    with urlopen(req, timeout=180, context=ssl.create_default_context()) as resp:
        raw = resp.read().decode("utf-8")
    data = json.loads(raw) if raw else {}
    parts = data.get("content") or []
    texts: List[str] = []
    for p in parts:
        if isinstance(p, dict) and p.get("type") == "text":
            texts.append(str(p.get("text") or ""))
    return "".join(texts)


def run_ai_generation(data: Dict[str, Any]) -> Dict[str, Any]:
    topic = (data.get("topic") or "").strip()
    targets = data.get("targets") or []
    if not topic:
        return {"ok": False, "error": "topic vuoto"}
    if not isinstance(targets, list) or not targets:
        return {"ok": False, "error": "targets vuoto"}
    mc = data.get("media") or {}
    img = int(mc.get("imageCount") or 0)
    vid = int(mc.get("videoCount") or 0)
    provider = (data.get("provider") or _env("AI_PROVIDER") or "openai").strip().lower()
    model_in = (data.get("model") or "").strip()
    base_url = (data.get("base_url") or _env("OPENAI_BASE_URL") or "").strip().rstrip("/")
    api_key_body = (data.get("api_key") or "").strip()

    system, user_p = build_generation_prompt(topic, [str(t) for t in targets], img, vid)

    if provider in ("openai", "openai_compatible"):
        api_key = api_key_body or _env("OPENAI_API_KEY")
        if not api_key:
            return {"ok": False, "error": "Chiave OpenAI mancante (bridge OPENAI_API_KEY o campo in app)"}
        model = model_in or _env("AI_MODEL") or "gpt-4o-mini"
        base = base_url or "https://api.openai.com/v1"
        json_mode = provider == "openai"
        try:
            raw = call_openai_chat(base, api_key, model, system, user_p, json_mode)
            parsed = parse_llm_json(raw)
        except HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")[:800]
            if json_mode and e.code == 400:
                try:
                    raw = call_openai_chat_fallback_no_json_mode(
                        base, api_key, model, system, user_p
                    )
                    parsed = parse_llm_json(raw)
                except Exception as e2:
                    return {"ok": False, "error": f"OpenAI HTTP {e.code}: {err} | retry {e2}"}
            else:
                return {"ok": False, "error": f"OpenAI HTTP {e.code}: {err}"}
        except Exception as e:
            return {"ok": False, "error": f"OpenAI: {e}"}
    elif provider == "anthropic":
        api_key = api_key_body or _env("ANTHROPIC_API_KEY")
        if not api_key:
            return {"ok": False, "error": "Chiave Anthropic mancante (ANTHROPIC_API_KEY o campo in app)"}
        model = model_in or _env("AI_MODEL") or "claude-sonnet-4-20250514"
        try:
            raw = call_anthropic_chat(api_key, model, system, user_p)
            parsed = parse_llm_json(raw)
        except HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")[:800]
            return {"ok": False, "error": f"Anthropic HTTP {e.code}: {err}"}
        except Exception as e:
            return {"ok": False, "error": f"Anthropic: {e}"}
    else:
        return {"ok": False, "error": f"Provider sconosciuto: {provider}"}

    posts_raw = parsed.get("posts") if isinstance(parsed, dict) else None
    if not isinstance(posts_raw, dict):
        return {"ok": False, "error": "La IA non ha restituito un oggetto posts valido"}

    out_posts: Dict[str, str] = {}
    for t in targets:
        k = str(t)
        val = posts_raw.get(k)
        if val is None:
            val = posts_raw.get(k.replace("-", "_"))
        if isinstance(val, str) and val.strip():
            out_posts[k] = val.strip()
    if not out_posts:
        return {"ok": False, "error": "Nessun post non vuoto nelle chiavi richieste"}

    return {"ok": True, "posts": out_posts}


HANDLERS: Dict[str, Any] = {
    "x": publish_x,
    "facebook": publish_facebook,
    "linkedin": publish_linkedin,
    "instagram": publish_instagram,
    "tiktok": publish_tiktok,
    "youtube": publish_youtube,
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self) -> None:
        try:
            raw = _read_body(self)
            data = json.loads(raw.decode("utf-8"))
        except Exception as e:
            _json_response(self, 400, {"ok": False, "error": "JSON non valido: " + str(e)})
            return

        secret_env = _env("PUBLISH_SECRET")
        secret_body = data.get("secret") or ""
        if secret_env and secret_body != secret_env:
            _json_response(self, 401, {"ok": False, "error": "secret non valido"})
            return

        if self.path == "/generate":
            result = run_ai_generation(data)
            status = 200 if result.get("ok") else 400
            _json_response(self, status, result)
            return

        if self.path != "/publish":
            _json_response(self, 404, {"ok": False, "error": "not found"})
            return

        targets = data.get("targets") or []
        posts = data.get("posts") or {}
        media = data.get("media") or []

        if not isinstance(targets, list) or not targets:
            _json_response(self, 400, {"ok": False, "error": "targets vuoto"})
            return

        results: dict[str, dict] = {}
        for t in targets:
            key = str(t)
            fn = HANDLERS.get(key)
            text = posts.get(key, "") if isinstance(posts, dict) else ""
            if not fn:
                results[key] = {"ok": False, "error": "piattaforma sconosciuta"}
                continue
            if not str(text).strip():
                results[key] = {"ok": False, "error": "testo vuoto"}
                continue
            results[key] = fn(str(text), media if isinstance(media, list) else [])

        _json_response(self, 200, {"ok": True, "results": results})


def main() -> None:
    host = os.environ.get("BIND_HOST", "127.0.0.1")
    port = int(os.environ.get("BIND_PORT", "8787"))
    httpd = HTTPServer((host, port), Handler)
    print(
        f"Plotino bridge su http://{host}:{port}  (POST /publish, POST /generate)",
        file=sys.stderr,
    )
    httpd.serve_forever()


if __name__ == "__main__":
    main()
