import { defineConfig } from "wxt";

export default defineConfig({
  entrypoints: {
    popup: "./src/popup/index.html",
  },
  manifest: {
    permissions: ["storage"],
    action: { default_popup: "popup.html" },
  },
});
