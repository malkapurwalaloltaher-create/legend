function setupSidebarToggle() {
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebarToggle");

  if (sidebar && sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("show");
    });
  }
}

function setupPrettySelects() {
  document.querySelectorAll("select.input").forEach((select) => {
    if (select.dataset.prettyReady === "true") return;
    select.dataset.prettyReady = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "pretty-select-wrapper";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "pretty-select-trigger";

    const triggerText = document.createElement("span");
    triggerText.className = "pretty-select-text";

    const arrow = document.createElement("span");
    arrow.className = "pretty-select-arrow";
    arrow.textContent = "⌄";

    trigger.appendChild(triggerText);
    trigger.appendChild(arrow);

    const panel = document.createElement("div");
    panel.className = "pretty-select-panel";

    const search = document.createElement("input");
    search.className = "pretty-select-search";
    search.placeholder = "Search channels...";
    search.type = "text";

    const list = document.createElement("div");
    list.className = "pretty-select-list";

    panel.appendChild(search);
    panel.appendChild(list);

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);

    select.classList.add("native-select-hidden");

    function getSelectedText() {
      const selected = select.options[select.selectedIndex];
      return selected ? selected.textContent.trim() : "Select option";
    }

    function refreshLabel() {
      triggerText.textContent = getSelectedText() || "Select option";
    }

    function buildOptions(filter = "") {
      list.innerHTML = "";
      const lower = filter.toLowerCase();

      Array.from(select.children).forEach((child) => {
        if (child.tagName === "OPTGROUP") {
          const groupChannels = Array.from(child.children).filter((option) =>
            option.textContent.toLowerCase().includes(lower)
          );

          if (!groupChannels.length) return;

          const groupTitle = document.createElement("div");
          groupTitle.className = "pretty-select-group";
          groupTitle.textContent = child.label;
          list.appendChild(groupTitle);

          groupChannels.forEach((option) => {
            list.appendChild(makeOption(option));
          });

          return;
        }

        if (child.tagName === "OPTION") {
          if (!child.textContent.toLowerCase().includes(lower)) return;
          list.appendChild(makeOption(child));
        }
      });
    }

    function makeOption(option) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pretty-select-option";

      if (option.value === select.value) {
        btn.classList.add("selected");
      }

      const icon = document.createElement("span");
      icon.className = "pretty-select-option-icon";
      icon.textContent = option.value ? "#" : "•";

      const text = document.createElement("span");
      text.textContent = option.textContent.trim();

      btn.appendChild(icon);
      btn.appendChild(text);

      btn.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refreshLabel();
        buildOptions(search.value);
        wrapper.classList.remove("open");
      });

      return btn;
    }

    trigger.addEventListener("click", () => {
      document.querySelectorAll(".pretty-select-wrapper.open").forEach((openWrapper) => {
        if (openWrapper !== wrapper) openWrapper.classList.remove("open");
      });

      wrapper.classList.toggle("open");
      search.value = "";
      buildOptions("");
      setTimeout(() => search.focus(), 30);
    });

    search.addEventListener("input", () => {
      buildOptions(search.value);
    });

    document.addEventListener("click", (event) => {
      if (!wrapper.contains(event.target)) {
        wrapper.classList.remove("open");
      }
    });

    refreshLabel();
    buildOptions("");
  });
}

