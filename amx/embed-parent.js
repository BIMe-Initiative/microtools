(function () {
  var GH_EMBED_URL = "https://bime-initiative.github.io/microtools/amx/index.html";
  var VERSION = "1"; // bump this when you update the tool
  var ALLOWED_ORIGIN = "https://bime-initiative.github.io";

  var iframe = document.getElementById("amx-iframe");

  function setSrcFromHash() {
    var base = encodeURIComponent(location.origin + location.pathname);
    var sep = GH_EMBED_URL.indexOf("?") === -1 ? "?" : "&";
    var src = GH_EMBED_URL + sep + "base=" + base + "&v=" + VERSION + (location.hash || "");
    iframe.src = src;
  }

  setSrcFromHash();
  window.addEventListener("hashchange", setSrcFromHash);

  window.addEventListener("message", function (e) {
    if (e.origin !== ALLOWED_ORIGIN) return;
    if (e.data && e.data.type === "microtool-height") {
      var h = Math.max(400, Math.ceil(e.data.height));
      iframe.style.height = h + "px";
    }
  }, false);
})();
