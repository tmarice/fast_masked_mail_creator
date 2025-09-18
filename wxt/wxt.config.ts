import { defineConfig } from "wxt";

export default defineConfig({
  entrypoints: {
    popup: "./src/popup/index.html",
    background: "src/background.ts",
  },
  manifest: {
    permissions: ["storage", "contextMenus", "scripting"],
    host_permissions: ["<all_urls>"],
    action: { default_popup: "popup.html" },
  },
});
