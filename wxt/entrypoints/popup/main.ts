import { fetchAPIData } from "../../lib/fastmail.ts";

const toggleButton = document.getElementById("toggle-button") as HTMLButtonElement;
const editSection = document.getElementById("edit-section") as HTMLDivElement;
const cancelButton = document.getElementById("cancel-button") as HTMLButtonElement;
const saveButton = document.getElementById("save-button") as HTMLButtonElement;
const inputField = document.getElementById("fastmail-token") as HTMLInputElement;
const status = document.getElementById("status") as HTMLDivElement;

const dummyToken = "0".repeat(72);
let statusTimeout = undefined;

// TODO Nice to have: Add nice animations for window resizing

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
  }, 2000);
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

async function handleSaveButtonClick() {
  const token = inputField.value.trim();

  if (token.length === 0) {
    await chrome.storage.local.remove(["fastmailToken", "fastmailAccountId", "fastmailApiUrl"]);
    await setStatus("🗑️ Token Removed");
  } else if (token === dummyToken) {
    await setStatus("ℹ️ Token Unchanged");
  } else {
    saveButton.disabled = true;
    cancelButton.disabled = true;
    await setStatus("⏳ Verifying Token...");

    let accountId: string | null = null;
    let apiUrl: string | null = null;

    try {
      const data = await fetchAPIData(token);
      accountId = data.accountId;
      apiUrl = data.apiUrl;
    } catch (e) {
      // TODO Provide more details on the error
      await setStatus("❌ Error Verifying Token");

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

document.addEventListener("DOMContentLoaded", setToggleButtonState);
toggleButton.addEventListener("click", toggleScreens);
cancelButton.addEventListener("click", handleCancelButtonClick);
saveButton.addEventListener("click", handleSaveButtonClick);
