/**
 * Plotino — concentratore, selezione multipla, pubblicazione via bridge.
 */

var SEL_KEY = "plotino-selection-v1";

var STOP_IT = new Set([
  "alla", "alle", "allo", "degli", "della", "delle", "dello", "questo", "questa",
  "questi", "queste", "quello", "quella", "quelli", "quelle", "come", "cosa",
  "dove", "quando", "perché", "perche", "anche", "solo", "molto", "tutto",
  "tutta", "tutti", "tutte", "nessun", "nessuna", "più", "meno", "prima",
  "dopo", "oggi", "ieri", "anno", "anni", "solo", "solo", "fare", "fanno",
  "essere", "sono", "stato", "stata", "stat", "hanno", "hai", "hai", "deve",
  "debbono", "alla", "negli", "nelle", "nell", "nello", "sulla", "sulle",
  "sullo", "tra", "fra", "però", "pero", "cioè", "cioe", "circa", "solo",
]);

var PLATFORM_ORDER = ["x", "instagram", "linkedin", "facebook", "tiktok", "youtube"];

function normalizeSpaces(t) {
  return String(t || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tokenizeWords(text) {
  var lower = text.toLowerCase();
  var out = [];
  var re = /[a-zàèéìòù]+/gi;
  var m;
  while ((m = re.exec(lower))) out.push(m[0]);
  return out;
}

/** Frequenza parole fuori stopword (pool per hashtag). */
function extractWordFrequencyEntries(text, poolMax) {
  poolMax = poolMax || 80;
  var words = tokenizeWords(text);
  var freq = {};
  var i;
  var w;
  for (i = 0; i < words.length; i++) {
    w = words[i];
    if (w.length < 3 || STOP_IT.has(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  var entries = [];
  for (w in freq) {
    if (!Object.prototype.hasOwnProperty.call(freq, w)) continue;
    entries.push({ w: w, f: freq[w], len: w.length });
  }
  entries.sort(function (a, b) {
    if (b.f !== a.f) return b.f - a.f;
    return a.w.localeCompare(b.w);
  });
  return entries.slice(0, poolMax);
}

/** Profili: quantità, lunghezza minima, stile (#minuscolo vs #Title), ordinamento. */
var HASHTAG_PROFILES = {
  x: {
    max: 2,
    minLen: 4,
    style: "lower",
    sort: "freq",
    note: "Poche hashtag (#): il feed penalizza l’abuso.",
  },
  instagram: {
    max: 22,
    minLen: 3,
    style: "lower",
    sort: "freq",
    note: "Mix parole ricorrenti + nicchia; fino a ~30 tag rilevanti.",
  },
  linkedin: {
    max: 5,
    minLen: 5,
    style: "title",
    sort: "long_first",
    note: "Poche parole-chiave professionali in forma leggibile (#Innovazione).",
  },
  facebook: {
    max: 6,
    minLen: 4,
    style: "lower",
    sort: "freq",
    note: "Hashtag mirati (marca/tema), non liste lunghe.",
  },
  tiktok: {
    max: 7,
    minLen: 3,
    style: "lower",
    sort: "short_first",
    note: "Tag corti e ricercabili, orientati al discovery.",
  },
  youtube: {
    max: 15,
    minLen: 4,
    style: "lower",
    sort: "freq",
    note: "Parole chiave per ricerca e tab Informazioni (no spam).",
  },
};

function sortEntriesForHashtags(entries, sortMode) {
  var arr = entries.slice();
  if (sortMode === "short_first") {
    arr.sort(function (a, b) {
      if (b.f !== a.f) return b.f - a.f;
      if (a.len !== b.len) return a.len - b.len;
      return a.w.localeCompare(b.w);
    });
  } else if (sortMode === "long_first") {
    arr.sort(function (a, b) {
      if (b.f !== a.f) return b.f - a.f;
      if (b.len !== a.len) return b.len - a.len;
      return a.w.localeCompare(b.w);
    });
  } else {
    arr.sort(function (a, b) {
      if (b.f !== a.f) return b.f - a.f;
      return a.w.localeCompare(b.w);
    });
  }
  return arr;
}

function formatHashtagToken(word, style) {
  var w = String(word).replace(/[^a-zàèéìòùA-ZÀÈÉÌÒÙ0-9]/gi, "");
  if (!w.length) return "";
  if (style === "title") {
    var lower = w.toLowerCase();
    return "#" + lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return "#" + w.toLowerCase();
}

/** Hashtag suggeriti coerenti con le convenzioni tipiche di ogni rete. */
function suggestedHashtagsFor(text, platformId) {
  var profile = HASHTAG_PROFILES[platformId] || HASHTAG_PROFILES.instagram;
  var rawEntries = extractWordFrequencyEntries(text, 100);
  var filtered = [];
  var i;
  for (i = 0; i < rawEntries.length; i++) {
    if (rawEntries[i].len >= profile.minLen) filtered.push(rawEntries[i]);
  }
  var sorted = sortEntriesForHashtags(filtered, profile.sort);
  var seen = {};
  var out = [];
  for (i = 0; i < sorted.length && out.length < profile.max; i++) {
    var tag = formatHashtagToken(sorted[i].w, profile.style);
    if (!tag || tag === "#") continue;
    var key = tag.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(tag);
  }
  return out;
}

function smartTruncate(text, max) {
  var t = normalizeSpaces(text);
  if (t.length <= max) return t;
  var slice = t.slice(0, Math.max(0, max - 1));
  var dot = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(".\n"));
  if (dot > max * 0.45) return slice.slice(0, dot + 1).trim();
  var bang = slice.lastIndexOf("! ");
  if (bang > max * 0.45) return slice.slice(0, bang + 1).trim();
  var q = slice.lastIndexOf("? ");
  if (q > max * 0.45) return slice.slice(0, q + 1).trim();
  var sp = slice.lastIndexOf(" ");
  var cut = sp > max * 0.35 ? slice.slice(0, sp) : slice;
  return cut.trimEnd() + "…";
}

function firstHookLine(text) {
  var t = normalizeSpaces(text);
  var line = t.split(/\n+/)[0] || t;
  return line.length > 200 ? smartTruncate(line, 200) : line;
}

function paragraphs(text) {
  return normalizeSpaces(text)
    .split(/\n\s*\n/)
    .map(function (p) {
      return p.replace(/\n/g, " ").trim();
    })
    .filter(Boolean);
}

function countChars(s) {
  return Array.from(String(s)).length;
}

/** ctx: { imageCount, videoCount, total } */
function buildMediaContext() {
  var imageCount = 0;
  var videoCount = 0;
  for (var i = 0; i < mediaItems.length; i++) {
    if (mediaItems[i].kind === "video") videoCount++;
    else imageCount++;
  }
  return {
    imageCount: imageCount,
    videoCount: videoCount,
    total: mediaItems.length,
  };
}

var recipes = {
  x: {
    id: "x",
    title: "X (Twitter)",
    limit: 280,
    badge: "Threads brevi · hashtag moderati",
    build: function (raw, tags, ctx) {
      ctx = ctx || {};
      var ic = ctx.imageCount || 0;
      var vc = ctx.videoCount || 0;
      var base = normalizeSpaces(raw);
      var tagLine = tags.slice(0, 2).join(" ");
      var sep = tagLine ? 2 : 0;
      var maxBody = tagLine ? 280 - tagLine.length - sep : 280;
      var body = smartTruncate(base, Math.max(40, maxBody));
      var out = tagLine ? body + "\n\n" + tagLine : body;
      if (countChars(out) > 280) out = smartTruncate(out, 280);
      var tips = [
        "Ideale: una domanda o un dato nel primo segmento per fermare lo scroll.",
        "Evita più di 2–3 hashtag inline per non sembrare spam.",
        ic ? "Carica le immagini direttamente nel post su X." : null,
        vc ? "Per il video su X allega il file dall’app o usa Media Upload API." : null,
      ].filter(Boolean);
      return { text: out, tips: tips };
    },
  },
  instagram: {
    id: "instagram",
    title: "Instagram",
    limit: 2200,
    badge: "Caption · prime righe visibili",
    build: function (raw, tags, ctx) {
      ctx = ctx || {};
      var ic = ctx.imageCount || 0;
      var base = normalizeSpaces(raw);
      var lines = base.split(/\n+/);
      var hook = (lines[0] || "").trim();
      var restBody = lines.slice(1).join("\n\n").trim();
      var rest = restBody ? "\n\n" + restBody : "";
      var tagBlock = tags.length ? "\n\n.\n.\n.\n" + tags.slice(0, 28).join(" ") : "";
      var caption = hook + rest + tagBlock;
      if (caption.length > 2150) {
        caption = smartTruncate(caption, 2100) + "\n\n" + tags.slice(0, 15).join(" ");
      }
      var tips = [
        "Le prime 125 caratteri compaiono senza “Altro”; metti il messaggio chiave lì.",
        "Usa interruzioni di riga per leggibilità; i puntini nascondono gli hashtag in fondo.",
        ic ? "Hai " + ic + " immagine/i pronte per il carosello." : "Aggiungi foto nel concentratore per pianificare il carosello.",
      ];
      return { text: caption, tips: tips };
    },
  },
  linkedin: {
    id: "linkedin",
    title: "LinkedIn",
    limit: 3000,
    badge: "Professionale · prime righe = anteprima",
    build: function (raw, tags, ctx) {
      ctx = ctx || {};
      var total = ctx.total || 0;
      var paras = paragraphs(raw);
      var body = paras.join("\n\n");
      if (body.length > 2800) body = smartTruncate(body, 2800);
      var tagEnd = tags.slice(0, 5).join(" ");
      var full = tagEnd ? body + "\n\n" + tagEnd : body;
      var tips = [
        "La prima riga compare nell’anteprima: rendila autosufficiente (problema + beneficio).",
        "Spaziatura tra paragrafi aumenta lettura su mobile.",
        total ? "Documenti e PDF possono accompagnare il post su LinkedIn." : null,
      ].filter(Boolean);
      return { text: full, tips: tips };
    },
  },
  facebook: {
    id: "facebook",
    title: "Facebook",
    limit: 5000,
    badge: "Coinvolgimento · prime due righe",
    build: function (raw, tags, ctx) {
      ctx = ctx || {};
      var total = ctx.total || 0;
      var paras = paragraphs(raw);
      var opener = paras[0] || normalizeSpaces(raw);
      var more = paras.slice(1).join("\n\n");
      var body = more ? opener + "\n\n" + more : opener;
      if (tags.length) body += "\n\n" + tags.slice(0, 8).join(" ");
      if (body.length > 4800) body = smartTruncate(body, 4800);
      var tips = [
        "Il feed taglia dopo ~400–500 caratteri: messaggio forte all’inizio.",
        "Domande chiuse o sondaggi impliciti aiutano i commenti.",
        total ? "Album e foto o video funzionano bene insieme al testo lungo." : null,
      ].filter(Boolean);
      return { text: body, tips: tips };
    },
  },
  tiktok: {
    id: "tiktok",
    title: "TikTok",
    limit: 2200,
    badge: "Breve · hashtag trending-friendly",
    build: function (raw, tags, ctx) {
      ctx = ctx || {};
      var vc = ctx.videoCount || 0;
      var ic = ctx.imageCount || 0;
      var short = smartTruncate(normalizeSpaces(raw), 280);
      var hashtagPick = tags.slice(0, 5);
      var line = short + (hashtagPick.length ? "\n\n" + hashtagPick.join(" ") : "");
      var tips = [
        "Prime parole visibili accanto al video: vai dritto al payoff.",
        "Aggiungi 3–5 hashtag pertinenti; TikTok premia nicchia + pertinenza.",
        vc
          ? "Video caricato: pubblicalo dal creator mobile con gli hashtag suggeriti."
          : ic
          ? "Per TikTok serve video: le immagini puoi usarle come storyboard o montaggio."
          : null,
      ].filter(Boolean);
      return { text: line, tips: tips };
    },
  },
  youtube: {
    id: "youtube",
    title: "YouTube",
    limit: 5000,
    badge: "Titolo · descrizione · SEO",
    build: function (raw, tags, ctx) {
      ctx = ctx || {};
      var vc = ctx.videoCount || 0;
      var ic = ctx.imageCount || 0;
      if (vc === 0) {
        return {
          text: "",
          tips: [
            "Senza file video nel concentratore non generiamo titolo né descrizione YouTube.",
            ic
              ? "Hai solo immagini statiche: per YouTube serve un video (o uno slideshow esportato come MP4)."
              : "Aggiungi un video con «Aggiungi foto o video» quando vuoi pubblicare su YouTube.",
          ],
          emptyOutput: true,
        };
      }
      var base = normalizeSpaces(raw);
      var title = smartTruncate(firstHookLine(base), 100);
      var tagStr = tags.length ? "\n\n" + tags.slice(0, 15).join(" ") : "";
      var description = base + tagStr;
      if (description.length > 4900) description = smartTruncate(description, 4900);
      var fullText =
        "TITOLO (≤100 caratteri consigliati)\n" +
        title +
        "\n\nDESCRIZIONE\n" +
        description +
        "\n\n---\nSuggerimento: aggiungi capitoli (0:00 Intro, …) se il video è lungo.";
      var tips = [
        "Prime ~157 caratteri della descrizione compaiono senza «Mostra altro».",
        "Titolo e prime righe influenzano CTR e ricerca; ripeti 1–2 parole chiave naturalmente.",
        vc > 1
          ? "Hai " + vc + " file video: YouTube Studio gestisce un upload alla volta."
          : null,
      ].filter(Boolean);
      return { text: fullText, tips: tips, emptyOutput: false };
    },
  },
};

/** Testi generati dall’IA (chiave = id piattaforma); vuoto = usa ricette Plotino. */
var aiPosts = {};

var mediaItems = [];

function getSelectablePlatforms() {
  var cfg = PlotinoConfig.load();
  var pl = cfg.platforms || {};
  return PLATFORM_ORDER.filter(function (id) {
    return !pl[id] || pl[id].enabled !== false;
  });
}

function loadSavedSelection() {
  try {
    var raw = localStorage.getItem(SEL_KEY);
    if (!raw) return null;
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch (e) {
    return null;
  }
}

function saveSelection(ids) {
  localStorage.setItem(SEL_KEY, JSON.stringify(ids));
}

function renderGallery() {
  var el = document.getElementById("gallery");
  var clearBtn = document.getElementById("clear-photos");
  el.innerHTML = "";
  if (mediaItems.length === 0) {
    var empty = document.createElement("div");
    empty.className = "gallery-empty";
    empty.textContent =
      "Nessun media — aggiungi immagini o video per anteprima, caroselli e YouTube.";
    el.appendChild(empty);
    clearBtn.disabled = true;
    return;
  }
  clearBtn.disabled = false;
  mediaItems.forEach(function (item, index) {
    var wrap = document.createElement("div");
    wrap.className = "thumb-wrap";
    var rm = document.createElement("button");
    rm.type = "button";
    rm.className = "thumb-remove";
    rm.setAttribute("aria-label", "Rimuovi elemento");
    rm.textContent = "×";
    rm.addEventListener("click", function () {
      URL.revokeObjectURL(item.url);
      mediaItems.splice(index, 1);
      renderGallery();
      refreshOutputs();
    });

    if (item.kind === "video") {
      var video = document.createElement("video");
      video.className = "thumb-video";
      video.src = item.url;
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("aria-label", item.name || "Anteprima video");
      wrap.appendChild(video);
    } else {
      var img = document.createElement("img");
      img.src = item.url;
      img.alt = item.name || "Anteprima";
      wrap.appendChild(img);
    }
    wrap.appendChild(rm);
    el.appendChild(wrap);
  });
}

function refreshOutputs() {
  var raw = document.getElementById("source-text").value;
  var ctx = buildMediaContext();

  Object.keys(recipes).forEach(function (key) {
    var r = recipes[key];
    var tags = suggestedHashtagsFor(raw, key);
    var hp = HASHTAG_PROFILES[key];
    var text;
    var tips;
    var emptyOut;

    if (aiPosts[key]) {
      text = aiPosts[key];
      tips = [];
      if (hp && hp.note) tips.push(hp.note);
      tips.push(
        "Generato con IA — clicca di nuovo «Genera con IA» dopo aver cambiato l’argomento, oppure «Adattamento locale» per le regole Plotino sul testo."
      );
      emptyOut = false;
    } else {
      var built = r.build(raw, tags, ctx);
      text = built.text;
      tips = built.tips.slice();
      if (hp && hp.note) tips.unshift(hp.note);
      emptyOut = !!built.emptyOutput;
    }

    var bodyEl = document.querySelector('[data-output-body="' + key + '"]');
    var meterEl = document.querySelector('[data-char-meter="' + key + '"]');
    var tipsEl = document.querySelector('[data-tips="' + key + '"]');
    var photoEl = document.querySelector('[data-photo-note="' + key + '"]');
    if (bodyEl) {
      bodyEl.classList.toggle("output-empty", emptyOut);
      bodyEl.textContent = emptyOut
        ? "(Nessun output senza video — YouTube genera titolo e descrizione solo con un file video.)"
        : text;
    }
    if (meterEl) {
      if (emptyOut && key === "youtube") {
        meterEl.textContent = "— / " + r.limit + " (serve video)";
        meterEl.classList.remove("over", "ok");
      } else {
        var n = countChars(text);
        var lim = r.limit;
        meterEl.textContent = n + " / " + lim + " caratteri";
        meterEl.classList.toggle("over", n > lim);
        meterEl.classList.toggle("ok", n <= lim);
      }
    }
    if (tipsEl) {
      tipsEl.innerHTML = "";
      tips.forEach(function (t) {
        var li = document.createElement("li");
        li.textContent = t;
        tipsEl.appendChild(li);
      });
    }
    if (photoEl) {
      var show = ctx.total > 0;
      photoEl.style.display = show ? "block" : "none";
      if (show) {
        var parts = [];
        if (ctx.imageCount) parts.push(ctx.imageCount + " immagine/i");
        if (ctx.videoCount) parts.push(ctx.videoCount + " video");
        photoEl.textContent =
          "📎 " + parts.join(", ") + " nel concentratore — ricorda di allegarli al pubblicare.";
      }
    }
  });

  syncCardVisibility();
}

function copyText(text) {
  function fallback() {
    var ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(fallback);
  } else {
    fallback();
  }
}

function buildPlatformPanels() {
  var container = document.getElementById("platform-panels");
  container.innerHTML = "";

  PLATFORM_ORDER.forEach(function (key) {
    var r = recipes[key];
    var card = document.createElement("article");
    card.className = "platform-card hidden";
    card.dataset.platformPanel = key;

    var meta = document.createElement("div");
    meta.className = "meta-row";
    var badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = r.badge;
    var meter = document.createElement("span");
    meter.className = "char-meter ok";
    meter.setAttribute("data-char-meter", key);
    meter.textContent = "0 / " + r.limit + " caratteri";
    meta.appendChild(badge);
    meta.appendChild(meter);

    var photoNote = document.createElement("p");
    photoNote.className = "photo-note";
    photoNote.setAttribute("data-photo-note", key);
    photoNote.style.display = "none";

    var copyRow = document.createElement("div");
    copyRow.className = "copy-row";
    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn-copy";
    copyBtn.textContent = "Copia testo";
    copyBtn.addEventListener("click", function () {
      var body = document.querySelector('[data-output-body="' + key + '"]');
      var t = body ? body.textContent || "" : "";
      if (body && body.classList.contains("output-empty")) {
        return;
      }
      if (body) copyText(t);
      copyBtn.textContent = "Copiato!";
      setTimeout(function () {
        copyBtn.textContent = "Copia testo";
      }, 1600);
    });

    var copyTags = document.createElement("button");
    copyTags.type = "button";
    copyTags.className = "btn-copy";
    copyTags.textContent = "Copia solo hashtag";
    copyTags.addEventListener("click", function () {
      var rawText = document.getElementById("source-text").value;
      copyText(suggestedHashtagsFor(rawText, key).join(" "));
      copyTags.textContent = "Copiati!";
      setTimeout(function () {
        copyTags.textContent = "Copia solo hashtag";
      }, 1600);
    });

    copyRow.appendChild(copyBtn);
    copyRow.appendChild(copyTags);

    var out = document.createElement("div");
    out.className = "output-body";
    out.setAttribute("data-output-body", key);

    var tips = document.createElement("ul");
    tips.className = "tips";
    tips.setAttribute("data-tips", key);

    card.appendChild(meta);
    card.appendChild(photoNote);
    card.appendChild(copyRow);
    card.appendChild(out);
    card.appendChild(tips);
    container.appendChild(card);
  });
}

function renderPlatformCheckboxes() {
  var wrap = document.getElementById("platform-checkboxes");
  var selectable = getSelectablePlatforms();
  var saved = loadSavedSelection();
  var initial = [];
  if (saved && saved.length) {
    saved.forEach(function (id) {
      if (selectable.indexOf(id) !== -1) initial.push(id);
    });
  }
  if (initial.length === 0) initial = selectable.slice();

  wrap.innerHTML = "";
  selectable.forEach(function (id) {
    var r = recipes[id];
    var label = document.createElement("label");
    label.className = "check-row-inline";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.platform = id;
    cb.checked = initial.indexOf(id) !== -1;
    cb.addEventListener("change", function () {
      persistSelectionFromUi();
      syncCardVisibility();
    });
    var span = document.createElement("span");
    span.textContent = r.title;
    label.appendChild(cb);
    label.appendChild(span);
    wrap.appendChild(label);
  });

  if (selectable.length === 0) {
    var p = document.createElement("p");
    p.className = "hint";
    p.innerHTML =
      'Nessuna piattaforma abilitata — vai in <a href="settings.html">Impostazioni</a>.';
    wrap.appendChild(p);
  }

  persistSelectionFromUi();
  syncCardVisibility();
}

function persistSelectionFromUi() {
  var ids = [];
  document.querySelectorAll("#platform-checkboxes input[type=checkbox]").forEach(function (cb) {
    if (cb.checked && cb.dataset.platform) ids.push(cb.dataset.platform);
  });
  saveSelection(ids);
}

function getSelectedPlatforms() {
  var ids = [];
  document.querySelectorAll("#platform-checkboxes input[type=checkbox]").forEach(function (cb) {
    if (cb.checked && cb.dataset.platform) ids.push(cb.dataset.platform);
  });
  return ids;
}

function syncCardVisibility() {
  var sel = getSelectedPlatforms();
  var set = {};
  sel.forEach(function (id) {
    set[id] = true;
  });
  PLATFORM_ORDER.forEach(function (key) {
    var card = document.querySelector('[data-platform-panel="' + key + '"]');
    if (!card) return;
    card.classList.toggle("hidden", !set[key]);
  });
}

function updatePublishHint() {
  var el = document.getElementById("publish-hint");
  var cfg = PlotinoConfig.load();
  var url = (cfg.bridgeUrl || "").trim();
  if (!url) {
    el.textContent = "Configura il bridge in Impostazioni.";
    return;
  }
  el.textContent = "Bridge: " + url + " · IA: POST /generate";
}

async function generateWithAi() {
  var targets = getSelectedPlatforms();
  if (targets.length === 0) {
    openModal("<p>Seleziona almeno una piattaforma nella colonna di destra.</p>");
    return;
  }
  var raw = normalizeSpaces(document.getElementById("source-text").value);
  if (!raw) {
    openModal("<p>Scrivi un argomento o brief nel campo sopra.</p>");
    return;
  }

  var cfg = PlotinoConfig.load();
  var base = (cfg.bridgeUrl || "").trim().replace(/\/$/, "");
  if (!base) {
    openModal(
      '<p>Configura l’URL del bridge nelle <a href="settings.html">Impostazioni</a> (stesso server che espone <code>/generate</code>).</p>'
    );
    return;
  }

  var ai = cfg.ai || {};
  var ctx = buildMediaContext();
  var btn = document.getElementById("btn-generate-ai");
  btn.disabled = true;
  btn.textContent = "Generazione…";

  try {
    var res = await fetch(base + "/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: cfg.bridgeSecret || "",
        topic: document.getElementById("source-text").value,
        targets: targets,
        provider: ai.provider || "openai",
        model: (ai.model || "").trim(),
        base_url: (ai.baseUrl || "").trim().replace(/\/$/, ""),
        api_key: (ai.apiKey || "").trim(),
        media: {
          imageCount: ctx.imageCount,
          videoCount: ctx.videoCount,
        },
      }),
    });
    var data = await res.json().catch(function () {
      return { ok: false, error: "Risposta non JSON dal bridge" };
    });
    if (!data.ok) {
      openModal(
        "<p><strong>Generazione non riuscita</strong></p><p>" +
          escapeHtml(data.error || "Errore sconosciuto") +
          "</p>"
      );
      return;
    }
    var posts = data.posts || {};
    aiPosts = {};
    targets.forEach(function (id) {
      if (posts[id]) aiPosts[id] = posts[id];
    });
    refreshOutputs();
  } catch (e) {
    openModal(
      "<p>Impossibile contattare il bridge (avviato con start.sh?).</p><pre>" +
        escapeHtml(String(e && e.message ? e.message : e)) +
        "</pre>"
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Genera con IA";
  }
}

function fileToMediaPayload(file) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () {
      var dataUrl = r.result;
      var comma = typeof dataUrl === "string" ? dataUrl.indexOf(",") : -1;
      var base64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
      resolve({
        mime: file.type || "application/octet-stream",
        base64: base64,
        kind: file.type.indexOf("video/") === 0 ? "video" : "image",
      });
    };
    r.onerror = function () {
      reject(r.error);
    };
    r.readAsDataURL(file);
  });
}

function openModal(html) {
  var overlay = document.getElementById("modal-overlay");
  var body = document.getElementById("modal-body");
  body.innerHTML = html;
  overlay.classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function onVai() {
  refreshOutputs();
  var targets = getSelectedPlatforms();
  if (targets.length === 0) {
    openModal("<p>Seleziona almeno una piattaforma.</p>");
    return;
  }

  var cfg = PlotinoConfig.load();
  var base = (cfg.bridgeUrl || "").trim().replace(/\/$/, "");
  if (!base) {
    openModal(
      '<p>Imposta l’URL del bridge nella pagina <a href="settings.html">Impostazioni</a>.</p>'
    );
    return;
  }

  var raw = document.getElementById("source-text").value;
  if (!normalizeSpaces(raw)) {
    openModal("<p>Inserisci un testo nel concentratore.</p>");
    return;
  }

  var ctx = buildMediaContext();

  var bridgeTargets = targets.filter(function (id) {
    if (id === "youtube" && ctx.videoCount === 0 && !aiPosts.youtube) return false;
    return true;
  });

  var posts = {};
  bridgeTargets.forEach(function (id) {
    var rec = recipes[id];
    if (!rec) return;
    if (aiPosts[id]) {
      posts[id] = aiPosts[id];
      return;
    }
    var tagsFor = suggestedHashtagsFor(raw, id);
    posts[id] = rec.build(raw, tagsFor, ctx).text;
  });

  var syntheticYoutube =
    targets.indexOf("youtube") !== -1 &&
    ctx.videoCount === 0 &&
    !aiPosts.youtube
      ? {
          ok: false,
          error:
            "Nessun video nel concentratore — pubblicazione YouTube non inviata (genera con IA un titolo/descrizione oppure carica un MP4/MOV).",
        }
      : null;

  var media = [];
  for (var i = 0; i < mediaItems.length; i++) {
    var p = mediaItems[i];
    if (p.file) {
      try {
        media.push(await fileToMediaPayload(p.file));
      } catch (e) {
        openModal("<p>Errore lettura media: " + escapeHtml(String(e)) + "</p>");
        return;
      }
    }
  }

  var btn = document.getElementById("btn-vai");
  btn.disabled = true;
  btn.textContent = "Invio…";

  if (bridgeTargets.length === 0) {
    btn.disabled = false;
    btn.textContent = "Vai";
    var linesOnly = ["<ul class=\"modal-list\">"];
    targets.forEach(function (id) {
      var label = recipes[id] ? recipes[id].title : id;
      var r = id === "youtube" ? syntheticYoutube : { ok: false, error: "Nessun target inviabile." };
      linesOnly.push("<li><strong>" + escapeHtml(label) + "</strong>: ");
      linesOnly.push('<span class="err-tag">saltato</span>');
      if (r && r.error) linesOnly.push(" — " + escapeHtml(r.error));
      linesOnly.push("</li>");
    });
    linesOnly.push("</ul>");
    openModal(linesOnly.join(""));
    return;
  }

  var payload = {
    secret: cfg.bridgeSecret || "",
    targets: bridgeTargets,
    posts: posts,
    media: media,
  };

  try {
    var res = await fetch(base + "/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    var data = await res.json().catch(function () {
      return { ok: false, error: "Risposta non JSON" };
    });
    if (!res.ok) {
      openModal(
        "<p><strong>Errore HTTP " +
          res.status +
          "</strong></p><pre>" +
          escapeHtml(JSON.stringify(data, null, 2)) +
          "</pre>"
      );
      return;
    }
    var results = data.results || {};
    if (syntheticYoutube) {
      results.youtube = syntheticYoutube;
    }
    var lines = ["<ul class=\"modal-list\">"];
    targets.forEach(function (id) {
      var r = results[id] || {};
      var ok = r.ok;
      var err = r.error || "";
      var note = r.note || "";
      var label = recipes[id] ? recipes[id].title : id;
      lines.push("<li>");
      lines.push("<strong>" + escapeHtml(label) + "</strong>: ");
      lines.push(ok ? '<span class="ok-tag">ok</span>' : '<span class="err-tag">errore</span>');
      if (err) lines.push(" — " + escapeHtml(err));
      if (note) lines.push("<br/><small>" + escapeHtml(note) + "</small>");
      lines.push("</li>");
    });
    lines.push("</ul>");
    if (data.ok === false && data.error) {
      lines.unshift("<p>" + escapeHtml(data.error) + "</p>");
    }
    openModal(lines.join(""));
  } catch (e) {
    openModal(
      "<p>Richiesta fallita (bridge avviato?).</p><pre>" +
        escapeHtml(String(e && e.message ? e.message : e)) +
        "</pre>"
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Vai";
  }
}

function init() {
  buildPlatformPanels();
  renderGallery();
  renderPlatformCheckboxes();
  updatePublishHint();

  document.getElementById("source-text").addEventListener("input", refreshOutputs);

  document.getElementById("photo-input").addEventListener("change", function (e) {
    var files = e.target.files;
    if (!files) return;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var isVid = file.type && file.type.indexOf("video/") === 0;
      var isImg = file.type && file.type.indexOf("image/") === 0;
      if (!isVid && !isImg) continue;
      mediaItems.push({
        url: URL.createObjectURL(file),
        name: file.name,
        file: file,
        kind: isVid ? "video" : "image",
      });
    }
    e.target.value = "";
    renderGallery();
    refreshOutputs();
  });

  document.getElementById("clear-photos").addEventListener("click", function () {
    mediaItems.forEach(function (p) {
      URL.revokeObjectURL(p.url);
    });
    mediaItems = [];
    renderGallery();
    refreshOutputs();
  });

  document.getElementById("select-all-platforms").addEventListener("click", function () {
    document.querySelectorAll("#platform-checkboxes input[type=checkbox]").forEach(function (cb) {
      cb.checked = true;
    });
    persistSelectionFromUi();
    syncCardVisibility();
  });

  document.getElementById("select-none-platforms").addEventListener("click", function () {
    document.querySelectorAll("#platform-checkboxes input[type=checkbox]").forEach(function (cb) {
      cb.checked = false;
    });
    persistSelectionFromUi();
    syncCardVisibility();
  });

  document.getElementById("btn-vai").addEventListener("click", function () {
    onVai();
  });

  document.getElementById("btn-generate-ai").addEventListener("click", function () {
    generateWithAi();
  });

  document.getElementById("btn-local-only").addEventListener("click", function () {
    aiPosts = {};
    refreshOutputs();
  });

  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", function (e) {
    if (e.target.id === "modal-overlay") closeModal();
  });

  refreshOutputs();
}

init();
