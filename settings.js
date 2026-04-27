(function () {
  var IDS = ["x", "instagram", "linkedin", "facebook", "tiktok", "youtube"];
  var LABELS = {
    x: "X (Twitter)",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    facebook: "Facebook",
    tiktok: "TikTok",
    youtube: "YouTube",
  };

  var CUSTOM_OPT = "__custom__";

  var STATIC_AI_MODELS = {
    openai: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-4-turbo-preview",
      "o1",
      "o1-mini",
      "o3-mini",
    ],
    openai_compatible: [
      "gpt-4o-mini",
      "deepseek-chat",
      "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      "llama3-70b-8192",
    ],
    anthropic: [
      "claude-sonnet-4-20250514",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getBridgeBase(cfg) {
    return (cfg.bridgeUrl || "").trim().replace(/\/$/, "");
  }

  function setHint(text, isErr) {
    var el = document.getElementById("ai-models-hint");
    el.textContent = text || "";
    el.style.color = isErr ? "#f87171" : "";
  }

  function syncCustomVisibility() {
    var sel = document.getElementById("ai-model-select");
    var custom = document.getElementById("ai-model-custom");
    var show = sel.value === CUSTOM_OPT;
    custom.classList.toggle("is-hidden", !show);
    if (!show) custom.value = "";
  }

  function fillSelectWithIds(sel, ids, preferredModel) {
    sel.innerHTML = "";
    ids.forEach(function (id) {
      var opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      sel.appendChild(opt);
    });
    var alt = document.createElement("option");
    alt.value = CUSTOM_OPT;
    alt.textContent = "— Altro (manuale) —";
    sel.appendChild(alt);

    var pref = (preferredModel || "").trim();
    var found = false;
    var i;
    for (i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === pref) {
        sel.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found && pref) {
      sel.value = CUSTOM_OPT;
      document.getElementById("ai-model-custom").value = pref;
    } else if (!found) {
      sel.selectedIndex = 0;
      document.getElementById("ai-model-custom").value = "";
    }
    syncCustomVisibility();
  }

  /** Elenco statico immediato al cambio provider. */
  function applyStaticList(provider, preferredModel) {
    var sel = document.getElementById("ai-model-select");
    var list = STATIC_AI_MODELS[provider] || STATIC_AI_MODELS.openai;
    fillSelectWithIds(sel, list.slice(), preferredModel);
  }

  function applyModelsFromApi(models, preferredModel) {
    var sel = document.getElementById("ai-model-select");
    if (!models || !models.length) return;
    var uniq = [];
    var seen = {};
    models.forEach(function (id) {
      id = String(id).trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      uniq.push(id);
    });
    uniq.sort();
    fillSelectWithIds(sel, uniq, preferredModel);
  }

  async function refreshModelsFromApi(opts) {
    opts = opts || {};
    var silent = !!opts.silent;
    var cfg = PlotinoConfig.load();
    var base = getBridgeBase(cfg);
    if (!base) {
      if (!silent) setHint("Imposta l’URL del bridge per caricare i modelli dall’API.", true);
      return;
    }

    var provider = document.getElementById("ai-provider").value || "openai";
    var sel = document.getElementById("ai-model-select");
    var currentSaved =
      sel.value === CUSTOM_OPT
        ? document.getElementById("ai-model-custom").value.trim()
        : sel.value;

    var btn = document.getElementById("ai-models-refresh");
    btn.disabled = true;

    try {
      var res = await fetch(base + "/ai-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: document.getElementById("bridge-secret").value || "",
          provider: provider,
          api_key: document.getElementById("ai-api-key").value || "",
          base_url: document.getElementById("ai-base-url").value.trim().replace(/\/$/, ""),
        }),
      });
      var data = await res.json().catch(function () {
        return { ok: false, error: "Risposta non JSON" };
      });
      if (!data.ok) {
        if (!silent) setHint(data.error || "Errore elenco modelli", true);
        return;
      }
      applyModelsFromApi(data.models || [], currentSaved);
      var msg =
        data.source === "api"
          ? "Elenco aggiornato dall’API del provider."
          : data.source === "fallback"
          ? "Elenco di fallback dal bridge."
          : "Elenco modelli aggiornato.";
      if (data.warning) msg += " " + data.warning;
      setHint(msg, false);
    } catch (e) {
      if (!silent) setHint(String(e && e.message ? e.message : e), true);
    } finally {
      btn.disabled = false;
    }
  }

  function renderToggles(cfg) {
    var wrap = document.getElementById("platform-toggles");
    wrap.innerHTML = "";
    IDS.forEach(function (id) {
      var row = document.createElement("label");
      row.className = "check-row";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.platform = id;
      cb.checked = !!(cfg.platforms && cfg.platforms[id] && cfg.platforms[id].enabled !== false);
      var span = document.createElement("span");
      span.textContent = LABELS[id];
      row.appendChild(cb);
      row.appendChild(span);
      wrap.appendChild(row);
    });
  }

  function readAiModelValue() {
    var sel = document.getElementById("ai-model-select");
    if (sel.value === CUSTOM_OPT) {
      return document.getElementById("ai-model-custom").value.trim();
    }
    return sel.value.trim();
  }

  document.getElementById("settings-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var cfg = PlotinoConfig.load();
    cfg.bridgeUrl = document.getElementById("bridge-url").value.trim().replace(/\/$/, "");
    cfg.bridgeSecret = document.getElementById("bridge-secret").value;
    cfg.ai = cfg.ai || {};
    cfg.ai.provider = document.getElementById("ai-provider").value || "openai";
    cfg.ai.model = readAiModelValue();
    cfg.ai.baseUrl = document.getElementById("ai-base-url").value.trim().replace(/\/$/, "");
    cfg.ai.apiKey = document.getElementById("ai-api-key").value;
    cfg.platforms = cfg.platforms || {};
    IDS.forEach(function (id) {
      var cb = document.querySelector('#platform-toggles input[data-platform="' + id + '"]');
      cfg.platforms[id] = cfg.platforms[id] || {};
      cfg.platforms[id].enabled = cb ? cb.checked : true;
    });
    PlotinoConfig.save(cfg);
    var msg = document.getElementById("save-msg");
    msg.textContent = "Salvato.";
    setTimeout(function () {
      msg.textContent = "";
    }, 2400);
  });

  function init() {
    var cfg = PlotinoConfig.load();
    document.getElementById("bridge-url").value = cfg.bridgeUrl || "";
    document.getElementById("bridge-secret").value = cfg.bridgeSecret || "";
    var ai = cfg.ai || {};
    document.getElementById("ai-provider").value = ai.provider || "openai";
    document.getElementById("ai-base-url").value = ai.baseUrl || "";
    document.getElementById("ai-api-key").value = ai.apiKey || "";

    var savedModel = (ai.model || "").trim();
    applyStaticList(ai.provider || "openai", savedModel);

    document.getElementById("ai-provider").addEventListener("change", function () {
      var p = document.getElementById("ai-provider").value || "openai";
      applyStaticList(p, "");
      setHint("", false);
      refreshModelsFromApi({ silent: true }).catch(function () {});
    });

    document.getElementById("ai-model-select").addEventListener("change", syncCustomVisibility);

    document.getElementById("ai-models-refresh").addEventListener("click", function () {
      refreshModelsFromApi({ silent: false });
    });

    refreshModelsFromApi({ silent: true }).catch(function () {});

    renderToggles(cfg);
  }

  init();
})();
