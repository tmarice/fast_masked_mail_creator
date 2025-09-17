export default defineBackground(() => {
  const MENU_ID = "fastmail-email-menu";

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Fastmail token…",
      contexts: ["editable"],
      visible: true,
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== MENU_ID || !tab?.id) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined },
      func: async () => {
        const el = document.activeElement as HTMLInputElement | null;
        if (!el || el.tagName.toLowerCase() !== "input") return;
        el.value = "user@example.com";
      },
    });
  });
});
