/* Auto-resize each microtool iframe (child page) by posting height to parent */
(function () {
  function postHeight() {
    var h = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    parent.postMessage({ type: "microtool-height", height: h }, "*");
  }
  window.addEventListener("load", postHeight);
  window.addEventListener("resize", postHeight);
  new MutationObserver(function () { postHeight(); })
    .observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
  setTimeout(postHeight, 100);
  setTimeout(postHeight, 400);
  setTimeout(postHeight, 1200);
})();
