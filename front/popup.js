document.addEventListener('DOMContentLoaded', function () {
  // Load saved settings when the popup is opened
  chrome.storage.sync.get(['extensionEnabled', 'openaiApiKey'], function (result) {
    document.getElementById('enabled-toggle').checked = result.extensionEnabled ?? false;
    document.getElementById('apiKey').value = result.openaiApiKey ?? '';
  });

  // Save settings when the Save button is clicked
  document.getElementById('saveSettings').addEventListener('click', function () {
    const extensionEnabled = document.getElementById('enabled-toggle').checked;
    const apiKey = document.getElementById('apiKey').value.trim();

    chrome.storage.sync.set({
      extensionEnabled: extensionEnabled,
      openaiApiKey: apiKey
    }, function () {
      alert('Settings saved successfully!');
    });
  });
});
