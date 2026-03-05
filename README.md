# TrashBlock

A Chrome extension that blocks distracting websites with a typing challenge. No tracking, no accounts, no data collection — just friction between you and your distractions.

## How It Works

1. Add sites to your block list (e.g., `twitter.com`, `reddit.com`)
2. When you visit a blocked site, you see a full-page typing challenge
3. Type your unlock phrase exactly to get 10 minutes of access
4. After 10 minutes, the block kicks back in automatically

## Features

- **Custom unlock phrase** — set any phrase; changing it requires typing the current one first
- **Day scheduling** — choose which days blocking is active
- **10-minute unlock window** — enough to check something, not enough for a rabbit hole
- **Subdomain blocking** — blocking `twitter.com` also blocks `mobile.twitter.com`
- **Protected settings** — removing sites or changing phrases requires the typing challenge

## Install

### From Chrome Web Store

Coming soon.

### From Source

1. Clone this repo
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the repo folder

## Privacy

TrashBlock is fully offline. No data leaves your device. See the [privacy policy](https://arxtage.github.io/trashblock/privacy-policy.html).

## Building for Chrome Web Store

To create a zip for submission:

```bash
zip -r trashblock.zip . -x ".git/*" "store/*" ".DS_Store" ".gitignore" "README.md"
```

## License

MIT
