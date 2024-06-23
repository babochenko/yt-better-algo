const blacklistTopics = [
    "Reaction Video",
    "Conspiracy Theory",
    "Drama",
    "Feud",
    "Celebrity",
    "Gossip",
    "Prank",
    "Top 10 List",
    "Unboxing",
    "ASMR",
    "Mukbang",
    "Random Street Interviews",
    "Clickbait",
    "Viral",
    "Challenges",
    "Compilation",
    "Get Rich Quick",
    "Sensationalist",
    "Gameplay",
    "Hoarding",
    "Pseudo-Science",
    "Beauty Product",
    "Review",
    "Sports",
    "Obscure",
    "Story Time",
    "Rants",
    "Livestream",
    "Paranormal",
    "Investigations",
    "Health Advice",
    "Vlog",
    "DIY",
    "Satan",
]

const blacklistTopicsStr = `"${blacklistTopics.join(", ")}"`

async function checkVideoEligible(apiKey, title) {
  const endpoint = 'https://api.openai.com/v1/chat/completions';
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
  const systemQuery = 'You are a helpful assistant.';
  const userQuery = `Compare the similarity between the video title "${title}"` +
    ` and blacklisted topics "${blacklistTopicsStr}". Provide a difference score` +
    ` between 0 and 1, where 0 means exactly the same and 1 means not similar at all. Respond with just the number` 

  const body = JSON.stringify({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemQuery},
      { role: 'user', content: userQuery},
    ]
  });
  
  const response = await fetch(endpoint, { method: 'POST', headers: headers, body: body });
  const data = await response.json();
  
  const completion = data.choices[0].message.content;
  console.log(`>>> ${title}: >> score: ${completion}`)
  
  if (completion) {
    return parseFloat(completion);
  } else {
    return 0;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkVideoEligible") {
    chrome.storage.sync.get(['extensionEnabled', 'openaiApiKey'], (result) => {
      if (!result.extensionEnabled) {
        console.log('>> extension is disabled');
        sendResponse({ score: 1 });

      } else if (!result.openaiApiKey) {
        console.log('>> no openai api key');
        sendResponse({ score: 1 });

      } else {
        checkVideoEligible(result.openaiApiKey, request.title).then(score => {
          sendResponse({ score: score });
        });
      }
    });
    return true;
  }
});
