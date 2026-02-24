const phraseInput = document.getElementById("phraseInput");
const savePhrase = document.getElementById("savePhrase");
const phraseStatus = document.getElementById("phraseStatus");
const siteInput = document.getElementById("siteInput");
const addSiteBtn = document.getElementById("addSite");
const siteList = document.getElementById("siteList");
const emptyMsg = document.getElementById("emptyMsg");
const unlockedList = document.getElementById("unlockedList");
const unlockedEmpty = document.getElementById("unlockedEmpty");

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
  chrome.storage.local.get(["blockedSites", "unlockPhrase", "unlockedSites"], (data) => {
    const blockedSites = data.blockedSites || [];
    const unlockPhrase = data.unlockPhrase || "";
    const unlockedSites = data.unlockedSites || {};

    phraseInput.value = unlockPhrase;
    renderBlockedSites(blockedSites);
    renderUnlockedSites(unlockedSites);
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
    removeBtn.addEventListener("click", () => removeSite(domain));

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

savePhrase.addEventListener("click", () => {
  const phrase = phraseInput.value.trim();
  if (!phrase) return;
  chrome.storage.local.set({ unlockPhrase: phrase }, () => {
    phraseStatus.textContent = "Saved!";
    setTimeout(() => { phraseStatus.textContent = ""; }, 2000);
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

function removeSite(domain) {
  chrome.storage.local.get(["blockedSites", "unlockedSites"], (data) => {
    const sites = (data.blockedSites || []).filter((d) => d !== domain);
    const unlockedSites = data.unlockedSites || {};
    delete unlockedSites[domain];

    chrome.storage.local.set({ blockedSites: sites, unlockedSites }, () => {
      // Cancel any pending re-block alarm for this site
      chrome.alarms.clear(`reblock-${domain}`);
      loadState();
    });
  });
}

// Initial load
loadState();
