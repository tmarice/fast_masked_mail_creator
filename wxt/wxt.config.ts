import { defineConfig } from "wxt";

export default defineConfig({
  // TODO Add icons
  entrypoints: {
    popup: "./src/popup/index.html",
    background: "src/background.ts",
  },
  manifest: {
    permissions: ["storage", "contextMenus", "scripting", "activeTab"],
    action: { default_popup: "popup.html" },
  },
});
