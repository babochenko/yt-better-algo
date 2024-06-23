document.addEventListener('DOMContentLoaded', () => {
    // Load saved settings when the popup is opened
    chrome.storage.sync.get(['extensionEnabled', 'openaiApiKey'], (result) => {
    document.getElementById('enabled-toggle').checked = result.extensionEnabled ?? false;
    document.getElementById('apiKey').value = result.openaiApiKey ?? '';
    });

    // Save settings when the Save button is clicked
    document.getElementById('saveSettings').addEventListener('click', () => {
    const extensionEnabled = document.getElementById('enabled-toggle').checked;
    const apiKey = document.getElementById('apiKey').value.trim();

    chrome.storage.sync.set({
        extensionEnabled: extensionEnabled,
        openaiApiKey: apiKey
    }, () => {
        alert('Settings saved successfully!');
    });
    });
});
