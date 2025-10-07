import { createMaskedEmail } from "../lib/fastmail.ts";

export default defineBackground(async () => {
  const MASKED_EMAIL_MENU_ID = "fastmail-maked-email-menu";
  const DISPOSABLE_EMAIL_MENU_ID = "fastmail-disposable-email-menu";

  const RATE_LIMIT_MS = 5000;
  let lastUsed = 0;

  const DISPOSABLE_ALARM = "remove-disposable-emails-alarm";
  const DISPOSABLE_ALARM_PERIOD = 24 * 60;

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: MASKED_EMAIL_MENU_ID,
      title: "Create Fastmail Masked Email",
      contexts: ["editable"],
      visible: true,
    });
    chrome.contextMenus.create({
      id: DISPOSABLE_EMAIL_MENU_ID,
      title: "Create Fastmail Disposable Email",
      contexts: ["editable"],
      visible: true,
    });
  });

  // Create (or re-create) the alarm on install/update/startup.
  chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(DISPOSABLE_ALARM, { periodInMinutes: DISPOSABLE_ALARM_PERIOD });
  });
  chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create(DISPOSABLE_ALARM, { periodInMinutes: DISPOSABLE_ALARM_PERIOD });
  });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== DISPOSABLE_ALARM) return;

    try {
      await cleanDisposableEmails();
    } catch (err) {
      console.error("Periodic task failed:", err);
    }
  });

  // TODO Extract this function
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    let disposable = false;
    if (info.menuItemId === DISPOSABLE_EMAIL_MENU_ID) {
      disposable = true;
    } else if (info.menuItemId !== MASKED_EMAIL_MENU_ID) {
      return;
    }

    const [{ result: shouldFill }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined },
      func: getShouldFill,
    });

    if (!shouldFill) return;

    const rateLimitWait = Math.max(0, RATE_LIMIT_MS - (Date.now() - lastUsed));

    const [{ result: tooltipId }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined },
      func: displayTooltip,
      args: [rateLimitWait],
    });

    if (rateLimitWait > 0) {
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined },
          func: removeTooltip,
          args: [tooltipId],
        });
      }, rateLimitWait);

      return;
    }

    lastUsed = Date.now();

    try {
      const { fastmailToken, fastmailAccountId, fastmailApiUrl } = await chrome.storage.local.get([
        "fastmailToken",
        "fastmailAccountId",
        "fastmailApiUrl",
      ]);

      if (!fastmailToken || !fastmailAccountId || !fastmailApiUrl) {
        await chrome.action.openPopup();
      } else {
        const forDomain = extractDomain(tab);
        // TODO Potentially add a disposable- prefix
        const maskedMail = await createMaskedEmail(fastmailToken, fastmailAccountId, fastmailApiUrl, {
          forDomain: forDomain,
        });
        if (disposable) {
          const { disposableStore } = await chrome.storage.local.get("disposableStore");
          disposableStore.push({ email: maskedMail, createdAt: new Date().toISOString() });
          await chrome.storage.local.set({ disposableStore });
        }
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined },
          func: populateEmail,
          args: [maskedMail],
        });
      }
    } finally {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined },
        func: removeTooltip,
        args: [tooltipId],
      });
    }
  });
});

function getShouldFill(): boolean {
  const el = document.activeElement as HTMLInputElement | null;
  if (!el) return false;
  if (el.tagName.toLowerCase() !== "input") return false;

  if (el.disabled || el.readOnly) return false;

  const type = (el.type || "").toLowerCase();
  const name = (el.name || "").toLowerCase();
  const id = (el.id || "").toLowerCase();
  const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();
  const autocomplete = (el.autocomplete || "").toLowerCase();

  const looksLikeEmail =
    type === "email" ||
    name.includes("email") ||
    id.includes("email") ||
    ariaLabel.includes("email") ||
    autocomplete === "email";

  if (!looksLikeEmail) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  return true;
}

function displayTooltip(rateLimitWait: number): string | null {
  const el = document.activeElement as HTMLInputElement | null;
  if (!el) return null;

  const rect = el.getBoundingClientRect();

  const tooltip = document.createElement("div");
  const id = "tooltip_" + Math.random().toString(36).slice(2);
  tooltip.id = id;
  Object.assign(tooltip.style, {
    position: "fixed",
    top: `${Math.max(8, rect.top - 28)}px`,
    left: `${Math.max(8, rect.left)}px`,
    background: "#333",
    color: "#fff",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    zIndex: "2147483647",
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
  });

  if (rateLimitWait > 0) {
    const seconds = Math.ceil(rateLimitWait / 1000);
    tooltip.textContent = `Rate limited, please wait ${seconds} second${seconds !== 1 ? "s" : ""}...`;
  } else {
    tooltip.textContent = "Generating masked email...";
  }
  document.body.appendChild(tooltip);
  return id;
}

function removeTooltip(id: string) {
  const tooltip = document.getElementById(id);
  if (tooltip) tooltip.remove();
}

function populateEmail(maskedMail: string): void {
  const el = document.activeElement as HTMLInputElement | null;
  if (!el) return;

  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  proto?.call(el, maskedMail);

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
}

function extractDomain(tab: chrome.tabs.Tab): string {
  const url = new URL(tab.url);
  const domain = url.hostname;
  let forDomain = domain;

  if (!domain || !/^[a-zA-Z0-9.-]+$/.test(domain) || domain.length > 253) {
    forDomain = "Unknown domain";
  }

  return forDomain;
}

// TODO Add basic logging to app
async function cleanDisposableEmails(): Promise<void> {
  const { disposableStore } = await chrome.storage.local.get("disposableStore");
  const newDisposableStore = [];

  for (let { email, createdAt } of disposableStore) {
    const createdDate = new Date(item.createdAt);
    const ageMs = Date.now() - createdAt.getTime();
    // TODO Stopped here!!!
    if (ageMs > 7 * 24 * 60 * 60 * 1000) {
      disposableStore.splice(i, 1);
    }
  }
  await chrome.storage.local.set({ disposableStore });
}
