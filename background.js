const UNLOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes

const DEFAULTS = {
  blockedSites: [],
  unlockPhrase: "I should be working on something productive",
  unlockedSites: {},
  activeDays: [0, 1, 2, 3, 4, 5, 6], // all days active by default (Date.getDay())
  daysConfigured: false,               // false = first-time, clicks save directly
};

// Stable hash of a domain string to a positive integer rule ID (1 – 1,000,000)
function domainToRuleId(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash * 31 + domain.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 1_000_000) + 1;
}

// Build a declarativeNetRequest redirect rule for a domain
function buildRule(domain) {
  const blockedUrl = chrome.runtime.getURL("blocked.html") + "?site=" + encodeURIComponent(domain);
  return {
    id: domainToRuleId(domain),
    priority: 1,
    action: {
      type: "redirect",
      redirect: { url: blockedUrl },
    },
    condition: {
      urlFilter: "||" + domain + "^",
      resourceTypes: ["main_frame"],
    },
  };
}

// Full-replace all dynamic rules to match current blocked/unlocked state
// Always cleans expired unlocks before syncing
async function syncRules() {
  const data = await chrome.storage.local.get(["blockedSites", "unlockedSites", "activeDays"]);
  const blockedSites = data.blockedSites || [];
  const unlockedSites = cleanExpiredUnlocks(data.unlockedSites || {});
  const activeDays = data.activeDays ?? [0, 1, 2, 3, 4, 5, 6];

  // Persist cleaned unlocks
  await chrome.storage.local.set({ unlockedSites });

  const now = Date.now();
  const today = new Date().getDay();

  // Remove all existing dynamic rules first
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map((r) => r.id);

  // If today is not an active day, add no blocking rules
  let addRules = [];
  if (activeDays.includes(today)) {
    addRules = blockedSites
      .filter((domain) => {
        const expiry = unlockedSites[domain];
        return !expiry || expiry <= now;
      })
      .map(buildRule);
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: addRules,
  });
}

// Remove expired entries from unlockedSites and return the cleaned object
function cleanExpiredUnlocks(unlockedSites) {
  const now = Date.now();
  const cleaned = {};
  for (const [domain, expiry] of Object.entries(unlockedSites)) {
    if (expiry > now) {
      cleaned[domain] = expiry;
    }
  }
  return cleaned;
}

// --- Midnight alarm for day-based rule sync ---

function scheduleMidnightAlarm() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 10, 0); // 00:00:10 tomorrow
  chrome.alarms.create("midnight-sync", {
    when: midnight.getTime(),
    periodInMinutes: 24 * 60,
  });
}

// --- Lifecycle events ---

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const merged = { ...DEFAULTS, ...data };
  await chrome.storage.local.set(merged);
  await syncRules();
  scheduleMidnightAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncRules();
  scheduleMidnightAlarm();
});

// --- Message handling (unlock requests from blocked.js) ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "unlock") {
    handleUnlock(message.domain).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "removeSite") {
    handleRemoveSite(message.domain).then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function handleRemoveSite(domain) {
  const data = await chrome.storage.local.get(["blockedSites", "unlockedSites"]);
  const sites = (data.blockedSites || []).filter((d) => d !== domain);
  const unlockedSites = data.unlockedSites || {};
  delete unlockedSites[domain];

  await chrome.storage.local.set({ blockedSites: sites, unlockedSites });
  await chrome.alarms.clear(`reblock-${domain}`);
  await syncRules();
}

async function handleUnlock(domain) {
  const expiry = Date.now() + UNLOCK_DURATION_MS;

  // Save unlock expiry
  const data = await chrome.storage.local.get(["blockedSites", "unlockedSites"]);
  const unlockedSites = data.unlockedSites || {};
  unlockedSites[domain] = expiry;
  await chrome.storage.local.set({ unlockedSites });

  // Remove the blocking rule for this domain
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [domainToRuleId(domain)],
  });

  // Set alarm to re-block after 10 minutes
  await chrome.alarms.create(`reblock-${domain}`, {
    when: expiry,
  });
}

// --- Alarm handling (re-block after unlock expires) ---

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "midnight-sync") {
    await syncRules();
    scheduleMidnightAlarm(); // reschedule to handle DST shifts
    return;
  }
  if (!alarm.name.startsWith("reblock-")) return;
  // syncRules will clean expired unlocks and re-add all blocking rules
  await syncRules();
});

// --- Storage change listener (re-sync when popup edits blockedSites) ---

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if (!changes.blockedSites && !changes.activeDays) return;

  await syncRules();
});

// --- webNavigation fallback (catches rare cases where DNR rules aren't active yet) ---

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;

  const url = details.url;
  if (url.startsWith("chrome") || url.startsWith("about")) return;

  let hostname;
  try { hostname = new URL(url).hostname; } catch { return; }

  const data = await chrome.storage.local.get(["blockedSites", "unlockedSites", "activeDays"]);
  const blockedSites = data.blockedSites || [];
  const unlockedSites = data.unlockedSites || {};
  const activeDays = data.activeDays ?? [0, 1, 2, 3, 4, 5, 6];

  if (!activeDays.includes(new Date().getDay())) return;

  const domain = blockedSites.find(
    (d) => hostname === d || hostname.endsWith("." + d)
  );
  if (!domain) return;

  const expiry = unlockedSites[domain];
  if (expiry && expiry > Date.now()) return;

  // Guard: ensure the tab is still on the URL that triggered this event
  try {
    const tab = await chrome.tabs.get(details.tabId);
    if (tab.url !== url && tab.pendingUrl !== url) return;
  } catch { return; }

  const blockedUrl = chrome.runtime.getURL("blocked.html")
    + "?site=" + encodeURIComponent(domain);
  chrome.tabs.update(details.tabId, { url: blockedUrl });
});
