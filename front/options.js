document.getElementById("saveKey").addEventListener("click", () => {
  const apiKey = document.getElementById("apiKey").value.trim();
  
  if (apiKey) {
    chrome.storage.sync.set({ openaiApiKey: apiKey }, () => {
      alert("API Key saved successfully!");
    });
  } else {
    alert("Please enter a valid API key.");
  }
});

// Load the saved API key when the options page is opened
chrome.storage.sync.get(["openaiApiKey"], (result) => {
  if (result.openaiApiKey) {
    document.getElementById("apiKey").value = result.openaiApiKey;
  }
});