function setupHoverDescriptions() {
  document.querySelectorAll(".nav-link[data-tooltip]").forEach((link) => {
    const tooltip = document.createElement("div");
    tooltip.className = "nav-tooltip";
    tooltip.innerHTML = `
      <div class="nav-tooltip-title">${link.dataset.tooltipTitle || link.textContent.trim()}</div>
      <div class="nav-tooltip-desc">${link.dataset.tooltip}</div>
    `;

    document.body.appendChild(tooltip);

    link.addEventListener("mouseenter", () => {
      const rect = link.getBoundingClientRect();
      tooltip.style.left = `${rect.right + 14}px`;
      tooltip.style.top = `${rect.top + rect.height / 2}px`;
      tooltip.classList.add("show");
    });

    link.addEventListener("mouseleave", () => {
      tooltip.classList.remove("show");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupSidebarToggle();
  setupPrettySelects();
  setupHoverDescriptions();
});


/* LEGENDARY DASHBOARD UX v18.5.5 */
(function setupLegendaryDashboardUx() {
  const DEFAULT_SUCCESS_MS = 4500;
  const DEFAULT_ERROR_MS = 8000;

  function ensureToastRoot() {
    let root = document.querySelector(".legendary-toast-root");
    if (!root) {
      root = document.createElement("div");
      root.className = "legendary-toast-root";
      document.body.appendChild(root);
    }
    return root;
  }

  function ensureOverlay() {
    let overlay = document.querySelector(".legendary-loading-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "legendary-loading-overlay";
      overlay.innerHTML = `
        <div class="legendary-loading-card">
          <div class="legendary-loader-ring"></div>
          <div>
            <div class="legendary-loading-title">Loading...</div>
            <div class="legendary-loading-subtitle">Please wait while Legendary Bot works.</div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function showOverlay(title = "Loading...", subtitle = "Please wait while Legendary Bot works.") {
    const overlay = ensureOverlay();
    overlay.querySelector(".legendary-loading-title").textContent = title;
    overlay.querySelector(".legendary-loading-subtitle").textContent = subtitle;
    overlay.classList.add("show");
  }

  function hideOverlay() {
    const overlay = document.querySelector(".legendary-loading-overlay");
    if (overlay) overlay.classList.remove("show");
  }

  function showToast(type = "success", message = "Done", timeoutMs) {
    const root = ensureToastRoot();
    const ms = Number(timeoutMs || (type === "error" ? DEFAULT_ERROR_MS : DEFAULT_SUCCESS_MS));
    const toast = document.createElement("div");
    toast.className = `legendary-toast ${type === "error" ? "error" : "success"}`;

    const icon = type === "error" ? "❌" : "✅";
    const title = type === "error" ? "Error" : "Success";

    toast.innerHTML = `
      <div class="legendary-toast-icon">${icon}</div>
      <div class="legendary-toast-content">
        <strong>${title}</strong>
        <span>${escapeHtml(message)}</span>
        <small>Closing in <b class="legendary-toast-count">${Math.ceil(ms / 1000)}</b>s</small>
        <div class="legendary-toast-progress"><span></span></div>
      </div>
      <button type="button" class="legendary-toast-close" aria-label="Close">×</button>
    `;

    root.appendChild(toast);

    const progress = toast.querySelector(".legendary-toast-progress span");
    const count = toast.querySelector(".legendary-toast-count");
    const started = Date.now();

    requestAnimationFrame(() => {
      toast.classList.add("show");
      progress.style.transitionDuration = `${ms}ms`;
      progress.style.width = "0%";
    });

    const timer = setInterval(() => {
      const left = Math.max(0, ms - (Date.now() - started));
      if (count) count.textContent = Math.ceil(left / 1000);
    }, 250);

    const close = () => {
      clearInterval(timer);
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 260);
    };

    toast.querySelector(".legendary-toast-close").addEventListener("click", close);
    setTimeout(close, ms);

    return toast;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setButtonLoading(button, isLoading, text = "Saving...") {
    if (!button) return;

    if (isLoading) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.classList.add("is-loading");
      button.innerHTML = `<span class="legendary-mini-spinner"></span>${escapeHtml(text)}`;
    } else {
      button.disabled = false;
      button.classList.remove("is-loading");
      if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    }
  }

  async function submitAjaxForm(form) {
    const submitter = form.querySelector('[type="submit"], button:not([type]), .primary-btn');
    const action = form.getAttribute("action") || window.location.href;
    const method = (form.getAttribute("method") || "POST").toUpperCase();
    const loadingText = form.dataset.loadingText || "Saving settings...";
    const successStay = form.dataset.stay !== "false";

    setButtonLoading(submitter, true, "Saving...");
    showOverlay("Saving settings...", loadingText);

    try {
      const response = await fetch(action, {
        method,
        body: new FormData(form),
        headers: {
          "Accept": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
      });

      let data = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) data = await response.json();
      else data = { ok: response.ok, message: await response.text() };

      if (!response.ok || data.ok === false) {
        throw new Error(data.message || data.error || "Something went wrong");
      }

      showToast("success", data.message || "Saved successfully", data.countdownMs || DEFAULT_SUCCESS_MS);

      if (data.redirect && !successStay) {
        setTimeout(() => {
          window.location.href = data.redirect;
        }, data.countdownMs || 1200);
      }
    } catch (err) {
      showToast("error", err.message || "Failed to save settings", DEFAULT_ERROR_MS);
    } finally {
      hideOverlay();
      setButtonLoading(submitter, false);
    }
  }

  function setupAjaxForms() {
    // AJAX form submission is handled once by the delegated bindAjaxForms()
    // listener later in this file. Keeping this as a no-op preserves the
    // public dashboard UX API without attaching a second submit handler.
  }

  function setupLoadingLinks() {
    document.querySelectorAll("a[data-dashboard-loading='true']").forEach((link) => {
      if (link.dataset.loadingReady === "true") return;
      link.dataset.loadingReady = "true";

      link.addEventListener("click", () => {
        showOverlay(link.dataset.loadingTitle || "Loading module...", link.dataset.loadingSubtitle || "Opening the selected dashboard page.");
      });
    });
  }

  function setupQueryToasts() {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");

    if (success) showToast("success", success, DEFAULT_SUCCESS_MS);
    if (error) showToast("error", error, DEFAULT_ERROR_MS);

    if (success || error) {
      params.delete("success");
      params.delete("error");
      const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash || ""}`;
      window.history.replaceState({}, "", clean);
    }
  }

  window.LegendaryDashboardUX = {
    showToast,
    showOverlay,
    hideOverlay,
    setupAjaxForms,
    setupLoadingLinks,
  };

  document.addEventListener("DOMContentLoaded", () => {
    setupAjaxForms();
    setupLoadingLinks();
    setupQueryToasts();
  });
})();


/* LEGENDARY_PREMIUM_DASHBOARD_UX_V18_5_7 */

(() => {
  const SUCCESS_TIMEOUT = 7000;
  const ERROR_TIMEOUT = 17000;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function ensureShell() {
    if (!document.querySelector(".legendary-toast-stack")) {
      const stack = document.createElement("div");
      stack.className = "legendary-toast-stack";
      document.body.appendChild(stack);
    }

    if (!document.querySelector(".legendary-loading-overlay")) {
      const overlay = document.createElement("div");
      overlay.className = "legendary-loading-overlay";
      overlay.innerHTML = `
        <div class="legendary-loader-orb" aria-label="Loading">
          <div class="legendary-loader-ring ring-one"></div>
          <div class="legendary-loader-ring ring-two"></div>
          <div class="legendary-loader-core"></div>
          <div class="legendary-loader-spark spark-one"></div>
          <div class="legendary-loader-spark spark-two"></div>
          <div class="legendary-loader-spark spark-three"></div>
        </div>`;
      document.body.appendChild(overlay);
    }

    if (!document.querySelector(".legendary-help-modal")) {
      const modal = document.createElement("div");
      modal.className = "legendary-help-modal";
      modal.innerHTML = `
        <div class="legendary-help-card">
          <button class="legendary-help-close" type="button">×</button>
          <div class="legendary-help-icon">?</div>
          <h2>Why did this happen?</h2>
          <p class="legendary-help-message">Something went wrong while saving.</p>
          <div class="legendary-help-grid">
            <div><h3>Possible reasons</h3><ul>
              <li>A required field is missing or invalid.</li>
              <li>Your login session expired.</li>
              <li>The server could not save to MongoDB.</li>
              <li>The bot lacks permission for this action.</li>
              <li>Railway/backend had a temporary error.</li>
            </ul></div>
            <div><h3>How to fix</h3><ul>
              <li>Check the required fields and IDs.</li>
              <li>Refresh the page and log in again.</li>
              <li>Try saving one more time.</li>
              <li>Check Railway logs for the exact error.</li>
              <li>Make sure bot permissions are correct.</li>
            </ul></div>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (event) => {
        if (event.target === modal || event.target.closest(".legendary-help-close")) closeHelpModal();
      });
    }

    if (!document.querySelector(".legendary-unsaved-bar")) {
      const bar = document.createElement("div");
      bar.className = "legendary-unsaved-bar";
      bar.innerHTML = `
        <div class="unsaved-text">Careful — you have unsaved changes!</div>
        <div class="unsaved-actions">
          <button type="button" class="unsaved-reset">Reset</button>
          <button type="button" class="unsaved-factory">Factory Reset</button>
          <button type="button" class="unsaved-save">Save Changes</button>
        </div>`;
      document.body.appendChild(bar);
      bar.querySelector(".unsaved-reset")?.addEventListener("click", resetActiveForm);
      bar.querySelector(".unsaved-factory")?.addEventListener("click", factoryResetActiveForm);
      bar.querySelector(".unsaved-save")?.addEventListener("click", saveActiveForm);
    }
  }

  function showLoading() {
    ensureShell();
    document.querySelector(".legendary-loading-overlay")?.classList.add("show");
  }

  function hideLoading() {
    document.querySelector(".legendary-loading-overlay")?.classList.remove("show");
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function openHelpModal(message) {
    ensureShell();
    const modal = document.querySelector(".legendary-help-modal");
    const msg = modal?.querySelector(".legendary-help-message");
    if (msg) msg.textContent = message || "Something went wrong while saving.";
    modal?.classList.add("show");
  }

  function closeHelpModal() {
    document.querySelector(".legendary-help-modal")?.classList.remove("show");
  }

  function showToast(type = "success", message = "Done") {
    ensureShell();
    const isError = type === "error";
    const isWarning = type === "warning";
    const timeout = isError ? ERROR_TIMEOUT : SUCCESS_TIMEOUT;
    const stack = document.querySelector(".legendary-toast-stack");
    const toast = document.createElement("div");
    const safeType = isError ? "error" : isWarning ? "warning" : "success";
    const icon = isError ? "✕" : isWarning ? "!" : "✓";

    toast.className = `legendary-toast-card ${safeType}`;
    toast.innerHTML = `
      <div class="legendary-toast-icon">${icon}</div>
      <div class="legendary-toast-body">
        <strong>${isError ? "Error" : isWarning ? "Warning" : "Success"}</strong>
        <p>${escapeHtml(message)}</p>
        <small>Closing in <span class="legendary-toast-count">${Math.ceil(timeout / 1000)}</span>s</small>
      </div>
      ${isError ? `<button type="button" class="legendary-toast-help" title="Why did this happen?">?</button>` : ""}
      <button type="button" class="legendary-toast-close" aria-label="Close">×</button>
      <div class="legendary-toast-progress"></div>`;
    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));

    const progress = toast.querySelector(".legendary-toast-progress");
    if (progress) {
      progress.style.transitionDuration = `${timeout}ms`;
      requestAnimationFrame(() => { progress.style.transform = "scaleX(0)"; });
    }

    const count = toast.querySelector(".legendary-toast-count");
    let remaining = Math.ceil(timeout / 1000);
    const interval = setInterval(() => {
      remaining -= 1;
      if (count) count.textContent = Math.max(0, remaining);
    }, 1000);

    const close = () => {
      clearInterval(interval);
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 260);
    };

    toast.querySelector(".legendary-toast-close")?.addEventListener("click", close);
    toast.querySelector(".legendary-toast-help")?.addEventListener("click", () => openHelpModal(message));
    setTimeout(close, timeout);
  }

  function getFormSnapshot(form) {
    return Array.from(form.querySelectorAll("input, select, textarea"))
      .filter((field) => field.name || field.id)
      .map((field) => ({
        key: field.name || field.id,
        type: field.type,
        value: field.type === "checkbox" || field.type === "radio" ? field.checked : field.value,
      }));
  }

  function applySnapshot(form, snapshot) {
    if (!form || !Array.isArray(snapshot)) return;
    snapshot.forEach((item) => {
      const field = form.querySelector(`[name="${CSS.escape(item.key)}"], #${CSS.escape(item.key)}`);
      if (!field) return;
      if (field.type === "checkbox" || field.type === "radio") field.checked = Boolean(item.value);
      else field.value = item.value ?? "";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function makeFactorySnapshot(form) {
    return Array.from(form.querySelectorAll("input, select, textarea"))
      .filter((field) => field.name || field.id)
      .map((field) => {
        let value = "";
        if (field.type === "checkbox" || field.type === "radio") value = field.defaultChecked;
        else if (field.dataset.defaultValue !== undefined) value = field.dataset.defaultValue;
        else if (field.tagName === "SELECT") {
          const selected = Array.from(field.options).find((opt) => opt.defaultSelected) || field.options[0];
          value = selected ? selected.value : "";
        } else value = field.defaultValue ?? "";
        return { key: field.name || field.id, type: field.type, value };
      });
  }

  function sameSnapshot(a, b) {
    return JSON.stringify(a || []) === JSON.stringify(b || []);
  }

  let activeDirtyForm = null;

  function initializeForm(form) {
    if (!form || form.dataset.legendaryUxReady === "true") return;
    form.dataset.legendaryUxReady = "true";
    form.__savedSnapshot = getFormSnapshot(form);
    form.__factorySnapshot = makeFactorySnapshot(form);

    const markDirty = () => {
      const dirty = !sameSnapshot(getFormSnapshot(form), form.__savedSnapshot);
      form.classList.toggle("legendary-form-dirty", dirty);
      if (dirty) {
        activeDirtyForm = form;
        document.querySelector(".legendary-unsaved-bar")?.classList.add("show");
      } else if (activeDirtyForm === form) {
        document.querySelector(".legendary-unsaved-bar")?.classList.remove("show");
        activeDirtyForm = null;
      }
    };

    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
  }

  function resetActiveForm() {
    if (!activeDirtyForm) return;
    applySnapshot(activeDirtyForm, activeDirtyForm.__savedSnapshot);
    activeDirtyForm.classList.remove("legendary-form-dirty");
    document.querySelector(".legendary-unsaved-bar")?.classList.remove("show");
    activeDirtyForm = null;
    showToast("success", "Changes reset");
  }

  function factoryResetActiveForm() {
    if (!activeDirtyForm) return;
    applySnapshot(activeDirtyForm, activeDirtyForm.__factorySnapshot);
    activeDirtyForm.classList.add("legendary-form-dirty");
    document.querySelector(".legendary-unsaved-bar")?.classList.add("show");
    showToast("warning", "Factory defaults applied. Click Save Changes to save them.");
  }

  function saveActiveForm() {
    if (!activeDirtyForm) return;
    submitAjaxForm(activeDirtyForm, activeDirtyForm.querySelector("button[type='submit'], .primary-btn, button:not([type])"));
  }

  function setButtonLoading(button, loading) {
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.classList.add("is-loading");
      button.innerHTML = `<span class="mini-spinner"></span><span>Saving...</span>`;
    } else {
      button.disabled = false;
      button.classList.remove("is-loading");
      if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
    }
  }

  function shouldAjaxForm(form) {
    if (!form || form.dataset.noAjax === "true") return false;
    if (
      form.classList.contains("login-form") ||
      form.classList.contains("premium-server-open-form") ||
      form.classList.contains("premium-toggle-form") ||
      form.action.includes("/select-server") ||
      form.action.includes("/manage") ||
      form.action.includes("/login")
    ) return false;
    const method = (form.getAttribute("method") || "GET").toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;
    if (form.enctype && form.enctype.toLowerCase().includes("multipart")) return false;
    return true;
  }

  async function submitAjaxForm(form, submitter) {
    const action = form.getAttribute("action") || window.location.href;
    const method = (form.getAttribute("method") || "POST").toUpperCase();
    const button = submitter || form.querySelector("button[type='submit'], .primary-btn, button:not([type])");
    setButtonLoading(button, true);
    showLoading();

    try {
      const formData = new FormData(form);
      if (submitter?.name) formData.append(submitter.name, submitter.value || "on");

      const isMultipart = (form.getAttribute("enctype") || "").toLowerCase().includes("multipart");
      const requestHeaders = {
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "X-Dashboard-Ajax": "1",
      };

      let requestBody = formData;

      if (!isMultipart) {
        requestBody = new URLSearchParams();
        for (const [key, value] of formData.entries()) {
          requestBody.append(key, value);
        }
        requestHeaders["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
      }

      const response = await fetch(action, {
        method,
        body: requestBody,
        headers: requestHeaders,
        credentials: "same-origin",
      });

      const contentType = response.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) data = await response.json();
      else {
        const text = await response.text();
        data = { ok: response.ok, message: response.ok ? "Saved successfully" : (text?.slice(0, 250) || "Action failed") };
      }

      if (!response.ok || data.ok === false) {
        showToast("error", data.message || "Something went wrong");
        return;
      }

      showToast("success", data.message || "Saved successfully");
      form.__savedSnapshot = getFormSnapshot(form);
      form.classList.remove("legendary-form-dirty");
      if (activeDirtyForm === form) {
        document.querySelector(".legendary-unsaved-bar")?.classList.remove("show");
        activeDirtyForm = null;
      }

      if (data.reload) setTimeout(() => window.location.reload(), 900);
      else if (data.redirect) setTimeout(() => { showLoading(); window.location.href = data.redirect; }, 650);
    } catch (error) {
      showToast("error", error.message || "Network error while saving");
    } finally {
      hideLoading();
      setButtonLoading(button, false);
    }
  }

  function absorbRedirectQueryToasts() {
    const url = new URL(window.location.href);
    const success = url.searchParams.get("success");
    const error = url.searchParams.get("error");
    const warning = url.searchParams.get("warning");
    if (success) showToast("success", success);
    if (error) showToast("error", error);
    if (warning) showToast("warning", warning);
    if (success || error || warning) {
      url.searchParams.delete("success");
      url.searchParams.delete("error");
      url.searchParams.delete("warning");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }

  function bindAjaxForms() {
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!shouldAjaxForm(form)) return;
      event.preventDefault();
      submitAjaxForm(form, event.submitter);
    });
  }

  function bindLoadingLinks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || link.target === "_blank") return;
      if (link.dataset.noLoading === "true") return;
      const sameOrigin = href.startsWith("/") || href.startsWith(window.location.origin);
      if (!sameOrigin) return;
      if (link.classList.contains("ai-module-card") || link.classList.contains("nav-link") || link.classList.contains("nav-item") || link.classList.contains("plugin-card") || link.classList.contains("ai-back-btn")) showLoading();
    });
  }

  ready(() => {
    ensureShell();
    absorbRedirectQueryToasts();
    bindAjaxForms();
    bindLoadingLinks();
    document.querySelectorAll("form").forEach(initializeForm);
    window.LegendaryDashboardUX = { showToast, showLoading, hideLoading, openHelpModal, closeHelpModal };
  });
})();

/* END_LEGENDARY_PREMIUM_DASHBOARD_UX_V18_5_7 */


/* LEGENDARY_SELECTOR_REDIRECT_FORCE_FIX_V18_5_14 */
(() => {
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(() => {
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!form || form.dataset.noLoading === "true") return;

      const redirectForm =
        form.dataset.noAjax === "true" ||
        form.classList.contains("login-form") ||
        form.classList.contains("premium-server-open-form") ||
        form.classList.contains("premium-toggle-form") ||
        form.action.includes("/select-server") ||
        form.action.includes("/manage") ||
        form.action.includes("/login");

      if (redirectForm && window.LegendaryDashboardUX?.showLoading) {
        window.LegendaryDashboardUX.showLoading();
      }
    }, true);

    document.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link || link.dataset.noLoading === "true") return;
      const href = link.getAttribute("href") || "";
      if (
        href.includes("/auth/discord") ||
        href === "/customer" ||
        href === "/login" ||
        href === "/owner/servers" ||
        href === "/customer/servers"
      ) {
        window.LegendaryDashboardUX?.showLoading?.();
      }
    }, true);
  });
})();
