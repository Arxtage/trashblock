const UNLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const DEFAULTS = {
  blockedSites: [],
  unlockPhrase: "I should be working on something productive",
  unlockedSites: {},
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
      urlFilter: "||" + domain,
      resourceTypes: ["main_frame"],
    },
  };
}

// Full-replace all dynamic rules to match current blocked/unlocked state
async function syncRules(blockedSites, unlockedSites) {
  const now = Date.now();

  // Remove all existing dynamic rules first
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map((r) => r.id);

  // Build rules for sites that are blocked and NOT currently unlocked
  const addRules = blockedSites
    .filter((domain) => {
      const expiry = unlockedSites[domain];
      return !expiry || expiry <= now;
    })
    .map(buildRule);

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

// --- Lifecycle events ---

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const merged = { ...DEFAULTS, ...data };
  await chrome.storage.local.set(merged);
  merged.unlockedSites = cleanExpiredUnlocks(merged.unlockedSites);
  await chrome.storage.local.set({ unlockedSites: merged.unlockedSites });
  await syncRules(merged.blockedSites, merged.unlockedSites);
});

chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get(Object.keys(DEFAULTS));
  data.unlockedSites = cleanExpiredUnlocks(data.unlockedSites || {});
  await chrome.storage.local.set({ unlockedSites: data.unlockedSites });
  await syncRules(data.blockedSites || [], data.unlockedSites);
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
  if (message.type === "applyPendingPhrase") {
    handleApplyPendingPhrase().then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function handleApplyPendingPhrase() {
  const data = await chrome.storage.local.get("pendingPhrase");
  if (data.pendingPhrase) {
    await chrome.storage.local.set({ unlockPhrase: data.pendingPhrase });
    await chrome.storage.local.remove("pendingPhrase");
  }
}

async function handleRemoveSite(domain) {
  const data = await chrome.storage.local.get(["blockedSites", "unlockedSites"]);
  const sites = (data.blockedSites || []).filter((d) => d !== domain);
  const unlockedSites = data.unlockedSites || {};
  delete unlockedSites[domain];

  await chrome.storage.local.set({ blockedSites: sites, unlockedSites });
  await chrome.alarms.clear(`reblock-${domain}`);
  await syncRules(sites, unlockedSites);
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

  // Set alarm to re-block after 5 minutes
  await chrome.alarms.create(`reblock-${domain}`, {
    when: expiry,
  });
}

// --- Alarm handling (re-block after unlock expires) ---

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("reblock-")) return;

  const domain = alarm.name.slice("reblock-".length);

  // Remove from unlockedSites
  const data = await chrome.storage.local.get(["blockedSites", "unlockedSites"]);
  const unlockedSites = data.unlockedSites || {};
  delete unlockedSites[domain];
  await chrome.storage.local.set({ unlockedSites });

  // Re-add blocking rule if the domain is still in the blocklist
  const blockedSites = data.blockedSites || [];
  if (blockedSites.includes(domain)) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [buildRule(domain)],
    });
  }
});

// --- Storage change listener (re-sync when popup edits blockedSites) ---

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if (!changes.blockedSites) return;

  const data = await chrome.storage.local.get(["blockedSites", "unlockedSites"]);
  await syncRules(data.blockedSites || [], data.unlockedSites || {});
});
