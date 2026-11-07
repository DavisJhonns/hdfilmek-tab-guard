
'use strict';

// #region Configuration

/**
 * Extension configuration.
 *
 * prefix:
 *   Prefix used to identify diagnostic error messages
 *   in the browser console.
 */
const CONFIG = Object.freeze({
    prefix: '[HDFilmek Guard]'
});

/**
 * Default extension settings.
 *
 * enabled:
 *   Controls whether automatic tab protection is active.
 *
 * debug:
 *   Controls whether informational logging is enabled.
 */
const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    debug: true
});

/**
 * Status refresh sequence counter.
 *
 * Incremented every time updateStatus() is called.
 *
 * Used to identify outdated asynchronous requests
 * and prevent older responses from overwriting
 * more recent status information.
 */
let refreshSequence = 0;

// #endregion

// #region DOM Elements

/**
 * References to popup interface elements.
 *
 * These elements are updated dynamically
 * throughout the popup's lifecycle.
 *
 * protectionToggle:
 *   Controls automatic tab protection.
 *
 * debugToggle:
 *   Controls diagnostic logging.
 *
 * statusCard:
 *   Main container displaying protection status.
 *
 * statusDot:
 *   Visual status indicator.
 *
 * statusLabel:
 *   Short description of the current protection state.
 *
 * statusTitle:
 *   Main protection status message.
 *
 * statusDescription:
 *   Additional information about the current state.
 *
 * domainText:
 *   Displays the protected domain returned
 *   by the background service worker.
 */
const elements = {
    protectionToggle: document.getElementById('protectionToggle'),
    debugToggle: document.getElementById('debugToggle'),
    statusCard: document.getElementById('statusCard'),
    statusDot: document.getElementById('statusDot'),
    statusLabel: document.getElementById('statusLabel'),
    statusTitle: document.getElementById('statusTitle'),
    statusDescription: document.getElementById('statusDescription'),
    domainText: document.getElementById('domainText')
};

// #endregion

// #region Logger

/**
 * Centralized popup error logger.
 *
 * error():
 *   Displays errors using the configured extension prefix.
 *
 * Error messages are always displayed independently
 * of the debug setting.
 */
const logger = {
    error(...args) {
        console.error(CONFIG.prefix, ...args);
    }
};

// #endregion

// #region Settings

/**
 * Loads persisted extension settings.
 *
 * Retrieves values from chrome.storage.local.
 * Missing settings are initialized using DEFAULT_SETTINGS.
 *
 * Returns the stored settings object.
 */
async function loadSettings() {
    return chrome.storage.local.get(DEFAULT_SETTINGS);
}

/**
 * Saves an individual extension setting.
 *
 * key:
 *   Name of the setting to update.
 *
 * value:
 *   New value to persist.
 *
 * Uses a computed property name to update
 * only the specified setting.
 */
async function saveSetting(key, value) {
    await chrome.storage.local.set({
        [key]: value
    });
}

// #endregion

// #region Status Display

/**
 * Updates the popup protection status interface.
 *
 * Receives the status object returned by the
 * background service worker.
 *
 * Handles four possible situations:
 *
 * 1. Unavailable:
 *    Status information could not be retrieved.
 *
 * 2. Disabled:
 *    Automatic protection is turned off.
 *
 * 3. Active:
 *    A fully loaded HDFilmek page exists
 *    in the current browser window.
 *
 * 4. Waiting:
 *    Protection is enabled but no fully loaded
 *    HDFilmek page is currently detected.
 *
 * Also updates the protected domain and
 * the inactive appearance of the status card.
 */
function setStatus(status) {

    /**
     * Handle missing or unsuccessful status responses.
     *
     * Displays an unavailable state instead of
     * attempting to access missing properties.
     */
    if (!status || status.error) {
        elements.statusCard.classList.add('inactive');

        elements.statusLabel.textContent = 'Unavailable';
        elements.statusTitle.textContent = 'Status unavailable';

        elements.statusDescription.textContent =
            'Unable to retrieve protection status.';

        return;
    }

    // Extract the relevant protection information.
    const {
        enabled,
        protected: isProtected,
        domain
    } = status;

    // Synchronize the displayed protected domain.
    elements.domainText.textContent = domain;

    /**
     * Update the inactive visual state.
     *
     * The status card is inactive when protection
     * is disabled or no protected page is detected.
     */
    elements.statusCard.classList.toggle(
        'inactive',
        !enabled || !isProtected
    );

    /**
     * Disabled state.
     *
     * Indicates that automatic tab protection
     * has been manually turned off.
     */
    if (!enabled) {
        elements.statusLabel.textContent = 'Protection disabled';
        elements.statusTitle.textContent = 'Protection is OFF';

        elements.statusDescription.textContent =
            'Tab protection is currently turned off.';

        return;
    }

    /**
     * Active state.
     *
     * Indicates that HDFilmek is loaded and
     * the current browser window is protected.
     */
    if (isProtected) {
        elements.statusLabel.textContent = 'Protection active';
        elements.statusTitle.textContent = 'Window protected';

        elements.statusDescription.textContent =
            'HDFilmek is loaded. Unwanted tabs are monitored.';

        return;
    }

    /**
     * Waiting state.
     *
     * Protection is enabled but will only activate
     * after an HDFilmek page finishes loading.
     */
    elements.statusLabel.textContent = 'Waiting for HDFilmek';
    elements.statusTitle.textContent = 'Protection ready';

    elements.statusDescription.textContent =
        'Protection activates when an HDFilmek page finishes loading.';
}

