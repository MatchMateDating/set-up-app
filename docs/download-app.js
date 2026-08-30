(function () {
  function activateTab(tabName) {
    document.querySelectorAll(".install-tab").forEach(function (tab) {
      var isActive = tab.getAttribute("data-tab") === tabName;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    document.querySelectorAll(".install-panel").forEach(function (panel) {
      var isActive = panel.getAttribute("data-panel") === tabName;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  }

  function initTabs() {
    var tabs = document.querySelectorAll(".install-tab");
    if (!tabs.length) {
      return;
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        activateTab(tab.getAttribute("data-tab"));
      });

      tab.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
          return;
        }

        event.preventDefault();
        var tabList = Array.prototype.slice.call(tabs);
        var index = tabList.indexOf(tab);
        var nextIndex =
          event.key === "ArrowRight"
            ? (index + 1) % tabList.length
            : (index - 1 + tabList.length) % tabList.length;
        tabList[nextIndex].focus();
        activateTab(tabList[nextIndex].getAttribute("data-tab"));
      });
    });

    var hash = (window.location.hash || "").replace("#", "");
    if (hash === "android" || hash === "apple") {
      activateTab(hash);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTabs);
  } else {
    initTabs();
  }
})();
