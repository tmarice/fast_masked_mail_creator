// TODO Add good favicon for context menu item
import { createMaskedEmail } from "../lib/fastmail.ts";

export default defineBackground(() => {
  const MENU_ID = "fastmail-email-menu";

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
    // TODO Add debouncind and rate limiting

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

    const [{ result: tooltipId }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined },
      func: () => {
        const el = document.activeElement as HTMLInputElement | null;
        if (!el) return null;

        const rect = el.getBoundingClientRect();

        const tooltip = document.createElement("div");
        const id = "tooltip_" + Math.random().toString(36).slice(2);
        tooltip.id = id;
        tooltip.textContent = "Generating masked email...";
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

        document.body.appendChild(tooltip);
        return id;
      },
    });

    try {
      const { fastmailToken, fastmailAccountId, fastmailApiUrl } = await chrome.storage.local.get([
        "fastmailToken",
        "fastmailAccountId",
        "fastmailApiUrl",
      ]);

      if (!fastmailToken || !fastmailAccountId || !fastmailApiUrl) {
        await chrome.action.openPopup();
      } else {
        // TODO validate this
        const domain = new URL(tab.url).hostname;
        const maskedMail = await createMaskedEmail(fastmailToken, fastmailAccountId, fastmailApiUrl, {
          forDomain: domain,
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
