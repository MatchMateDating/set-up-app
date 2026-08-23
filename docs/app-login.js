/**
 * Resolves the frontend-app Login URL (React route "/") and wires .btn-login links.
 * Override with window.APP_LOGIN_URL in config.local.js when needed.
 *
 * Production: Cloudflare Pages custom domain app.matchmatedating.com
 * (or your *.pages.dev URL until DNS is attached). Update PROD_APP_LOGIN_URL
 * after the first Pages deploy if you are not using app.matchmatedating.com yet.
 */
(function () {
  var PROD_APP_LOGIN_URL = "https://app.matchmatedating.com/";
  var host = (window.location.hostname || "").trim();
  var isLocalLikeHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  var configured = (window.APP_LOGIN_URL || "").trim();
  var inferredLocal =
    host && isLocalLikeHost ? "http://" + host + ":3000/" : "http://localhost:3000/";

  var loginUrl = configured || (isLocalLikeHost ? inferredLocal : PROD_APP_LOGIN_URL);
  if (loginUrl && loginUrl.charAt(loginUrl.length - 1) !== "/") {
    loginUrl += "/";
  }

  window.APP_LOGIN_URL = loginUrl;

  function applyLoginLinks() {
    document.querySelectorAll("a.btn-login, a[data-login-link]").forEach(function (link) {
      link.setAttribute("href", loginUrl);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyLoginLinks);
  } else {
    applyLoginLinks();
  }
})();
