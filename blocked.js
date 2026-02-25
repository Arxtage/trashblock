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

// Collapse all whitespace (newlines, tabs, non-breaking spaces, etc.) into single spaces
function normalizeText(str) {
  return str.replace(/\s+/g, " ").trim();
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
} else if (action === "changeDays") {
  document.querySelector("h1").textContent = "Change Active Days";
  domainEl.textContent = "";
  document.querySelector(".instruction").textContent =
    "Type your current phrase to confirm the schedule change.";
}

// Load the unlock phrase from storage
chrome.storage.local.get("unlockPhrase", (data) => {
  unlockPhrase = normalizeText(normalizeQuotes(data.unlockPhrase || ""));
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
    // Apply the pending phrase directly from storage
    chrome.storage.local.get("pendingPhrase", (data) => {
      if (!data.pendingPhrase) return;
      chrome.storage.local.set({ unlockPhrase: data.pendingPhrase }, () => {
        chrome.storage.local.remove("pendingPhrase", () => {
          statusEl.textContent = "Phrase updated! Closing tab...";
          statusEl.className = "status success";
          setTimeout(() => window.close(), 800);
        });
      });
    });
    return;
  } else if (action === "changeDays") {
    chrome.storage.local.get("pendingActiveDays", (data) => {
      if (!data.pendingActiveDays) return;
      chrome.storage.local.set({ activeDays: data.pendingActiveDays, daysConfigured: true }, () => {
        chrome.storage.local.remove("pendingActiveDays", () => {
          statusEl.textContent = "Schedule updated! Closing tab...";
          statusEl.className = "status success";
          setTimeout(() => window.close(), 800);
        });
      });
    });
    return;
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