// #endregion

// #region Status Refresh

/**
 * Retrieves and refreshes the popup status.
 *
 * Workflow:
 *
 * 1. Generates a new refresh sequence number.
 * 2. Loads persisted extension settings.
 * 3. Retrieves the active tab in the last focused window.
 * 4. Requests protection information from the background
 *    service worker using GET_STATUS.
 * 5. Ignores outdated asynchronous responses.
 * 6. Synchronizes the settings controls.
 * 7. Updates the protection status interface.
 *
 * The refresh sequence prevents race conditions
 * when multiple status requests overlap.
 *
 * Only the most recently initiated request
 * is allowed to update the interface.
 *
 * Errors are logged and the unavailable state
 * is displayed when the current request fails.
 */
async function updateStatus() {

    // Assign a unique sequence number to this refresh.
    const sequence = ++refreshSequence;

    try {
        // Retrieve persisted extension settings.
        const settings = await loadSettings();

        // Retrieve the active tab in the last focused window.
        const [activeTab] = await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true
        });

        /**
         * Request the current protection status
         * from the background service worker.
         *
         * windowId identifies which browser window
         * should be checked.
         */
        const status = await chrome.runtime.sendMessage({
            type: 'GET_STATUS',
            windowId: activeTab?.windowId
        });

        /**
         * Ignore outdated asynchronous responses.
         *
         * Another updateStatus() call may have started
         * while this request was waiting for a response.
         */
        if (sequence !== refreshSequence) return;

        // Synchronize the protection toggle.
        elements.protectionToggle.checked =
            settings.enabled !== false;

        // Synchronize the debug toggle.
        elements.debugToggle.checked =
            settings.debug !== false;

        // Update the displayed protection status.
        setStatus(status);

    } catch (error) {
        logger.error('Status update failed:', error);

        /**
         * Only update the interface if this request
         * is still the latest active refresh.
         */
        if (sequence === refreshSequence) {
            setStatus(null);
        }
    }
}

// #endregion

// #region Setting Handler

/**
 * Handles changes to individual settings.
 *
 * Workflow:
 *
 * 1. Stores the previous toggle value.
 * 2. Temporarily disables the control.
 * 3. Saves the new setting value.
 * 4. Refreshes protection status when necessary.
 * 5. Restores the previous toggle value if saving fails.
 * 6. Re-enables the control.
 *
 * The previous value is used to restore the interface
 * when the storage operation encounters an error.
 *
 * toggle:
 *   Checkbox element associated with the setting.
 *
 * key:
 *   Name of the setting to update in local storage.
 */
async function handleSettingChange(toggle, key) {

    // Preserve the previous value for error recovery.
    const previousValue = !toggle.checked;

    // Prevent additional changes while saving.
    toggle.disabled = true;

    try {
        // Persist the newly selected setting.
        await saveSetting(key, toggle.checked);

        /**
         * Refresh protection information when
         * the main protection setting changes.
         *
         * Debug logging changes do not require
         * a protection status refresh.
         */
        if (key === 'enabled') {
            await updateStatus();
        }

    } catch (error) {
        logger.error(`Failed to update ${key}:`, error);

        // Restore the previous checkbox state.
        toggle.checked = previousValue;

    } finally {
        // Always re-enable the setting control.
        toggle.disabled = false;
    }
}

// #endregion

// #region Settings Event Handlers

/**
 * Protection toggle event handler.
 *
 * Saves changes to the enabled setting.
 * Updates the protection status after saving.
 */
elements.protectionToggle.addEventListener('change', () => {
    handleSettingChange(
        elements.protectionToggle,
        'enabled'
    );
});

/**
 * Debug toggle event handler.
 *
 * Saves changes to the debug setting.
 * Does not require a protection status refresh.
 */
elements.debugToggle.addEventListener('change', () => {
    handleSettingChange(
        elements.debugToggle,
        'debug'
    );
});

// #endregion

// #region Storage Events

/**
 * Listens for changes to persisted extension settings.
 *
 * Only monitors chrome.storage.local.
 *
 * When either the enabled or debug setting changes,
 * refreshes the popup to synchronize its controls
 * and displayed protection information.
 *
 * This also handles setting changes originating
 * outside the popup.
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes.enabled || changes.debug) {
        updateStatus();
    }
});

// #endregion

// #region Browser Events

/**
 * Tab URL and loading state changes.
 *
 * Refreshes the status when:
 *   - A tab URL changes.
 *   - A tab finishes loading.
 *
 * Other tab updates are ignored.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
        updateStatus();
    }
});

/**
 * Refreshes the popup when the active tab changes.
 */
chrome.tabs.onActivated.addListener(updateStatus);

/**
 * Refreshes the popup when a new tab is created.
 */
chrome.tabs.onCreated.addListener(updateStatus);

/**
 * Refreshes the popup when a tab is removed.
 */
chrome.tabs.onRemoved.addListener(updateStatus);

/**
 * Refreshes the popup when a tab is moved
 * into another browser window.
 */
chrome.tabs.onAttached.addListener(updateStatus);

/**
 * Refreshes the popup when browser window focus changes.
 *
 * Ensures the popup displays information corresponding
 * to the currently focused browser window.
 */
chrome.windows.onFocusChanged.addListener(updateStatus);

// #endregion

// #region Initialization

/**
 * Initializes the popup interface.
 *
 * Retrieves the current settings and protection status,
 * synchronizes the toggle controls, and displays
 * the current state of the active browser window.
 */
updateStatus();

// #endregion
