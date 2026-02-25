const phraseInput = document.getElementById("phraseInput");
const savePhrase = document.getElementById("savePhrase");
const phraseStatus = document.getElementById("phraseStatus");
const siteInput = document.getElementById("siteInput");
const addSiteBtn = document.getElementById("addSite");
const siteList = document.getElementById("siteList");
const emptyMsg = document.getElementById("emptyMsg");
const unlockedList = document.getElementById("unlockedList");
const unlockedEmpty = document.getElementById("unlockedEmpty");
const daySelector = document.getElementById("daySelector");
const dayButtons = daySelector.querySelectorAll(".day-btn");
const dayStatus = document.getElementById("dayStatus");

let countdownInterval = null;

// Strip a user-entered URL down to a bare domain
function cleanDomain(input) {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.replace(/\/.*$/, "");
  d = d.replace(/:\d+$/, "");
  return d;
}

// Load and render all state
function loadState() {
  chrome.storage.local.get(["blockedSites", "unlockPhrase", "unlockedSites", "activeDays", "daysConfigured"], (data) => {
    const blockedSites = data.blockedSites || [];
    const unlockPhrase = data.unlockPhrase || "";
    const unlockedSites = data.unlockedSites || {};
    const activeDays = data.activeDays ?? [0, 1, 2, 3, 4, 5, 6];

    phraseInput.value = unlockPhrase;
    renderBlockedSites(blockedSites);
    renderUnlockedSites(unlockedSites);
    renderDaySelector(activeDays);
  });
}

function renderBlockedSites(sites) {
  siteList.innerHTML = "";
  emptyMsg.style.display = sites.length === 0 ? "block" : "none";

  for (const domain of sites) {
    const li = document.createElement("li");

    const name = document.createElement("span");
    name.className = "domain-name";
    name.textContent = domain;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => promptRemoveSite(domain));

    li.appendChild(name);
    li.appendChild(removeBtn);
    siteList.appendChild(li);
  }
}

function renderUnlockedSites(unlockedSites) {
  const now = Date.now();
  const entries = Object.entries(unlockedSites).filter(([, expiry]) => expiry > now);

  unlockedList.innerHTML = "";
  unlockedEmpty.style.display = entries.length === 0 ? "block" : "none";

  for (const [domain, expiry] of entries) {
    const li = document.createElement("li");

    const name = document.createElement("span");
    name.className = "domain-name";
    name.textContent = domain;

    const countdown = document.createElement("span");
    countdown.className = "countdown";
    countdown.dataset.expiry = expiry;
    countdown.textContent = formatCountdown(expiry - now);

    li.appendChild(name);
    li.appendChild(countdown);
    unlockedList.appendChild(li);
  }

  // Start/restart countdown timer
  if (countdownInterval) clearInterval(countdownInterval);
  if (entries.length > 0) {
    countdownInterval = setInterval(updateCountdowns, 1000);
  }
}

function renderDaySelector(activeDays) {
  for (const btn of dayButtons) {
    const day = parseInt(btn.dataset.day, 10);
    btn.classList.toggle("selected", activeDays.includes(day));
  }
}

daySelector.addEventListener("click", (e) => {
  const btn = e.target.closest(".day-btn");
  if (!btn) return;

  const clickedDay = parseInt(btn.dataset.day, 10);

  chrome.storage.local.get(["activeDays", "daysConfigured", "unlockPhrase"], (data) => {
    const activeDays = data.activeDays ?? [0, 1, 2, 3, 4, 5, 6];
    const daysConfigured = data.daysConfigured || false;
    const unlockPhrase = data.unlockPhrase || "";

    // Toggle the clicked day
    const idx = activeDays.indexOf(clickedDay);
    const newDays = [...activeDays];
    if (idx >= 0) {
      newDays.splice(idx, 1);
    } else {
      newDays.push(clickedDay);
    }

    if (!daysConfigured || !unlockPhrase) {
      // First-time or no phrase — save directly
      chrome.storage.local.set({ activeDays: newDays, daysConfigured: true }, () => {
        renderDaySelector(newDays);
        dayStatus.textContent = "Saved!";
        setTimeout(() => { dayStatus.textContent = ""; }, 2000);
      });
    } else {
      // Require phrase challenge
      chrome.storage.local.set({ pendingActiveDays: newDays }, () => {
        const url = chrome.runtime.getURL("blocked.html") + "?action=changeDays";
        chrome.tabs.create({ url });
      });
    }
  });
});

function updateCountdowns() {
  const now = Date.now();
  const countdowns = unlockedList.querySelectorAll(".countdown");
  let anyActive = false;

  for (const el of countdowns) {
    const expiry = parseInt(el.dataset.expiry, 10);
    const remaining = expiry - now;
    if (remaining <= 0) {
      el.textContent = "Expired";
    } else {
      anyActive = true;
      el.textContent = formatCountdown(remaining);
    }
  }

  if (!anyActive) {
    clearInterval(countdownInterval);
    // Refresh the whole view to show updated state
    loadState();
  }
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// --- Actions ---

// Normalize smart/curly quotes to straight ASCII equivalents
function normalizeQuotes(str) {
  return str
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")   // curly single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')    // curly double quotes
    .replace(/[\u2013\u2014]/g, "-");                // en/em dashes
}

savePhrase.addEventListener("click", () => {
  const newPhrase = normalizeQuotes(phraseInput.value.trim());
  if (!newPhrase) return;

  // Check if there's an existing phrase that requires confirmation
  chrome.storage.local.get("unlockPhrase", (data) => {
    const current = data.unlockPhrase || "";
    if (!current || current === newPhrase) {
      // No existing phrase or unchanged — save directly
      chrome.storage.local.set({ unlockPhrase: newPhrase }, () => {
        phraseStatus.textContent = "Saved!";
        setTimeout(() => { phraseStatus.textContent = ""; }, 2000);
      });
    } else {
      // Existing phrase differs — require typing challenge
      chrome.storage.local.set({ pendingPhrase: newPhrase }, () => {
        const url = chrome.runtime.getURL("blocked.html") + "?action=changePhrase";
        chrome.tabs.create({ url });
      });
    }
  });
});

addSiteBtn.addEventListener("click", () => addSite());
siteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite();
});

function addSite() {
  const domain = cleanDomain(siteInput.value);
  if (!domain) return;

  chrome.storage.local.get("blockedSites", (data) => {
    const sites = data.blockedSites || [];
    if (sites.includes(domain)) {
      siteInput.value = "";
      return;
    }
    sites.push(domain);
    chrome.storage.local.set({ blockedSites: sites }, () => {
      siteInput.value = "";
      loadState();
    });
  });
}

// --- Remove site with full-page typing challenge ---

function promptRemoveSite(domain) {
  const url = chrome.runtime.getURL("blocked.html")
    + "?site=" + encodeURIComponent(domain)
    + "&action=remove";
  chrome.tabs.create({ url });
}

function removeSite(domain) {
  chrome.storage.local.get(["blockedSites", "unlockedSites"], (data) => {
    const sites = (data.blockedSites || []).filter((d) => d !== domain);
    const unlockedSites = data.unlockedSites || {};
    delete unlockedSites[domain];

    chrome.storage.local.set({ blockedSites: sites, unlockedSites }, () => {
      chrome.alarms.clear(`reblock-${domain}`);
      loadState();
    });
  });
}

// Initial load
loadState();
