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

  document.getElementById("settings-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var cfg = PlotinoConfig.load();
    cfg.bridgeUrl = document.getElementById("bridge-url").value.trim().replace(/\/$/, "");
    cfg.bridgeSecret = document.getElementById("bridge-secret").value;
    cfg.ai = cfg.ai || {};
    cfg.ai.provider = document.getElementById("ai-provider").value || "openai";
    cfg.ai.model = document.getElementById("ai-model").value.trim();
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
    document.getElementById("ai-model").value = ai.model || "";
    document.getElementById("ai-base-url").value = ai.baseUrl || "";
    document.getElementById("ai-api-key").value = ai.apiKey || "";
    renderToggles(cfg);
  }

  init();
})();
