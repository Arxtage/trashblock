const params = new URLSearchParams(window.location.search);
const site = params.get("site");

const domainEl = document.getElementById("domain");
const phraseEl = document.getElementById("phrase");
const inputEl = document.getElementById("input");
const feedbackEl = document.getElementById("feedback");
const statusEl = document.getElementById("status");

let unlockPhrase = "";

domainEl.textContent = site || "Unknown site";

// Load the unlock phrase from storage
chrome.storage.local.get("unlockPhrase", (data) => {
  unlockPhrase = data.unlockPhrase || "";
  phraseEl.textContent = unlockPhrase;
  renderFeedback();
});

// Block paste, drop, and context menu
inputEl.addEventListener("paste", (e) => e.preventDefault());
inputEl.addEventListener("drop", (e) => e.preventDefault());
inputEl.addEventListener("contextmenu", (e) => e.preventDefault());

// Character-by-character feedback on input
inputEl.addEventListener("input", () => {
  renderFeedback();
  checkMatch();
});

function renderFeedback() {
  const typed = inputEl.value;
  let html = "";

  for (let i = 0; i < unlockPhrase.length; i++) {
    if (i < typed.length) {
      if (typed[i] === unlockPhrase[i]) {
        html += `<span class="correct">${escapeHtml(unlockPhrase[i])}</span>`;
      } else {
        html += `<span class="incorrect">${escapeHtml(unlockPhrase[i])}</span>`;
      }
    } else {
      html += `<span class="remaining">${escapeHtml(unlockPhrase[i])}</span>`;
    }
  }

  feedbackEl.innerHTML = html;
}

function checkMatch() {
  if (inputEl.value === unlockPhrase) {
    inputEl.disabled = true;
    statusEl.textContent = "Unlocked! Redirecting...";
    statusEl.className = "status success";

    chrome.runtime.sendMessage({ type: "unlock", domain: site }, () => {
      window.location.href = "https://" + site;
    });
  }
}

function escapeHtml(char) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return map[char] || char;
}
