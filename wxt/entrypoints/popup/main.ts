import { fetchAPIData } from "../../lib/fastmail.ts";

const toggleButton = document.getElementById("toggle-button") as HTMLButtonElement;
const editSection = document.getElementById("edit-section") as HTMLDivElement;
const cancelButton = document.getElementById("cancel-button") as HTMLButtonElement;
const saveButton = document.getElementById("save-button") as HTMLButtonElement;
const inputField = document.getElementById("fastmail-token") as HTMLInputElement;
const status = document.getElementById("status") as HTMLDivElement;

async function setToggleButtonState() {
  const result = await chrome.storage.local.get("fastmailToken");
  if (!result.fastmailToken) {
    toggleButton.textContent = "Add Fastmail Token";
  } else {
    toggleButton.textContent = "Update Fastmail Token";
  }
}

async function setStatus(message: string) {
  status.classList.remove("fading");
  status.textContent = message;

  setTimeout(() => {
    if (status.textContent === message) {
      status.classList.add("fading");
      setTimeout(() => {
        if (status.classList.contains("fading")) {
          status.textContent = "";
          status.classList.remove("fading");
        }
      }, 300); // Match CSS transition duration
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
    const { fastmailToken } = await chrome.storage.local.get(["fastmailToken"]);
    if (typeof fastmailToken === "string") {
      inputField.value = fastmailToken;
    }
    inputField.focus();
    inputField.select();
  } else {
    inputField.value = "";
  }
}

async function handleCancelButtonClick() {
  inputField.value = "";
  await toggleScreens();
}

async function handleSaveButtonClick() {
  // TODO Use webauthn if available to avoid storing the token directly
  const token = inputField.value.trim();

  if (token.length === 0) {
    await chrome.storage.local.remove(["fastmailToken", "fastmailAccountId", "fastmailApiUrl"]);
    await setStatus("🗑️ Token Removed");
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
