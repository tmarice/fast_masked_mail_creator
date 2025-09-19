import { fetchAPIData } from "../../lib/fastmail.ts";

const toggleButton = document.getElementById("toggle-button") as HTMLButtonElement;
const editSection = document.getElementById("edit-section") as HTMLDivElement;
const cancelButton = document.getElementById("cancel-button") as HTMLButtonElement;
const saveButton = document.getElementById("save-button") as HTMLButtonElement;
const inputField = document.getElementById("fastmail-token") as HTMLInputElement;
const status = document.getElementById("status") as HTMLDivElement;

// TODO Rename this button to somethign else
async function setButtonState() {
  const result = await chrome.storage.local.get("fastmailToken");
  if (!result) {
    toggleButton.textContent = "Add Fastmail Token";
  } else {
    toggleButton.textContent = "Update Fastmail Token";
  }
}

async function toggleScreens() {
  inputField.disabled = !inputField.disabled;
  saveButton.disabled = !saveButton.disabled;
  cancelButton.disabled = !cancelButton.disabled;

  toggleButton.style.display = toggleButton.style.display === "none" ? "block" : "none";
  editSection.style.display = editSection.style.display === "none" ? "block" : "none";

  if (editSection.style.display === "block") {
    const { fastmailToken } = await chrome.storage.local.get(["fastmailToken"]);
    if (typeof fastmailToken === "string") {
      inputField.value = fastmailToken;
    }
    inputField.focus();
    inputField.select();
  } else {
    inputField.value = "";
  }

  status.textContent = "";
}

async function handleCancelButtonClick() {
  inputField.value = "";
  await toggleScreens();
}

async function handleSaveButtonClick() {
  // TODO Show status messages when the form is hidden
  // TODO Use webauthn if available to avoid storing the token directly
  const token = inputField.value.trim();

  if (token.length === 0) {
    await chrome.storage.local.remove(["fastmailToken", "fastmailAccountId", "fastmailApiUrl"]);
    status.textContent = "🗑️ Token Removed";
  } else {
    saveButton.disabled = true;
    status.textContent = "⏳ Verifying Token...";

    let accountId: string | null = null;
    let apiUrl: string | null = null;

    try {
      const data = await fetchAPIData(token);
      accountId = data.accountId;
      apiUrl = data.apiUrl;
    } catch (e) {
      // TODO Provide more details on the error
      status.textContent = "❌ Error Verifying Token";
      saveButton.disabled = false;
      return;
    }

    await chrome.storage.local.set({ fastmailToken: token, fastmailAccountId: accountId, fastmailApiUrl: apiUrl });
    status.textContent = "✅ Token Saved";
    saveButton.disabled = false;
  }

  await toggleScreens();
}

document.addEventListener("DOMContentLoaded", setButtonState);
toggleButton.addEventListener("click", toggleScreens);
cancelButton.addEventListener("click", handleCancelButtonClick);
saveButton.addEventListener("click", handleSaveButtonClick);
