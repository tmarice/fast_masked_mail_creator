import { defineConfig } from "wxt";

export default defineConfig({
  name: "Fast Masked Mail Creator",
  description: "Create single-purpose Fastmail masked mails",
  version: "0.1.0",
  entrypoints: {
    popup: "./popup/index.html",
    background: "background.ts",
  },
  manifest: {
    permissions: ["alarm", "storage", "contextMenus", "scripting", "activeTab"],
    action: { default_popup: "popup.html" },
  },
  modules: ["@wxt-dev/auto-icons"],
  autoIcons: {
    baseIconPath: "assets/icon.svg",
    developmentIndicator: false,
  },
});
