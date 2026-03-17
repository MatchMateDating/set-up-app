(function () {
  var REVEAL_TIMEOUT_MS = 10000;
  var PROD_API_BASE_URL = "https://set-up-app-production.up.railway.app";

  var form = document.getElementById("matchmakerSignupForm");
  var signupSubtitle = document.getElementById("signupSubtitle");
  var stepEmail = document.getElementById("stepEmail");
  var stepNewAccount = document.getElementById("stepNewAccount");
  var backToEmailStepBtn = document.getElementById("backToEmailStepBtn");
  var existingEmailInput = document.getElementById("existingEmail");
  var existingReferralInput = document.getElementById("existingReferralCode");
  var existingSubmitBtn = document.getElementById("existingSubmitBtn");
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
  var currentStep = "email";

  var params = new URLSearchParams(window.location.search);
  var hashText = (window.location.hash || "").replace(/^#/, "");
  var hashQueryText = hashText.indexOf("?") >= 0 ? hashText.split("?")[1] : "";
  var hashParams = new URLSearchParams(hashQueryText);
  var referralFromQuery = (
    params.get("referral_code") ||
    params.get("referralCode") ||
    params.get("referral") ||
    params.get("code") ||
    params.get("ref") ||
    hashParams.get("referral_code") ||
    hashParams.get("referralCode") ||
    hashParams.get("referral") ||
    hashParams.get("code") ||
    hashParams.get("ref") ||
    ""
  ).trim();
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

  function setStep(stepName) {
    currentStep = stepName;
    stepEmail.classList.toggle("active", stepName === "email");
    stepNewAccount.classList.toggle("active", stepName === "new");

    if (stepName === "email") {
      signupSubtitle.textContent = "Enter your email to get started.";
    } else {
      signupSubtitle.textContent = "Create your account to help your dater find better matches.";
    }
    clearStatus();
  }

  function getActiveStepName() {
    if (stepEmail && stepEmail.classList.contains("active")) return "email";
    if (stepNewAccount && stepNewAccount.classList.contains("active")) return "new";
    return currentStep;
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

  function validateExistingForm() {
    var emailValue = getStepEmailValue();
    var referralValue = getStepReferralValue();
    if (!emailValue) {
      setStatus("Please enter your email.", "error");
      return false;
    }
    if (!isValidEmail(emailValue)) {
      setStatus("Please enter a valid email address.", "error");
      return false;
    }
    if (!referralValue) {
      setStatus("Referral code is required.", "error");
      return false;
    }
    return true;
  }

  function getStepEmailValue() {
    var liveInput = form.querySelector("#stepEmail #existingEmail");
    var value = liveInput && typeof liveInput.value === "string" ? liveInput.value : existingEmailInput.value;
    return (value || "").trim();
  }

  function getStepReferralValue() {
    var liveInput = form.querySelector("#stepEmail #existingReferralCode");
    var value = liveInput && typeof liveInput.value === "string" ? liveInput.value : existingReferralInput.value;
    return (value || "").trim();
  }

  function getSubmitButton() {
    var stepName = getActiveStepName();
    if (stepName === "email") return existingSubmitBtn;
    if (stepName === "new") return submitBtn;
    return null;
  }

  function setSubmitting(isSubmitting, label) {
    var activeBtn = getSubmitButton();
    if (!activeBtn) return;
    activeBtn.disabled = isSubmitting;
    activeBtn.textContent = isSubmitting ? label : activeBtn.getAttribute("data-default-label");
  }

  async function checkExistingAccountRole(email) {
    var response = await fetch(apiBaseUrl + "/auth/matchmaker-web/check-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
      }),
    });

    var data = {};
    try {
      data = await response.json();
    } catch (parseErr) {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.msg || "Could not verify account.");
    }

    return data;
  }

  async function submitExistingAccountFlow() {
    if (!validateExistingForm()) return;

    var existingEmail = getStepEmailValue().toLowerCase();
    var existingReferralCode = getStepReferralValue();

    setSubmitting(true, "Checking Account...");
    var accountCheck;
    try {
      accountCheck = await checkExistingAccountRole(existingEmail);
    } catch (err) {
      setStatus(err.message || "Could not verify account. Please try again.", "error");
      setSubmitting(false);
      return;
    }

    if (!accountCheck.exists) {
      setStatus("No account found. Create a new account below.", "error");
      emailInput.value = existingEmail;
      referralInput.value = existingReferralCode;
      setStep("new");
      setSubmitting(false);
      return;
    }

    setSubmitting(true, "Applying Referral...");
    try {
      var response = await fetch(apiBaseUrl + "/auth/register-matchmaker-web", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: existingEmail,
          referral_code: existingReferralCode,
          has_account: true,
        }),
      });

      var data = {};
      try {
        data = await response.json();
      } catch (parseErr) {
        data = {};
      }

      if (!response.ok) {
        setStatus(data.msg || "Could not process your existing account. Please try again.", "error");
        setSubmitting(false);
        return;
      }

      setStatus(data.message || "Done. Continue in the app to finish setup.", "success");
      var finishParams = new URLSearchParams();
      finishParams.set("flow", "existing");
      var referrerFirstName = (data.referrer_first_name || "").trim();
      if (referrerFirstName) {
        finishParams.set("referrer_first_name", referrerFirstName);
      }
      window.location.href = "signup-finish-in-app.html?" + finishParams.toString();
    } catch (err) {
      setStatus("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNewAccountFlow() {
    updateMismatchUI();
    if (!validateForm()) return;

    setSubmitting(true, "Creating Account...");
    try {
      var response = await fetch(apiBaseUrl + "/auth/register-matchmaker-web", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailInput.value.trim().toLowerCase(),
          password: passwordInput.value,
          referral_code: referralInput.value.trim(),
          has_account: false,
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

      window.location.href = "signup-finish-in-app.html";
    } catch (err) {
      setStatus("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearStatus();
    var stepName = getActiveStepName();
    currentStep = stepName;

    if (stepName === "email") {
      await submitExistingAccountFlow();
      return;
    }

    if (stepName === "new") {
      await submitNewAccountFlow();
      return;
    }

    setStatus("Please continue with signup.", "error");
  }

  function handleReferralInputChange(value) {
    var trimmed = (value || "").trim();
    referralInput.value = trimmed;
    existingReferralInput.value = trimmed;
  }

  function seedDefaultButtonLabels() {
    if (submitBtn) submitBtn.setAttribute("data-default-label", submitBtn.textContent);
    if (existingSubmitBtn) existingSubmitBtn.setAttribute("data-default-label", existingSubmitBtn.textContent);
  }

  function wireNavigation() {
    backToEmailStepBtn.addEventListener("click", function () {
      existingEmailInput.value = emailInput.value.trim() || existingEmailInput.value.trim();
      existingReferralInput.value = referralInput.value.trim() || existingReferralInput.value.trim();
      setStep("email");
    });
  }

  function wireInputs() {
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

    referralInput.addEventListener("input", function () {
      existingReferralInput.value = referralInput.value;
      clearStatus();
    });

    existingReferralInput.addEventListener("input", function () {
      referralInput.value = existingReferralInput.value;
      clearStatus();
    });

    emailInput.addEventListener("input", clearStatus);
    existingEmailInput.addEventListener("input", clearStatus);
  }

  if (referralFromQuery) {
    handleReferralInputChange(referralFromQuery);
  }

  seedDefaultButtonLabels();
  wireNavigation();
  wireInputs();
  form.addEventListener("submit", handleSubmit);
  updateRuleUI();
  setStep("email");
})();
