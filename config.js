(function (global) {
  var STORAGE_KEY = "plotino-config-v1";

  var defaults = function () {
    return {
      bridgeUrl: "http://127.0.0.1:8787",
      bridgeSecret: "",
      platforms: {
        x: { enabled: true },
        instagram: { enabled: true },
        linkedin: { enabled: true },
        facebook: { enabled: true },
        tiktok: { enabled: true },
        youtube: { enabled: true },
      },
      ai: {
        provider: "openai",
        model: "gpt-4o-mini",
        baseUrl: "",
        apiKey: "",
      },
    };
  };

  function mergeDeep(a, b) {
    if (!b || typeof b !== "object") return a;
    var out = Array.isArray(a) ? a.slice() : Object.assign({}, a);
    for (var k in b) {
      if (
        b[k] &&
        typeof b[k] === "object" &&
        !Array.isArray(b[k]) &&
        typeof out[k] === "object" &&
        out[k] !== null &&
        !Array.isArray(out[k])
      ) {
        out[k] = mergeDeep(out[k], b[k]);
      } else {
        out[k] = b[k];
      }
    }
    return out;
  }

  function loadPlotinoConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults();
      var parsed = JSON.parse(raw);
      return mergeDeep(defaults(), parsed);
    } catch (e) {
      return defaults();
    }
  }

  function savePlotinoConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  global.PlotinoConfig = {
    STORAGE_KEY: STORAGE_KEY,
    defaults: defaults,
    load: loadPlotinoConfig,
    save: savePlotinoConfig,
  };
})(typeof window !== "undefined" ? window : this);
