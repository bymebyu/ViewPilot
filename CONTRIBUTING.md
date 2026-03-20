# Contributing to ViewPilot

Thank you for your interest in contributing to ViewPilot! This guide will help you get started.

## Reporting Bugs

1. Search [existing issues](https://github.com/bymebyu/ViewPilot/issues) to avoid duplicates
2. Open a new issue with:
   - Browser name and version
   - Steps to reproduce
   - Expected vs. actual behavior
   - Screenshots if applicable

## Suggesting Features

Open a [GitHub Issue](https://github.com/bymebyu/ViewPilot/issues) with the `[Feature Request]` tag and describe:
- The problem you want to solve
- Your proposed solution
- Any alternatives you considered

## Development Setup

```bash
# Clone the repository
git clone https://github.com/bymebyu/ViewPilot.git
cd ViewPilot

# Install dependencies
pnpm install

# Start development server (Chrome)
pnpm dev

# Start development server (Firefox)
pnpm dev:firefox
```

### Loading the Extension

**Chrome / Edge:**
1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` directory

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in the `.output/firefox-mv2` directory

## Pull Request Guidelines

1. Fork the repository and create a feature branch from `main`
2. Keep changes focused — one feature or fix per PR
3. Follow the existing code style (TypeScript, React, Tailwind CSS)
4. Test your changes across supported browsers when possible
5. Write a clear PR description explaining your changes

## Code of Conduct

Be respectful and constructive. We are committed to providing a welcoming and inclusive experience for everyone. Harassment, discrimination, and disruptive behavior will not be tolerated.
