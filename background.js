
'use strict';

// #region Configuration

/**
 * Extension configuration.
 *
 * domain:
 *   Defines the website protected by the extension.
 *
 * prefix:
 *   Prefix used for all diagnostic console messages.
 *
 * icons:
 *   Paths to the extension icons representing
 *   enabled and disabled protection states.
 */
const CONFIG = Object.freeze({
    domain: 'hdfilmek.net',
    prefix: '[HDFilmek Guard]',
    icons: {
        active: 'icon/shield-active.png',
        inactive: 'icon/shield-inactive.png'
    }
});

/**
 * Default extension settings.
 *
 * enabled:
 *   Controls whether automatic tab protection is active.
 *
 * debug:
 *   Controls whether informational console messages
 *   are displayed.
 *
 * Object.freeze prevents accidental modification
 * of the default configuration.
 */
const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    debug: true
});

/**
 * Runtime settings.
 *
 * Initialized using the default settings and replaced
 * with persisted values during initialization.
 */
let settings = { ...DEFAULT_SETTINGS };

// #endregion

// #region Logger

/**
 * Centralized extension logger.
 *
 * info():
 *   Displays informational messages only when
 *   debug logging is enabled.
 *
 * error():
 *   Always displays error messages regardless
 *   of the debug setting.
 */
const logger = {
    info(...args) {
        if (settings.debug) {
            console.log(CONFIG.prefix, ...args);
        }
    },

    error(...args) {
        console.error(CONFIG.prefix, ...args);
    }
};

// #endregion

// #region Extension Icon

/**
 * Updates the extension toolbar icon.
 *
 * Selects the appropriate icon based on the
 * current protection setting.
 *
 * enabled:
 *   Uses the active protection icon.
 *
 * disabled:
 *   Uses the inactive protection icon.
 *
 * Applies the selected icon to all supported sizes.
 */
async function updateExtensionIcon(enabled) {
    const icon = enabled
        ? CONFIG.icons.active
        : CONFIG.icons.inactive;

    try {
        await chrome.action.setIcon({
            path: {
                16: icon,
                32: icon,
                48: icon
            }
        });
    } catch (error) {
        logger.error('Icon update failed:', error);
    }
}

// #endregion

// #region Settings

/**
 * Loads persisted extension settings.
 *
 * Retrieves values from chrome.storage.local
 * using DEFAULT_SETTINGS as fallback values.
 *
 * Boolean normalization ensures that only an
 * explicit false value disables a setting.
 *
 * After loading:
 *   - Updates the runtime settings object.
 *   - Synchronizes the extension toolbar icon.
 *   - Returns the loaded settings.
 *
 * If storage access fails, the default runtime
 * settings remain available.
 */
async function loadSettings() {
    try {
        const stored = await chrome.storage.local.get(
            DEFAULT_SETTINGS
        );

        settings = {
            enabled: stored.enabled !== false,
            debug: stored.debug !== false
        };

    } catch (error) {
        logger.error('Settings loading failed:', error);
    }

    await updateExtensionIcon(settings.enabled);

    return settings;
}

/**
 * Shared initialization promise.
 *
 * Ensures protection operations wait until
 * persisted settings have finished loading.
 */
const settingsReady = loadSettings();

// #endregion

// #region Settings Change Handler

/**
 * Listens for changes to persisted extension settings.
 *
 * Only monitors the local storage area.
 *
 * enabled:
 *   Updates the runtime protection state.
 *   Synchronizes the toolbar icon.
 *
 * debug:
 *   Updates the runtime logging configuration.
 *
 * When protection becomes enabled, all existing
 * browser windows are scheduled for protection.
 *
 * Disabling protection does not automatically
 * close or modify existing tabs.
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    const enabledChanged = Boolean(changes.enabled);

    if (changes.enabled) {
        settings.enabled = changes.enabled.newValue !== false;
        updateExtensionIcon(settings.enabled);
    }

    if (changes.debug) {
        settings.debug = changes.debug.newValue !== false;
    }

    logger.info('Settings updated:', settings);

    if (enabledChanged && settings.enabled) {
        protectAllWindows();
    }
});

// #endregion

// #region URL Utilities

/**
 * Determines whether a URL belongs to HDFilmek.
 *
 * Extracts and normalizes the hostname before
 * comparing it against the configured domain.
 *
 * Supports:
 *   - hdfilmek.net
 *   - subdomain.hdfilmek.net
 *
 * Rejects unrelated domains, malformed URLs,
 * and invalid URL values.
 */
function isHDFilmek(url = '') {
    try {
        const hostname = new URL(url).hostname.toLowerCase();

        return (
            hostname === CONFIG.domain ||
            hostname.endsWith(`.${CONFIG.domain}`)
        );
    } catch {
        return false;
    }
}

/**
 * Retrieves the best available tab URL.
 *
 * Uses the committed URL when available.
 * Falls back to pendingUrl when navigation
 * has started but the URL is not yet committed.
 */
function getTabUrl(tab) {
    return tab.url || tab.pendingUrl || '';
}

