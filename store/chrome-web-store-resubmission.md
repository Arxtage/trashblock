# Chrome Web Store resubmission notes

## Recommended approach

Use the simpler path for review:

- remove the hidden `accounts.google.com` exception from the extension package
- make the store listing fully match the actual behavior
- make privacy wording precise about local URL checks
- resubmit as version `1.0.1`

## Why the rejection happened

The rejected package had an undocumented exception for Google Accounts sign-in related navigations in `background.js`:

- `excludedInitiatorDomains: ["accounts.google.com"]`
- an extra `webNavigation` guard that skipped blocking when the current tab URL was on `accounts.google.com`

The reviewer treated that as hidden functionality that was not disclosed in the listing.

## Paste this into the Chrome Web Store description

Use `store/description.txt`.

## Suggested single purpose description

Blocks access to user-specified distracting websites by showing a full-page typing challenge. The user must type a custom phrase to temporarily unlock a blocked site for 10 minutes, after which the block automatically turns on again. The extension also lets users choose which days of the week blocking is active.

## Suggested permission justifications

### declarativeNetRequest

Used to create dynamic redirect rules for domains on the user's block list. When a blocked domain is opened, the request is redirected to the extension's built-in challenge page. Rules are added and removed as the user updates the block list or temporarily unlocks a site.

### storage

Used to save the user's settings locally with `chrome.storage.local`, including blocked domains, the custom unlock phrase, active days, and temporary unlock expiration timestamps. This data stays on the device.

### alarms

Used to re-enable blocking after a temporary unlock expires and to refresh day-based blocking rules on schedule.

### webNavigation

Used only as a fallback to detect top-level navigation to a blocked site in rare cases where the redirect rule is not yet active. The extension checks the destination URL locally and does not store or transmit browsing history.

### host permissions (`<all_urls>`)

Required because the user can choose any site to block. The extension uses host access only to compare page URLs against the user's block list and redirect matching sites to the challenge page. It does not collect page content or send browsing data to external servers.

## Recommended reviewer note

Use `store/test-instructions.txt` in the Test instructions section.

## Final resubmission checklist

- [ ] upload a new package with version `1.0.1`
- [ ] paste the updated listing description
- [ ] update the privacy policy URL content
- [ ] update the dashboard permission justifications with the text above
- [ ] add the test instructions
- [ ] confirm screenshots still match the current UI
