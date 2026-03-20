# ViewPilot Privacy Policy

> [**English**](privacy-policy.md) | [한국어](privacy-policy-ko.md) | [日本語](privacy-policy-ja.md) | [中文](privacy-policy-zh.md) | [Español](privacy-policy-es.md)

**Last updated: March 21, 2026**

## Overview

ViewPilot is a browser extension that enables interaction with GitHub Copilot for web page content. This privacy policy explains what data is handled and how.

**ViewPilot is NOT an official GitHub or Microsoft product.** A valid GitHub Copilot subscription is required to use this extension.

## What Data We Collect

**We do not collect any data.** ViewPilot has no developer-operated server and does not transmit any information to the developer.

## Data Stored Locally

The following data is stored exclusively on your device using `chrome.storage.local`:

- **GitHub OAuth Token**: Used to authenticate with the GitHub Copilot API. Stored only in your browser's local storage and never transmitted to any third party.
- **Chat History**: Your conversation history is stored only in your browser's local storage.
- **User Preferences**: Selected AI model, language, font size, and web search settings.
- **Web Search API Keys** (optional): If you provide Brave or Serper API keys for enhanced search, they are stored locally and only sent to their respective services.

## Data Sent to External Services

- **GitHub Copilot API** (`api.githubcopilot.com`): When you send a message, your prompt and page context are sent to the GitHub Copilot API for AI processing.
- **Web Search** (when enabled): Search queries are sent to one of the following services depending on your configuration:
  - **DuckDuckGo** (default, no API key required)
  - **Brave Search** (optional, requires API key)
  - **Serper / Google** (optional, requires API key)

  Only the search query text is sent. No personal data, browsing history, or page content is transmitted to search providers.

All communication with the GitHub Copilot API is subject to GitHub's own privacy policies. Please review the [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement) for details.

## Third-Party Services

ViewPilot interacts with:
- **GitHub Copilot API** — for AI chat functionality
- **DuckDuckGo / Brave / Serper** — for optional web search (only when explicitly enabled by the user)

We do not integrate with any analytics, tracking, or advertising services.

## Your Control

- You can clear your chat history and stored data at any time through the extension.
- You can revoke the GitHub OAuth token through your GitHub account settings.
- Uninstalling the extension removes all locally stored data.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be posted on this page with an updated revision date.

## Contact

If you have questions or concerns about this privacy policy, please open an issue on our [GitHub repository](https://github.com/bymebyu/ViewPilot/issues).

---

*ViewPilot is developed by Gil Chang Lee (bymebyu).*
