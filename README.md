<p align="center">
  <img src="public/icons/icon128.png" alt="ViewPilot Logo" width="128" height="128">
</p>

<h1 align="center">ViewPilot</h1>

<p align="center">
  AI browser sidebar powered by GitHub Copilot
</p>

<p align="center">
  <a href="https://chrome.google.com/webstore"><img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome"></a>
  <a href="https://addons.mozilla.org/firefox/addon/viewpilot/"><img src="https://img.shields.io/badge/Firefox-Add--on-FF7139?logo=firefox&logoColor=white" alt="Firefox"></a>
  <a href="https://microsoftedge.microsoft.com/addons/detail/viewpilot/ocnagbhegoacffhejllfedejaclpmoki"><img src="https://img.shields.io/badge/Edge-Extension-0078D7?logo=microsoftedge&logoColor=white" alt="Edge"></a>
  <a href="https://ko-fi.com/giljun"><img src="https://img.shields.io/badge/Ko--fi-Support-FF5E5B?logo=kofi&logoColor=white" alt="Ko-fi"></a>
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-GPL--3.0-blue" alt="License">
</p>

---

I built ViewPilot because I kept forgetting to use GitHub Copilot. It just wasn't in my flow. So I made a sidebar that's always there — no tab switching, no breaking focus.

Now, whenever I'm studying something or a question pops up, I just ask. It made Copilot actually useful for everyday browsing, not just coding.

## Features

- **AI Chat in Sidebar** — Chat with AI using your current page as context, with automatic viewport content reading
- **20+ AI Models** — GPT-5.4, Claude Opus 4.6, Gemini 3.1 Pro, and more — smart sorted (free first, by context size)
- **Web Search** — DuckDuckGo (free, no API key), Brave, or Google (Serper) integration
- **Page Context** — Extract page text, capture screenshots (single or full-page scroll), attach files
- **Chat History** — Save and manage multiple conversations
- **Quota Tracking** — Monitor your GitHub Copilot premium request usage
- **Math Rendering** — LaTeX / KaTeX support
- **Font Size Control** — 10-level font scaling for accessibility
- **Context Menu** — Right-click selected text to send to ViewPilot
- **Google Docs Support** — Works with Google Docs canvas mode
- **Multi-Language** — English, Korean, Japanese, Chinese, Spanish

## Screenshots

<p align="center">
  <img src="assets/screenshots/chat-websearch.png" width="280" alt="Web Search & Fact Check">
  <img src="assets/screenshots/docs-sidebar.png" width="280" alt="Document Analysis">
  <img src="assets/screenshots/code-generation.png" width="280" alt="Code Generation">
</p>

## Requirements

- A paid [GitHub Copilot](https://github.com/features/copilot) subscription (Pro, Business, or Enterprise)

## Installation

### From Browser Stores

| Browser | Link |
|---------|------|
| Chrome  | [Chrome Web Store](https://chrome.google.com/webstore) (under review) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/viewpilot/) |
| Edge    | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ocnagbhegoacffhejllfedejaclpmoki) |

### Build from Source

```bash
git clone https://github.com/bymebyu/ViewPilot.git
cd ViewPilot

pnpm install

# Development
pnpm dev              # Chrome
pnpm dev:firefox      # Firefox

# Production build
pnpm build            # Chrome (default)
pnpm build:all        # Chrome + Edge + Firefox

# Create zip packages
pnpm zip:all
```

## Privacy

ViewPilot does not collect, store, or transmit any personal data. All AI communication goes directly between your browser and the GitHub Copilot API. Web search (when enabled) only sends the search query — no personal data.

Read the full [Privacy Policy](docs/privacy-policy.md).

## Disclaimer

ViewPilot is **NOT** an official GitHub or Microsoft product. It is an independent, community-developed browser extension that utilizes the GitHub Copilot API. GitHub, Copilot, and related trademarks belong to their respective owners.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the GPL-3.0 License — see [LICENSE](LICENSE) for details.

## Support

If you find ViewPilot useful, consider supporting the project:

<a href="https://ko-fi.com/giljun"><img src="https://img.shields.io/badge/Ko--fi-Support%20ViewPilot-FF5E5B?logo=kofi&logoColor=white&style=for-the-badge" alt="Support on Ko-fi"></a>
