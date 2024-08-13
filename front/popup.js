const baseQueryString = `I have a list of videos:

{videos}

For each video, provide a score between 0 and 1, where 0 means that this video is` +
` not helpful and distracting, and 1 means that this video is useful for my personal` +
` growth. Respond with just the list of numbers, comma-separated, without spaces, ` +
` prefixes, or any other delimiters`;

const saveBtn = () => document.getElementById('saveSettings');

const querybtn = document.getElementById('edit-custom-query');
querybtn.addEventListener('click', () => {
  const container = document.getElementById('custom-query-container');
  if (container.style.display === 'block') {
    container.style.display = 'none';
    querybtn.innerText = 'Edit Custom LLM Query';
  } else {
    container.style.display = 'block';
    querybtn.innerText = 'Hide Custom LLM Query';
  }
});

document.addEventListener('DOMContentLoaded', function () {
  // Load saved settings when the popup is opened
  chrome.storage.sync.get([
    'extensionEnabled',
    'keyOpenai',
    'keyGroq',
    'model',
    'customQuery',
  ], function (result) {
    document.getElementById('enabled-toggle').checked = result.extensionEnabled ?? false;
    document.getElementById('key-openai').value = result.keyOpenai ?? '';
    document.getElementById('key-groq').value = result.keyGroq ?? '';
    document.getElementById('model').value = result.model ?? 'gpt4o';
    document.getElementById('custom-query').value = result.customQuery ?? baseQueryString;
  });

  // Save settings when the Save button is clicked
  saveBtn().addEventListener('click', function () {
    const extensionEnabled = document.getElementById('enabled-toggle').checked;
    const keyOpenai = document.getElementById('key-openai').value.trim();
    const keyGroq = document.getElementById('key-groq').value.trim();

    const modelSel = document.getElementById('model')
    const model = modelSel.options[modelSel.selectedIndex].value;

    const customQuery = document.getElementById('custom-query').value;
    if (!customQuery.includes("{videos}")) {
      alert("Custom query should contain the {videos} placeholder!");
      return;
    }

    chrome.storage.sync.set({
      extensionEnabled,
      keyOpenai,
      keyGroq,
      model,
      customQuery,
    }, function () {
      saveBtn().innerText = 'Saved!'
    });
  });
});
