const CATCH_ALL = 1

const blacklistTopics = [
    "ASMR",
    "Beauty Product",
    "Celebrity",
    "Challenges",
    "Clickbait",
    "Compilation",
    "Conspiracy Theory",
    "DIY",
    "Drama",
    "Feud",
    "Gameplay",
    "Get Rich Quick",
    "Gossip",
    "Health Advice",
    "Hoarding",
    "Investigations",
    "Livestream",
    "Mukbang",
    "Obscure",
    "Paranormal",
    "Prank",
    "Pseudo-Science",
    "Rants",
    "Reaction Video",
    "Review",
    "Satan",
    "Sensationalist",
    "Sports",
    "Story Time",
    "Street Interview",
    "Top 10 List",
    "Unboxing",
    "Viral",
    "Vlog",
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
    model: 'gpt-3.5-turbo-0125',
    messages: [
      { role: 'system', content: systemQuery},
      { role: 'user', content: userQuery},
    ]
  });
  
  const response = await fetch(endpoint, { method: 'POST', headers: headers, body: body });
  const data = await response.json();

  console.log(`>>> ${title}: >> data: ${JSON.stringify(data)}`)

  let completion = ''
  try {
    completion = data.choices[0].message.content;
  } catch (e) {
    return CATCH_ALL;
  }

  if (completion) {
    return parseFloat(completion);
  } else {
    return CATCH_ALL;
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
