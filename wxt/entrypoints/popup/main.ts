import { fetchAPIData } from "../../lib/fastmail.ts";

document.addEventListener("DOMContentLoaded", async () => {
  const toggleButton = document.getElementById("toggle-button") as HTMLButtonElement;
  const editSection = document.getElementById("edit-section") as HTMLDivElement;
  const cancelButton = document.getElementById("cancel-button") as HTMLButtonElement;
  const saveButton = document.getElementById("save-button") as HTMLButtonElement;
  const inputField = document.getElementById("fastmail-token") as HTMLInputElement;
  const status = document.getElementById("status") as HTMLDivElement;

  const dummyToken: string = "fmu1-00000000-00000000000000000000000000000000-0-00000000000000000000000000000000";
  let statusTimeout: number | undefined = undefined;

  async function setToggleButtonState() {
    const { fastmailToken } = await chrome.storage.local.get("fastmailToken");
    if (!fastmailToken) {
      toggleButton.textContent = "Add Fastmail Token";
    } else {
      toggleButton.textContent = "Update Fastmail Token";
    }
  }

  async function setStatus(message: string) {
    status.textContent = message;

    if (statusTimeout) {
      clearTimeout(statusTimeout);
    }

    statusTimeout = setTimeout(() => {
      if (status.textContent === message) {
        status.textContent = "";
      }
    }, 5000);
  }

  async function toggleScreens() {
    inputField.disabled = !inputField.disabled;
    saveButton.disabled = !saveButton.disabled;
    cancelButton.disabled = !cancelButton.disabled;

    toggleButton.style.display = toggleButton.style.display === "none" ? "block" : "none";
    editSection.style.display = editSection.style.display === "none" ? "block" : "none";

    if (editSection.style.display === "block") {
      const { fastmailToken } = await chrome.storage.local.get("fastmailToken");
      if (!!fastmailToken) {
        inputField.value = dummyToken;
      }
      inputField.focus();
      inputField.select();
      status.textContent = "";
    } else {
      inputField.value = "";
    }
  }

  async function handleCancelButtonClick() {
    inputField.value = "";
    await toggleScreens();
  }

  function validateTokenFormat(token: string): Promise<boolean> {
    const tokenRegex = /^fmu1-[a-z0-9]{8}-[a-z0-9]{32}-[a-z0-9]{1}-[a-z0-9]{32}$/;
    return tokenRegex.test(token);
  }

  async function handleSaveButtonClick() {
    const token = inputField.value.trim();

    if (token.length === 0) {
      const { fastmailToken } = await chrome.storage.local.get("fastmailToken");
      if (fastmailToken) {
        await chrome.storage.local.remove(["fastmailToken", "fastmailAccountId", "fastmailApiUrl"]);
        await setStatus("🗑️ Token Removed");
      }
    } else if (token === dummyToken) {
      await setStatus("ℹ️ Token Unchanged");
    } else {
      saveButton.disabled = true;
      cancelButton.disabled = true;
      await setStatus("⏳ Verifying Token...");

      let accountId: string | null = null;
      let apiUrl: string | null = null;

      try {
        if (!validateTokenFormat(token)) {
          throw new Error("Invalid token format");
        }
        const data = await fetchAPIData(token);
        accountId = data.accountId;
        apiUrl = data.apiUrl;
      } catch (e) {
        await setStatus("❌ Error Verifying Token: " + (e instanceof Error ? e.message : String(e)));

        saveButton.disabled = false;
        cancelButton.disabled = false;
        inputField.focus();
        inputField.select();

        return;
      }

      await chrome.storage.local.set({ fastmailToken: token, fastmailAccountId: accountId, fastmailApiUrl: apiUrl });
      await setStatus("✅ Token Saved");
      saveButton.disabled = false;
      cancelButton.disabled = false;
    }

    await setToggleButtonState();
    await toggleScreens();
  }

  await setToggleButtonState();
  toggleButton.addEventListener("click", toggleScreens);
  cancelButton.addEventListener("click", handleCancelButtonClick);
  saveButton.addEventListener("click", handleSaveButtonClick);
});