/**
 * Checks whether a tab has a known destination.
 *
 * Returns false for:
 *   - Empty URLs.
 *   - about:blank.
 *
 * Pending navigation URLs are considered known
 * when they are available.
 */
function hasKnownUrl(tab) {
    const url = getTabUrl(tab);

    return Boolean(url && url !== 'about:blank');
}

// #endregion

// #region Window Execution Queue

/**
 * Per-window protection execution queues.
 *
 * Stores the execution state for each browser window.
 *
 * Prevents overlapping protection checks within
 * the same window while allowing different windows
 * to be processed independently.
 */
const windowQueues = new Map();

/**
 * Schedules a protection check for a browser window.
 *
 * If a check is already running:
 *   Marks the existing queue as pending so another
 *   protection pass runs after the current one.
 *
 * Otherwise:
 *   Creates a new queue state and starts processing.
 *
 * Invalid window IDs are ignored.
 */
function scheduleProtection(windowId) {
    if (!Number.isInteger(windowId)) return;

    const existingState = windowQueues.get(windowId);

    if (existingState) {
        existingState.pending = true;
        return;
    }

    const state = { pending: true };

    windowQueues.set(windowId, state);

    runProtectionQueue(windowId, state);
}

/**
 * Processes pending protection checks sequentially.
 *
 * Each iteration:
 *   - Clears the pending flag.
 *   - Executes the window protection routine.
 *   - Repeats if another event requested a check.
 *
 * The queue is removed after processing finishes.
 *
 * The identity check prevents an older execution
 * from accidentally deleting a newer queue state.
 */
async function runProtectionQueue(windowId, state) {
    try {
        while (state.pending) {
            state.pending = false;

            await protectWindow(windowId);
        }
    } finally {
        if (windowQueues.get(windowId) === state) {
            windowQueues.delete(windowId);
        }
    }
}

// #endregion

// #region Core Protection

/**
 * Performs tab protection for a specific window.
 *
 * Protection workflow:
 *
 * 1. Waits for settings initialization.
 * 2. Checks whether protection is enabled.
 * 3. Retrieves all tabs belonging to the window.
 * 4. Determines whether a fully loaded HDFilmek
 *    page exists in that window.
 * 5. Identifies tabs outside the protected domain.
 * 6. Rechecks the persisted enabled setting.
 * 7. Closes unwanted tabs.
 *
 * HDFilmek tabs and tabs without known destinations
 * are preserved.
 *
 * The second settings check reduces the possibility
 * of closing tabs after protection has been disabled
 * during an asynchronous protection operation.
 *
 * Errors are caught and reported without interrupting
 * the background service worker.
 */
async function protectWindow(windowId) {
    try {
        // Wait until persisted settings are available.
        await settingsReady;

        // Skip protection when disabled.
        if (!settings.enabled) return;

        // Retrieve all tabs belonging to this window.
        const tabs = await chrome.tabs.query({ windowId });

        /**
         * Activate protection only when at least one
         * HDFilmek tab has completely finished loading.
         */
        const isProtected = tabs.some(tab =>
            tab.status === 'complete' &&
            isHDFilmek(getTabUrl(tab))
        );

        // No fully loaded HDFilmek page means no protection.
        if (!isProtected) return;

        /**
         * Identify unwanted tabs.
         *
         * A tab is considered unwanted when:
         *   - It has a valid numeric tab ID.
         *   - Its destination URL is known.
         *   - Its URL does not belong to HDFilmek.
         */
        const unwantedTabIds = tabs
            .filter(tab =>
                Number.isInteger(tab.id) &&
                hasKnownUrl(tab) &&
                !isHDFilmek(getTabUrl(tab))
            )
            .map(tab => tab.id);

        // Nothing needs to be removed.
        if (unwantedTabIds.length === 0) return;

        /**
         * Recheck the persisted protection setting.
         *
         * This avoids relying exclusively on the runtime
         * settings object, which might not yet reflect
         * a recently saved setting change.
         */
        const latestSettings = await chrome.storage.local.get({
            enabled: DEFAULT_SETTINGS.enabled
        });

        if (latestSettings.enabled === false) return;

        // Close all identified unwanted tabs.
        await chrome.tabs.remove(unwantedTabIds);

        // Report the number of removed tabs.
        logger.info(
            `Window ${windowId}: closed ${unwantedTabIds.length} unwanted tab(s).`
        );

    } catch (error) {
        logger.error(`Window ${windowId}:`, error);
    }
}

// #endregion

// #region Window Status

/**
 * Retrieves the current protection status of a window.
 *
 * Used by the popup to display accurate protection
 * information for the selected browser window.
 *
 * Returns:
 *   enabled:
 *     Whether protection is enabled.
 *
 *   debug:
 *     Whether debug logging is enabled.
 *
 *   domain:
 *     The configured protected domain.
 *
 *   protected:
 *     Whether the window contains a fully loaded
 *     HDFilmek page while protection is enabled.
 *
 *   status:
 *     One of the following states:
 *       - disabled
 *       - active
 *       - waiting
 *
 * Reads persisted settings to ensure the returned
 * configuration reflects the latest stored values.
 */
