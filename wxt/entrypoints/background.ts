// TODO Add good favicon for context menu item
import { createMaskedEmail } from "../lib/fastmail.ts";

export default defineBackground(() => {
  const MENU_ID = "fastmail-email-menu";
  const RATE_LIMIT_MS = 5000;
  let lastUsed = 0;

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Create Fastmail Masked Email",
      contexts: ["editable"],
      visible: true,
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== MENU_ID || !tab?.id) return;

    const [{ result: shouldFill }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined },
      func: () => {
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
      },
    });

    if (!shouldFill) return;

    const rateLimitWait = Math.max(0, RATE_LIMIT_MS - (Date.now() - lastUsed));

    const [{ result: tooltipId }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined },
      func: (rateLimitWait) => {
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

        console.log("Rate limit wait inside:", rateLimitWait);
        if (rateLimitWait > 0) {
          const seconds = Math.ceil(rateLimitWait / 1000);
          tooltip.textContent = `Rate limited, please wait ${seconds} second${seconds !== 1 ? "s" : ""}...`;
        } else {
          tooltip.textContent = "Generating masked email...";
        }
        document.body.appendChild(tooltip);
        return id;
      },
      args: [rateLimitWait],
    });

    if (rateLimitWait > 0) {
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined },
          func: (id: string) => {
            const tooltip = document.getElementById(id);
            if (tooltip) tooltip.remove();
          },
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
        const url = new URL(tab.url);
        const domain = url.hostname;
        let forDomain = domain;

        if (!domain || !/^[a-zA-Z0-9.-]+$/.test(domain) || domain.length > 253) {
          forDomain = "Unknown domain";
        }

        const maskedMail = await createMaskedEmail(fastmailToken, fastmailAccountId, fastmailApiUrl, {
          forDomain: forDomain,
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined },
          func: (value: string) => {
            const el = document.activeElement as HTMLInputElement | null;
            if (!el) return false;
            el.value = value;
          },
          args: [maskedMail],
        });
      }
    } finally {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined },
        func: (id: string) => {
          const tooltip = document.getElementById(id);
          if (tooltip) tooltip.remove();
        },
        args: [tooltipId],
      });
    }
  });
});
