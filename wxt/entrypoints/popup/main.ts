// TODO Add test token button
// TODO Change prettier max line length
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
  console.log(JSON.stringify(editSection.style.display));
  console.log(JSON.stringify(toggleButton.style.display));

  inputField.disabled = !inputField.disabled;
  saveButton.disabled = !saveButton.disabled;
  cancelButton.disabled = !cancelButton.disabled;

  toggleButton.style.display = toggleButton.style.display === "none" ? "block" : "none";
  editSection.style.display = editSection.style.display === "none" ? "block" : "none";
}

async function handleCancelButtonClick() {
  inputField.value = "";
  await toggleScreens();
}

async function handleSaveButtonClick() {
  const token = inputField.value.trim();

  saveButton.disabled = true;
  await chrome.storage.local.set({ fastmailToken: token });
  status.textContent = "✅ Token saved!";
  setTimeout(() => (status.textContent = ""), 2000);
  saveButton.disabled = false;
  await toggleScreens();
}

async function loadToken() {
  const result = await chrome.storage.local.get(["fastmailToken"]);
  if (typeof result.fastmailToken === "string") {
    inputField.value = result.fastmailToken;
  }
}

document.addEventListener("DOMContentLoaded", setButtonState);
document.addEventListener("DOMContentLoaded", loadToken);
toggleButton.addEventListener("click", toggleScreens);
cancelButton.addEventListener("click", handleCancelButtonClick);
saveButton.addEventListener("click", handleSaveButtonClick);
