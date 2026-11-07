'use strict';

// HDFilmek domain check
function isHDFilmek(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();

        return hostname === 'hdfilmek.net' ||
               hostname.endsWith('.hdfilmek.net');
    } catch {
        return false;
    }
}

// Check Chrome tabs
async function protectWindow(windowId) {
    try {
        const tabs = await chrome.tabs.query({ windowId });

        // If there is no HDFilmek tab, do nothing
        const hasHDFilmek = tabs.some(tab =>
            isHDFilmek(tab.url || tab.pendingUrl || '')
        );

        if (!hasHDFilmek) return;

        // Close all other tabs
        const unwantedTabs = tabs.filter(tab =>
            !isHDFilmek(tab.url || tab.pendingUrl || '')
        );

        const ids = unwantedTabs
            .map(tab => tab.id)
            .filter(id => Number.isInteger(id));

        if (ids.length > 0) {
            console.log(
                '[HDFilmek Guard] Closed tabs:',
                ids.length
            );

            await chrome.tabs.remove(ids);
        }

    } catch (error) {
        console.error('[HDFilmek Guard]', error);
    }
}

// When a new tab is opened
chrome.tabs.onCreated.addListener(tab => {
    protectWindow(tab.windowId);
});

// When a tab's URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
        protectWindow(tab.windowId);
    }
});

// When a tab is activated
chrome.tabs.onActivated.addListener(activeInfo => {
    protectWindow(activeInfo.windowId);
});

// Check all windows when Chrome starts
chrome.runtime.onStartup.addListener(async () => {
    const windows = await chrome.windows.getAll();

    for (const win of windows) {
        if (win.id !== undefined) {
            await protectWindow(win.id);
        }
    }
});

console.log('[HDFilmek Guard] Protection is active!');
