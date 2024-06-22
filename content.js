async function compareTitleWithQuery(query, title) {
  const apiKey = 'YOUR_OPENAI_API_KEY';
  const endpoint = 'https://api.openai.com/v1/chat/completions';
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  
  const body = JSON.stringify({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: `Compare the similarity between the search query "${query}" and the video title "${title}". Provide a similarity score between 0 and 1, where 0 means not similar at all and 1 means exactly the same. Respond with just the number` }
    ]
  });
  
  const response = await fetch(endpoint, { method: 'POST', headers: headers, body: body });
  const data = await response.json();
  
  const completion = data.choices[0].message.content;
  console.log(`>>> ${title}: >> ${completion}`)
  const scoreMatch = completion.match(/similarity score between 0 and 1 is (\d+(\.\d+)?)/i);
  
  if (scoreMatch && scoreMatch[1]) {
    return parseFloat(scoreMatch[1]);
  } else {
    return 0;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "compareTitle") {
    chrome.storage.sync.get(["openaiApiKey"], (result) => {
      if (result.openaiApiKey) {
        compareTitleWithQuery(result.openaiApiKey, request.query, request.title).then(score => {
          sendResponse({ score: score });
        });
      } else {
        sendResponse({ score: 0 }); // Fallback if no API key is found
      }
    });
    return true;
  }
});

let searchQuery = "";

// Capture the search query when the search button is clicked
document.addEventListener("click", (event) => {
  if (event.target.closest("button#search-icon-legacy")) {
    const searchInput = document.querySelector("input#search");
    if (searchInput) {
      searchQuery = searchInput.value.toLowerCase();
    }
  }
});

// Observe changes on the search results page to filter the videos
const observer = new MutationObserver((mutations) => {
  if (searchQuery) {
    const videos = document.querySelectorAll("ytd-video-renderer");
    videos.forEach((video) => {
      const titleElement = video.querySelector("#video-title");
      if (titleElement) {
        const titleText = titleElement.innerText;
        chrome.runtime.sendMessage({
          action: "compareTitle",
          query: searchQuery,
          title: titleText
        }, (response) => {
          if (response && response.score < 0.5) { // You can adjust the threshold
            video.style.display = "none"; // Hide non-matching videos
          }
        });
      }
    });
  }
});

// Start observing the search results container for changes
const targetNode = document.querySelector("#contents");
if (targetNode) {
  observer.observe(targetNode, { childList: true, subtree: true });
}
