(function () {
  var RESET_TIMEOUT_MS = 10000;
  var PROD_API_BASE_URL = "https://set-up-app-production.up.railway.app";

  var form = document.getElementById("resetForm");
  var passwordInput = document.getElementById("password");
  var confirmInput = document.getElementById("confirmPassword");
  var togglePasswordBtn = document.getElementById("togglePasswordBtn");
  var toggleConfirmBtn = document.getElementById("toggleConfirmBtn");
  var submitBtn = document.getElementById("submitBtn");
  var statusMessage = document.getElementById("statusMessage");
  var mismatchError = document.getElementById("mismatchError");
  var ruleLength = document.getElementById("ruleLength");
  var ruleUpper = document.getElementById("ruleUpper");
  var ruleLower = document.getElementById("ruleLower");
  var ruleSpecial = document.getElementById("ruleSpecial");

  var passwordTimer = null;
  var confirmTimer = null;
  var params = new URLSearchParams(window.location.search);
  var token = (params.get("token") || "").trim();
  var apiFromQuery = (params.get("api") || "").trim();
  var configuredApiBaseUrl = (window.RESET_API_BASE_URL || "").trim();
  var host = (window.location.hostname || "").trim();
  var isLocalLikeHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  var inferredLocalApiBaseUrl = host ? "http://" + host + ":5000" : "";
  var defaultApiBaseUrl =
    configuredApiBaseUrl ||
    (isLocalLikeHost && inferredLocalApiBaseUrl ? inferredLocalApiBaseUrl : PROD_API_BASE_URL);
  var apiBaseUrl = apiFromQuery || defaultApiBaseUrl;

  function clearStatus() {
    statusMessage.textContent = "";
    statusMessage.className = "status";
  }

  function setStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = "status " + type;
  }

  function getPasswordChecks(value) {
    var text = value || "";
    return {
      minLength: text.length >= 8,
      hasUppercase: /[A-Z]/.test(text),
      hasLowercase: /[a-z]/.test(text),
      hasSpecial: /[^A-Za-z0-9]/.test(text),
    };
  }

  function updateRuleUI() {
    var checks = getPasswordChecks(passwordInput.value);
    ruleLength.classList.toggle("pass", checks.minLength);
    ruleUpper.classList.toggle("pass", checks.hasUppercase);
    ruleLower.classList.toggle("pass", checks.hasLowercase);
    ruleSpecial.classList.toggle("pass", checks.hasSpecial);
  }

  function passwordsMatch() {
    return passwordInput.value === confirmInput.value;
  }

  function updateMismatchUI() {
    var shouldShow = confirmInput.value.length > 0 && !passwordsMatch();
    mismatchError.style.display = shouldShow ? "block" : "none";
  }

  function clearTimer(timerRefName) {
    if (timerRefName === "password" && passwordTimer) {
      clearTimeout(passwordTimer);
      passwordTimer = null;
    }
    if (timerRefName === "confirm" && confirmTimer) {
      clearTimeout(confirmTimer);
      confirmTimer = null;
    }
  }

  function toggleVisibility(input, btn, timerName) {
    var currentlyHidden = input.type === "password";

    if (!currentlyHidden) {
      input.type = "password";
      btn.textContent = "Show";
      clearTimer(timerName);
      return;
    }

    input.type = "text";
    btn.textContent = "Hide";
    clearTimer(timerName);

    var timeoutId = setTimeout(function () {
      input.type = "password";
      btn.textContent = "Show";
      if (timerName === "password") {
        passwordTimer = null;
      } else {
        confirmTimer = null;
      }
    }, RESET_TIMEOUT_MS);

    if (timerName === "password") {
      passwordTimer = timeoutId;
    } else {
      confirmTimer = timeoutId;
    }
  }

  function isStrongPassword() {
    var checks = getPasswordChecks(passwordInput.value);
    return checks.minLength && checks.hasUppercase && checks.hasLowercase && checks.hasSpecial;
  }

  function validateForm() {
    if (!token) {
      setStatus("Invalid reset link: missing token.", "error");
      return false;
    }

    if (!passwordInput.value) {
      setStatus("Please enter a new password.", "error");
      return false;
    }

    if (!isStrongPassword()) {
      setStatus("Password must include 8+ characters, uppercase, lowercase, and a special character.", "error");
      return false;
    }

    if (!confirmInput.value) {
      setStatus("Please confirm your new password.", "error");
      return false;
    }

    if (!passwordsMatch()) {
      setStatus("Passwords do not match.", "error");
      return false;
    }

    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearStatus();
    updateMismatchUI();

    if (!validateForm()) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Resetting...";

    try {
      var response = await fetch(apiBaseUrl + "/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token,
          password: passwordInput.value,
        }),
      });

      var data = {};
      try {
        data = await response.json();
      } catch (jsonErr) {
        data = {};
      }

      if (!response.ok) {
        setStatus(data.msg || "Unable to reset password. Please request a new link.", "error");
        return;
      }

      setStatus(data.message || "Password reset successfully. You can now return to the app and log in.", "success");
      form.reset();
      updateRuleUI();
      updateMismatchUI();
    } catch (err) {
      setStatus("Network error. Please try again.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Reset Password";
    }
  }

  togglePasswordBtn.addEventListener("click", function () {
    toggleVisibility(passwordInput, togglePasswordBtn, "password");
  });

  toggleConfirmBtn.addEventListener("click", function () {
    toggleVisibility(confirmInput, toggleConfirmBtn, "confirm");
  });

  passwordInput.addEventListener("input", function () {
    updateRuleUI();
    updateMismatchUI();
    clearStatus();
  });

  confirmInput.addEventListener("input", function () {
    updateMismatchUI();
    clearStatus();
  });

  form.addEventListener("submit", handleSubmit);

  updateRuleUI();
})();
