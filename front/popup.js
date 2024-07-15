const saveBtn = () => document.getElementById('saveSettings');

document.addEventListener('DOMContentLoaded', function () {
  // Load saved settings when the popup is opened
  chrome.storage.sync.get(['extensionEnabled', 'keyOpenai', 'keyGroq', 'model'], function (result) {
    document.getElementById('enabled-toggle').checked = result.extensionEnabled ?? false;
    document.getElementById('key-openai').value = result.keyOpenai ?? '';
    document.getElementById('key-groq').value = result.keyGroq ?? '';
    document.getElementById('model').value = result.model ?? 'gpt4o';
  });

  // Save settings when the Save button is clicked
  saveBtn().addEventListener('click', function () {
    const extensionEnabled = document.getElementById('enabled-toggle').checked;
    const keyOpenai = document.getElementById('key-openai').value.trim();
    const keyGroq = document.getElementById('key-groq').value.trim();

    const modelSel = document.getElementById('model')
    const model = modelSel.options[modelSel.selectedIndex].value;

    chrome.storage.sync.set({
      extensionEnabled,
      keyOpenai,
      keyGroq,
      model,
    }, function () {
      saveBtn().innerText = 'Saved!'
    });
  });
});
