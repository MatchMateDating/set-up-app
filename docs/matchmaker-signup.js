(function () {
  var REVEAL_TIMEOUT_MS = 10000;
  var PROD_API_BASE_URL = "https://set-up-app-production.up.railway.app";

  var form = document.getElementById("matchmakerSignupForm");
  var emailInput = document.getElementById("email");
  var passwordInput = document.getElementById("password");
  var confirmInput = document.getElementById("confirmPassword");
  var referralInput = document.getElementById("referralCode");
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
  var referralFromQuery = (params.get("referral_code") || params.get("ref") || "").trim();
  var apiFromQuery = (params.get("api") || "").trim();
  var configuredApiBaseUrl = (window.SIGNUP_API_BASE_URL || window.RESET_API_BASE_URL || "").trim();
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

  function setStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = "status " + type;
  }

  function clearStatus() {
    statusMessage.textContent = "";
    statusMessage.className = "status";
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
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

  function isStrongPassword() {
    var checks = getPasswordChecks(passwordInput.value);
    return checks.minLength && checks.hasUppercase && checks.hasLowercase && checks.hasSpecial;
  }

  function passwordsMatch() {
    return passwordInput.value === confirmInput.value;
  }

  function updateMismatchUI() {
    var showMismatch = confirmInput.value.length > 0 && !passwordsMatch();
    mismatchError.style.display = showMismatch ? "block" : "none";
  }

  function clearTimer(timerName) {
    if (timerName === "password" && passwordTimer) {
      clearTimeout(passwordTimer);
      passwordTimer = null;
    }
    if (timerName === "confirm" && confirmTimer) {
      clearTimeout(confirmTimer);
      confirmTimer = null;
    }
  }

  function toggleVisibility(input, btn, timerName) {
    var isHidden = input.type === "password";
    if (!isHidden) {
      input.type = "password";
      btn.textContent = "Show";
      clearTimer(timerName);
      return;
    }

    input.type = "text";
    btn.textContent = "Hide";
    clearTimer(timerName);

    var timeout = setTimeout(function () {
      input.type = "password";
      btn.textContent = "Show";
      if (timerName === "password") {
        passwordTimer = null;
      } else {
        confirmTimer = null;
      }
    }, REVEAL_TIMEOUT_MS);

    if (timerName === "password") {
      passwordTimer = timeout;
    } else {
      confirmTimer = timeout;
    }
  }

  function validateForm() {
    if (!emailInput.value.trim()) {
      setStatus("Please enter your email.", "error");
      return false;
    }
    if (!isValidEmail(emailInput.value.trim())) {
      setStatus("Please enter a valid email address.", "error");
      return false;
    }
    if (!passwordInput.value) {
      setStatus("Please enter a password.", "error");
      return false;
    }
    if (!isStrongPassword()) {
      setStatus("Password must include 8+ chars, uppercase, lowercase, and a special character.", "error");
      return false;
    }
    if (!confirmInput.value) {
      setStatus("Please confirm your password.", "error");
      return false;
    }
    if (!passwordsMatch()) {
      setStatus("Passwords do not match.", "error");
      return false;
    }
    if (!referralInput.value.trim()) {
      setStatus("Referral code is required.", "error");
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
    submitBtn.textContent = "Creating Account...";

    try {
      var response = await fetch(apiBaseUrl + "/auth/register-matchmaker-web", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailInput.value.trim(),
          password: passwordInput.value,
          referral_code: referralInput.value.trim(),
        }),
      });

      var data = {};
      try {
        data = await response.json();
      } catch (parseErr) {
        data = {};
      }

      if (!response.ok) {
        setStatus(data.msg || "Could not create account. Please try again.", "error");
        return;
      }

      var nextUrl = "signup-finish-in-app.html";
      window.location.href = nextUrl;
    } catch (err) {
      setStatus("Network error. Please try again.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Matchmaker Account";
    }
  }

  if (referralFromQuery) {
    referralInput.value = referralFromQuery;
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

  referralInput.addEventListener("input", clearStatus);
  emailInput.addEventListener("input", clearStatus);
  form.addEventListener("submit", handleSubmit);

  updateRuleUI();
})();
