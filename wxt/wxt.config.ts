import { defineConfig } from "wxt";

export default defineConfig({
  name: "Masked Mail Manager",
  description: "Create and manage Fastmail masked emails",
  version: "0.1.0",
  entrypoints: {
    popup: "./src/popup/index.html",
    background: "src/background.ts",
  },
  manifest: {
    permissions: ["storage", "contextMenus", "scripting", "activeTab"],
    action: { default_popup: "popup.html" },
  },
});
