# HDFilmek Tab Guard

**Version:** 2.1.0\
**Manifest Version:** 3\
**Platform:** Google Chrome\
**Extension Type:** Browser Tab Protection

---

## Table of Contents

- 1\. [1. Overview](#1-overview)
  - [Key Objectives](#key-objectives)
- 2\. [Features](#2-features)
  - 2.1 [Automatic Tab Protection](#21-automatic-tab-protection)
  - 2.2 [Domain Validation](#22-domain-validation)
  - 2.3 [Protection Toggle](#23-protection-toggle)
  - 2.4 [Debug Logging](#24-debug-logging)
  - 2.5 [Persistent Settings](#25-persistent-settings)
  - 2.6 [Dynamic Extension Icon](#26-dynamic-extension-icon)
  - 2.7 [Independent Window Monitoring](#27-independent-window-monitoring)
- 3\. [Protection Behavior](#3-protection-behavior)
  - [Protection Activation](#protection-activation)
  - [Tab Handling Rules](#tab-handling-rules)
- 4\. [Popup Interface](#4-popup-interface)
  - 4.1 [Protection Status](#41-protection-status)
  - 4.2 [Protection Settings](#42-protection-settings)
  - 4.3 [General Preferences](#43-general-preferences)
  - 4.4 [Protected Domain](#44-protected-domain)
  - 4.5 [Interface Design](#45-interface-design)
- 5\. [Technical Architecture](#5-technical-architecture)
  - 5.1 [Background Service Worker](#51-background-service-worker)
  - 5.2 [Popup Interface](#52-popup-interface)
  - 5.3 [Extension Manifest](#53-extension-manifest)
- 6\. [Permissions](#6-permissions)
  - [Permission Usage](#permission-usage)
- 7\. [Event Monitoring](#7-event-monitoring)
- 8\. [Execution Queue and Concurrency Management](#8-execution-queue-and-concurrency-management)
  - [How It Works](#how-it-works)
- 9\. [Settings Management](#9-settings-management)
  - [Default Configuration](#default-configuration)
  - [Settings Initialization](#settings-initialization)
  - [Settings Updates](#settings-updates)
- 10\. [Popup Communication](#10-popup-communication)
  - [GET\_STATUS](#get_status)
- 11\. [Installation](#11-installation)
  - [Developer Installation](#developer-installation)
  - [Recommended Project Structure](#recommended-project-structure)
- 12\. [Usage](#12-usage)
  - [Basic Operation](#basic-operation)
  - [Disabling Protection](#disabling-protection)
  - [Enabling Protection Again](#enabling-protection-again)
  - [Managing Debug Logging](#managing-debug-logging)
- 13\. [Error Handling and Reliability](#13-error-handling-and-reliability)
- 14\. [Limitations and Important Notes](#14-limitations-and-important-notes)
- 15\. [Configuration Reference](#15-configuration-reference)
- 16\. [Technology Stack](#16-technology-stack)
- 17\. [Version Information](#17-version-information)
- 18\. [Privacy](#18-privacy)
- 19\. [License](#19-license)

---

## 1\. Overview

**HDFilmek Tab Guard** is a lightweight Google Chrome extension designed to maintain a focused browsing environment for [HDFilmek](<https://hdfilmek.net>).

The extension automatically monitors browser tabs and enforces a domain-based restriction within individual browser windows.

When a fully loaded HDFilmek page is detected in a browser window, the extension activates protection for that window. Any other tab with a known URL outside the HDFilmek domain is automatically closed.

The extension operates in the background using Chrome's Manifest V3 service worker architecture and provides a popup interface for managing protection preferences and monitoring the current protection status.

### Key Objectives

- Maintain HDFilmek-only browsing within protected browser windows.
- Automatically identify and close unwanted tabs.
- Provide independent protection controls for each browser window.
- Allow users to enable or disable automatic protection.
- Provide configurable diagnostic logging.
- Maintain settings across browser sessions.

---

## 2\. Features

### 2.1 Automatic Tab Protection

The extension monitors browser tab activity and automatically evaluates whether a window requires protection.

Once a fully loaded HDFilmek page is detected, the extension:

1. Retrieves all tabs belonging to the browser window.
2. Identifies tabs with known destination URLs.
3. Checks whether their URLs belong to HDFilmek.
4. Collects tabs that do not match the protected domain.
5. Closes all identified unwanted tabs.

HDFilmek tabs are preserved.

Tabs without a known destination URL, including `about:blank`, are also preserved.

### 2.2 Domain Validation

The protected domain is configured as:

`hdfilmek.net`

The extension supports both the main domain and its subdomains.

Examples:

| URL | Result |
| --- | --- |
| `https://hdfilmek.net` | Allowed |
| `https://www.hdfilmek.net` | Allowed |
| `https://sub.hdfilmek.net` | Allowed |
| `https://hdfilmek.net/page` | Allowed |
| `https://example.com` | Rejected |
| `https://google.com` | Rejected |
| `https://hdfilmek.net.example.com` | Rejected |

Domain validation is performed using the URL hostname rather than a simple string comparison. This prevents unrelated domains containing the protected domain name from being incorrectly accepted.

### 2.3 Protection Toggle

Users can enable or disable automatic tab protection directly from the extension popup.

- **Enabled:** Automatic tab protection is active.
- **Disabled:** Automatic tab protection is suspended.

When protection is enabled, all existing browser windows are scheduled for protection checks.

Disabling protection does not automatically close, restore, or otherwise modify existing tabs.

### 2.4 Debug Logging

The extension includes an optional debug logging setting.

When enabled, informational messages are displayed in the browser console using the following prefix:

`[HDFilmek Guard]`

Debug messages include information about:

- Background service worker initialization.
- Settings updates.
- Browser window protection checks.
- Automatically closed tabs.
- Existing windows scheduled for protection.

Error messages are always logged, regardless of the debug logging preference.

### 2.5 Persistent Settings

Extension preferences are stored locally using the Chrome Storage API.

The following settings are available:

| Setting | Default | Description |
| --- | --- | --- |
| `enabled` | `true` | Controls automatic tab protection. |
| `debug` | `true` | Controls informational console logging. |

Settings persist across browser restarts and extension popup sessions.

### 2.6 Dynamic Extension Icon

The toolbar icon automatically reflects the current protection configuration.

- Active icon: Protection enabled.
- Inactive icon: Protection disabled.

The icon is updated whenever the protection setting changes or settings are initialized.

### 2.7 Independent Window Monitoring

Protection is evaluated independently for each browser window.

A window only becomes protected when it contains at least one fully loaded HDFilmek page.

This allows different browser windows to operate independently, with protection activating only where the required domain is detected.

---

## 3\. Protection Behavior

Understanding the activation conditions is important.

### Protection Activation

Protection requires both conditions:

1. The global protection setting is enabled.
2. At least one tab in the browser window has a fully loaded HDFilmek page.

A tab is considered fully loaded when Chrome reports:

`tab.status === 'complete'`

Until these conditions are satisfied, the window remains in the waiting state.

### Tab Handling Rules

| Tab Condition | Behavior |
| --- | --- |
| Fully loaded HDFilmek page | Preserved |
| HDFilmek subdomain | Preserved |
| Unrelated website with a known URL | Closed when protection is active |
| `about:blank` | Preserved |
| Tab without a known URL | Preserved |
| Unrelated website before HDFilmek loads | Preserved |
| Any tab while protection is disabled | Preserved |

**Important:** Protection is not a global browser-wide URL blocker. It is activated independently for each window after a fully loaded HDFilmek page is detected.

---

## 4\. Popup Interface

The extension provides a compact popup interface for managing settings and viewing protection information.

### 4.1 Protection Status

The status card displays the current state of the selected browser window.

Three primary states are supported:

**Active — Window Protected**

A fully loaded HDFilmek page has been detected, and automatic protection is enabled.

**Waiting — Protection Ready**

Protection is enabled, but no fully loaded HDFilmek page has been detected in the current window.

**Disabled — Protection Off**

Automatic tab protection has been manually disabled.

The popup also displays an unavailable state if it cannot retrieve the current protection information.

### 4.2 Protection Settings

The Protection section contains the Tab Protection toggle.

This control enables or disables the automatic tab protection mechanism.

### 4.3 General Preferences

The General section contains the Debug Logging toggle.

This setting controls whether informational diagnostic messages are displayed in the browser console.

### 4.4 Protected Domain

The domain card displays the configured protected domain:

`hdfilmek.net`

The domain is fixed in the extension configuration and cannot be changed through the popup interface.

### 4.5 Interface Design

The popup uses a dark visual theme with lime-green accents for protection-related elements and purple accents for diagnostic settings.

The interface includes:

- Dynamic protection status indicators.
- Custom toggle switches.
- Consistent component styling.
- Responsive status updates.
- Accessible labels and screen-reader announcements.
- Keyboard-visible focus indicators.

---

## 5\. Technical Architecture

The extension uses Chrome's Manifest V3 architecture.

Its implementation is divided into three primary components.

### 5.1 Background Service Worker

**File:** `background.js`

The background service worker implements the core protection functionality.

Its responsibilities include:

- Loading and maintaining extension settings.
- Monitoring browser tab events.
- Detecting HDFilmek pages.
- Evaluating individual browser windows.
- Closing unwanted tabs.
- Managing protection execution queues.
- Updating the toolbar icon.
- Handling popup communication.
- Responding to browser startup and installation events.

The service worker uses asynchronous Chrome APIs to perform tab and storage operations.

### 5.2 Popup Interface

**Files:**

- `popup/popup.html`
- `popup/popup.css`
- `popup/popup.js`

The popup provides the user-facing interface.

Its responsibilities include:

- Displaying protection status.
- Loading persisted settings.
- Managing protection preferences.
- Managing debug logging preferences.
- Synchronizing interface controls with stored settings.
- Requesting status information from the background service worker.

The popup communicates with the background service worker through Chrome's runtime messaging API.

### 5.3 Extension Manifest

**File:** `manifest.json`

The manifest defines the extension metadata, permissions, background service worker, popup interface, and toolbar icons.

The extension uses Manifest Version 3.

---

## 6\. Permissions

The extension requests two Chrome permissions.

| Permission | Purpose |
| --- | --- |
| `tabs` | Retrieve tab information, monitor tab events, and close unwanted tabs. |
| `storage` | Persist extension settings locally. |

### Permission Usage

**Tabs API**

Used for:

- Querying tabs within browser windows.
- Monitoring tab creation.
- Monitoring URL and loading-state changes.
- Detecting tab activation.
- Tracking tabs moved between windows.
- Closing unwanted tabs.

**Storage API**

Used for:

- Saving protection preferences.
- Saving debug logging preferences.
- Loading settings during initialization.
- Synchronizing settings between extension components.

No additional permissions are declared in the manifest.

---

## 7\. Event Monitoring

The background service worker monitors relevant Chrome browser events to ensure protection is reevaluated when necessary.

| Event | Purpose |
| --- | --- |
| `tabs.onCreated` | Detect newly created tabs. |
| `tabs.onUpdated` | Detect URL changes and completed page loads. |
| `tabs.onActivated` | Reevaluate the active tab's window. |
| `tabs.onAttached` | Reevaluate the destination window after a tab is moved. |
| `tabs.onDetached` | Reevaluate the source window after a tab is moved. |
| `windows.onRemoved` | Remove obsolete window queue entries. |
| `runtime.onStartup` | Schedule protection checks after browser startup. |
| `runtime.onInstalled` | Initialize protection after installation or updates. |
| `storage.onChanged` | Synchronize runtime settings with persisted values. |

The popup additionally monitors browser events to keep its displayed status synchronized with the current browser state.

---

## 8\. Execution Queue and Concurrency Management

The background service worker implements a per-window execution queue.

This mechanism prevents multiple protection routines from running simultaneously for the same browser window.

### How It Works

1. A relevant browser event requests a protection check.
2. The window is added to the execution queue if no check is currently running.
3. If another event occurs while protection is running, the window is marked as pending.
4. The current protection routine finishes.
5. A new protection pass runs if another check was requested.
6. The queue is removed once all pending checks have completed.

Different browser windows maintain independent execution states.

This design reduces overlapping operations and helps prevent race conditions caused by frequent tab events.

---

## 9\. Settings Management

The extension uses `chrome.storage.local` to maintain its configuration.

### Default Configuration

```js
const DEFAULT_SETTINGS = {
    enabled: true,
    debug: true
};
```

### Settings Initialization

During initialization:

1. Stored preferences are retrieved.
2. Missing values fall back to their defaults.
3. Runtime settings are synchronized.
4. The toolbar icon is updated.
5. Protection operations wait for settings initialization to finish.

Boolean normalization ensures that only an explicit `false` value disables a setting.

### Settings Updates

When the protection setting changes:

- The runtime configuration is updated.
- The toolbar icon is synchronized.
- Existing browser windows are scheduled for protection when protection is enabled.

When debug logging changes, the runtime logging configuration is updated immediately.

---

## 10\. Popup Communication

The popup communicates with the background service worker using:

`chrome.runtime.sendMessage()`

The background service worker supports the following message type:

### GET\_STATUS

Requests protection information for a specific browser window.

**Request:**

```js
{
    type: 'GET_STATUS',
    windowId: 123
}
```

**Successful response:**

```js
{
    enabled: true,
    debug: true,
    domain: 'hdfilmek.net',
    protected: true,
    status: 'active'
}
```

The `status` property can contain one of three values:

| Value | Meaning |
| --- | --- |
| `active` | Protection is enabled and the window contains a fully loaded HDFilmek page. |
| `waiting` | Protection is enabled but no fully loaded HDFilmek page is detected. |
| `disabled` | Protection has been manually disabled. |

If status retrieval fails, the background service worker responds with:

```js
{
    error: true
}
```

The popup displays an appropriate unavailable state when it receives an unsuccessful response.

---

## 11\. Installation

### Developer Installation

1. Download or clone the extension source code.
2. Open Google Chrome.
3. Navigate to:`chrome://extensions/`
4. Enable **Developer mode**.
5. Select **Load unpacked**.
6. Select the directory containing `manifest.json`.
7. Confirm that HDFilmek Tab Guard appears in the installed extensions list.

The extension is now ready to use.

### Recommended Project Structure

```text
HDFilmek-Tab-Guard/
│
├── manifest.json
│
├── background.js
│
├── icon/
│   ├── shield-active.png
│   └── shield-inactive.png
│
└── popup/
    ├── popup.html
    ├── popup.css
    └── popup.js
```

---

## 12\. Usage

### Basic Operation

1. Install HDFilmek Tab Guard in Chrome.
2. Open a browser window.
3. Navigate to `https://hdfilmek.net`.
4. Wait until the page finishes loading.
5. Protection automatically activates for that window.
6. Tabs with known URLs outside the protected domain are automatically closed.

### Disabling Protection

1. Open the extension popup.
2. Locate the Tab Protection setting.
3. Turn the toggle off.

Automatic protection is suspended.

Existing tabs remain open.

### Enabling Protection Again

1. Open the extension popup.
2. Turn the Tab Protection toggle on.
3. Existing browser windows are scheduled for protection checks.

### Managing Debug Logging

1. Open the extension popup.
2. Locate Debug Logging.
3. Enable or disable the setting according to your preference.

---

## 13\. Error Handling and Reliability

The extension includes several mechanisms to improve runtime reliability.

- **Settings fallback:** Default settings remain available if storage initialization fails.
- **Asynchronous execution:** Chrome API operations are handled using async/await.
- **Error logging:** Errors are reported independently of the debug logging preference.
- **Execution queues:** Prevent overlapping protection checks within individual windows.
- **Settings revalidation:** The protection setting is checked again before unwanted tabs are removed.
- **Popup request sequencing:** Outdated asynchronous status responses are ignored.
- **Storage synchronization:** Changes made in one extension component are reflected in other components.
- **Window cleanup:** Execution queue entries are removed when their associated windows are closed.

These mechanisms help maintain consistent behavior during frequent browser activity and asynchronous operations.

---

## 14\. Limitations and Important Notes

HDFilmek Tab Guard is designed specifically for Chrome-based browsing and the configured HDFilmek domain.

The following limitations apply:

1. **Domain-specific protection:** Only `hdfilmek.net` and its valid subdomains are recognized as protected destinations.
2. **Window-based activation:** Protection only activates in windows containing a fully loaded HDFilmek page.
3. **Unknown destinations:** Tabs without a known URL are preserved.
4. **No tab restoration:** Automatically closed tabs are not restored by the extension.
5. **No browsing history management:** The extension does not modify browser history, cookies, or cached website data.
6. **No account management:** The extension does not interact with HDFilmek user accounts.
7. **No configurable domain list:** The protected domain is defined in the source configuration.
8. **No global navigation blocking:** The extension does not intercept every navigation before it occurs. Protection is enforced through browser tab monitoring and subsequent checks.

The extension does not modify the contents of HDFilmek pages.

---

## 15\. Configuration Reference

The main configuration is defined in `background.js`.

```js
const CONFIG = Object.freeze({
    domain: 'hdfilmek.net',
    prefix: '[HDFilmek Guard]',
    icons: {
        active: 'icon/shield-active.png',
        inactive: 'icon/shield-inactive.png'
    }
});
```

| Property | Description |
| --- | --- |
| `domain` | Protected website domain. |
| `prefix` | Prefix used for diagnostic messages. |
| `icons.active` | Toolbar icon used when protection is enabled. |
| `icons.inactive` | Toolbar icon used when protection is disabled. |

The default settings are:

```js
const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    debug: true
});
```

---

## 16\. Technology Stack

| Technology | Purpose |
| --- | --- |
| JavaScript (ES6+) | Extension functionality and browser API integration. |
| HTML5 | Popup interface structure. |
| CSS3 | Popup styling and visual presentation. |
| Chrome Extensions API | Browser tab, window, runtime, and storage management. |
| Manifest V3 | Extension architecture and configuration. |
| Chrome Storage API | Persistent local settings. |
| Chrome Tabs API | Tab monitoring and management. |
| Chrome Runtime API | Popup-to-background communication. |
| Chrome Action API | Dynamic toolbar icon management. |

---

## 17\. Version Information

### Version 1.1.0

Current documented release.

- Manifest V3 implementation.
- Automatic HDFilmek tab protection.
- Per-window protection evaluation.
- Persistent protection preferences.
- Configurable debug logging.
- Dynamic toolbar icon updates.
- Real-time popup protection status.
- Per-window execution queues.
- Browser lifecycle event handling.
- Asynchronous error handling and settings synchronization.

---

## 18\. Privacy

HDFilmek Tab Guard uses Chrome's local extension storage to maintain its settings.

The declared permissions are limited to tab management and local storage.

The provided implementation does not include:

- Remote API requests.
- External analytics services.
- Advertising integrations.
- User account authentication.
- Remote settings synchronization.

The extension uses browser tab information to perform its protection functionality.

---

## 19\. License

See the LICENSE file for licensing information.

---

**HDFilmek Tab Guard**\
_Focused browsing. Automatic protection._
