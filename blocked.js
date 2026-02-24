const params = new URLSearchParams(window.location.search);
const site = params.get("site");
const action = params.get("action"); // "remove" or null (default = unlock)

const domainEl = document.getElementById("domain");
const phraseEl = document.getElementById("phrase");
const inputEl = document.getElementById("input");
const feedbackEl = document.getElementById("feedback");
const statusEl = document.getElementById("status");

let unlockPhrase = "";

// Normalize curly/smart quotes to straight ASCII equivalents
function normalizeQuotes(str) {
  return str
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-");
}

domainEl.textContent = site || "";

// Adjust heading and instruction based on action
if (action === "remove") {
  document.querySelector("h1").textContent = "Remove Site";
  document.querySelector(".instruction").textContent =
    "Type the phrase below exactly to remove " + site + " from your blocklist.";
} else if (action === "changePhrase") {
  document.querySelector("h1").textContent = "Change Phrase";
  domainEl.textContent = "";
  document.querySelector(".instruction").textContent =
    "Type your current phrase to confirm the change.";
}

// Load the unlock phrase from storage
chrome.storage.local.get("unlockPhrase", (data) => {
  unlockPhrase = normalizeQuotes(data.unlockPhrase || "");
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
  if (inputEl.value !== unlockPhrase) return;

  inputEl.disabled = true;

  if (action === "changePhrase") {
    statusEl.textContent = "Phrase updated! Closing tab...";
    statusEl.className = "status success";
    chrome.runtime.sendMessage({ type: "applyPendingPhrase" }, () => {
      setTimeout(() => window.close(), 800);
    });
  } else if (action === "remove") {
    statusEl.textContent = "Removed! Closing tab...";
    statusEl.className = "status success";
    chrome.runtime.sendMessage({ type: "removeSite", domain: site }, () => {
      setTimeout(() => window.close(), 800);
    });
  } else {
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
