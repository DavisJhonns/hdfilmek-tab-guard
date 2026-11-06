# HDFilmek Guard

A lightweight Chrome extension designed to keep your browsing session focused on HDFilmek.

## Features

- **Domain Detection:** Automatically detects tabs belonging to `hdfilmek.net` and its subdomains.
- **Automatic Tab Cleanup:** Closes all non-HDFilmek tabs in a window whenever an HDFilmek tab is present.
- **Real-Time Monitoring:** Monitors newly opened tabs, URL changes, and tab activation.
- **Startup Protection:** Checks all existing browser windows when Chrome starts.
- **Manifest V3:** Built using the latest Chrome Extension Manifest V3 architecture.

## How It Works

HDFilmek Guard monitors Chrome browser windows for HDFilmek tabs.

Whenever a window contains at least one HDFilmek tab, all other tabs in that window are automatically closed.

Windows without an HDFilmek tab remain unaffected.

## Installation

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the downloaded project folder.

The extension will start working automatically.

## Permissions

- `tabs` – Required to monitor browser tabs, identify their URLs, and close unwanted tabs.

## Technologies

- JavaScript
- Chrome Extensions API
- Manifest V3

## Disclaimer

This is an independent, community-developed browser extension and is not officially affiliated with or endorsed by HDFilmek.

## License

See the LICENSE file for license information.