async function getWindowStatus(windowId) {
    await settingsReady;

    const stored = await chrome.storage.local.get(
        DEFAULT_SETTINGS
    );

    const enabled = stored.enabled !== false;
    const debug = stored.debug !== false;

    let protectedWindow = false;

    /**
     * Check for a fully loaded HDFilmek tab only
     * when protection is enabled and the window ID
     * is a valid integer.
     */
    if (enabled && Number.isInteger(windowId)) {
        const tabs = await chrome.tabs.query({ windowId });

        protectedWindow = tabs.some(tab =>
            tab.status === 'complete' &&
            isHDFilmek(getTabUrl(tab))
        );
    }

    // Return the complete status information.
    return {
        enabled,
        debug,
        domain: CONFIG.domain,
        protected: protectedWindow,
        status: !enabled
            ? 'disabled'
            : protectedWindow
                ? 'active'
                : 'waiting'
    };
}

// #endregion

// #region Popup Communication

/**
 * Handles communication requests from the extension popup.
 *
 * Supported message:
 *
 * GET_STATUS:
 *   Requests the current protection status
 *   for a specified browser window.
 *
 * The response is sent asynchronously after
 * getWindowStatus() completes.
 *
 * Returning true keeps the message channel open
 * until sendResponse() is called.
 *
 * Unknown message types are ignored.
 */
chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
        if (message.type !== 'GET_STATUS') return;

        getWindowStatus(message.windowId)
            .then(sendResponse)
            .catch(error => {
                logger.error('Status request failed:', error);

                sendResponse({ error: true });
            });

        return true;
    }
);

// #endregion

// #region Tab Event Handlers

/**
 * Handles newly created tabs.
 *
 * Schedules protection when the new tab already
 * has a known destination URL.
 */
chrome.tabs.onCreated.addListener(tab => {
    if (hasKnownUrl(tab)) {
        scheduleProtection(tab.windowId);
    }
});

/**
 * Handles tab URL and loading state changes.
 *
 * Schedules protection when:
 *   - The tab URL changes.
 *   - The tab finishes loading.
 *
 * This ensures protection is reevaluated when
 * a new HDFilmek page becomes fully loaded.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
        scheduleProtection(tab.windowId);
    }
});

/**
 * Handles tab activation.
 *
 * Rechecks the containing window whenever
 * the active tab changes.
 */
chrome.tabs.onActivated.addListener(({ windowId }) => {
    scheduleProtection(windowId);
});

/**
 * Handles tabs attached to another window.
 *
 * Schedules protection for the destination window.
 */
chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
    scheduleProtection(attachInfo.newWindowId);
});

/**
 * Handles tabs detached from their original window.
 *
 * Schedules protection for the source window
 * so its remaining tabs can be reevaluated.
 */
chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
    scheduleProtection(detachInfo.oldWindowId);
});

// #endregion

// #region Window Event Handlers

/**
 * Handles browser window removal.
 *
 * Deletes the corresponding execution queue
 * to prevent obsolete window states from remaining
 * in memory.
 */
chrome.windows.onRemoved.addListener(windowId => {
    windowQueues.delete(windowId);
});

// #endregion

// #region Protect All Windows

/**
 * Schedules protection checks for all existing windows.
 *
 * Workflow:
 *   1. Waits for settings initialization.
 *   2. Checks whether protection is enabled.
 *   3. Retrieves all open browser windows.
 *   4. Schedules a protection check for each valid window.
 *
 * Used during extension startup, installation,
 * and when protection is enabled through settings.
 */
async function protectAllWindows() {
    try {
        await settingsReady;

        // Skip initialization checks when protection is disabled.
        if (!settings.enabled) return;

        // Retrieve all currently open browser windows.
        const windows = await chrome.windows.getAll();

        // Schedule protection independently for each window.
        for (const window of windows) {
            if (Number.isInteger(window.id)) {
                scheduleProtection(window.id);
            }
        }

        logger.info('Existing windows scheduled.');

    } catch (error) {
        logger.error('Initialization failed:', error);
    }
}

// #endregion

// #region Extension Lifecycle

/**
 * Handles browser startup.
 *
 * Schedules protection checks for all existing
 * windows when the browser starts.
 */
chrome.runtime.onStartup.addListener(protectAllWindows);

/**
 * Handles extension installation and updates.
 *
 * Waits for settings initialization before
 * scheduling protection checks.
 */
chrome.runtime.onInstalled.addListener(async () => {
    await settingsReady;
    await protectAllWindows();
});

// #endregion

// #region Initialization

/**
 * Background service worker initialization.
 *
 * Waits for persisted settings and the initial
 * toolbar icon update to complete.
 *
 * Logs a confirmation message when initialization
 * has finished successfully.
 */
settingsReady.then(() => {
    logger.info('Background service worker initialized.');
});

// #endregion
