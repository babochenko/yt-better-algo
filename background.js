const CATCH_ALL = []

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

function queryScores(videos) {
  return '- ' + videos.join('\n- ')
}

function parseScores(videos, resp) {
  const scores = resp.split('\n').map(Number)
  const zipped = [];

  for (let i = 0; i < length; i++) {
      zipped.push([videos[i], scores[i]]);
  }

  return zipped;
}

async function scoreVideos(apiKey, videos) {
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
  const systemQuery = 'You are a helpful assistant.';
  const userQuery = `I have a list of videos:
  
  ${queryScores(videos)}
  
  For each video, provide a score between 0 and 1, where 0 means that this video is` +
  ` not helpful and distracting, and 1 means that this video is useful for my personal` +
  ` growth. Respond with just the list of numbers`

  const body = JSON.stringify({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemQuery},
      { role: 'user', content: userQuery},
    ]
  });

  const response = await fetch(endpoint, { method: 'POST', headers: headers, body: body });
  const data = await response.json();

  let completion = ''
  try {
    completion = data.choices[0].message.content;
  } catch (e) {
    return CATCH_ALL;
  }

  if (completion) {
    return parseScores(videos, completion);
  } else {
    return CATCH_ALL;
  }
}

class Buffer {
  constructor(size) {
      this.size = size;
      this.buffer = [];
      this.promises = [];
  }

  async append(input, transform) {
      return new Promise((resolve) => {
          this.buffer.push(input);
          this.promises.push(resolve);

          if (this.buffer.length >= this.size) {
              // Apply the transformation function to the buffer
              const transformedBuffer = transform(this.buffer);

              // Resolve each promise with the corresponding transformed value
              this.promises.forEach((resolve, index) => {
                  resolve(transformedBuffer[index]);
              });

              // Reset buffer and promises
              this.buffer = [];
              this.promises = [];
          }
      });
  }
}

const buffer = new Buffer(10)

async function checkVideoEligible(apiKey, title) {
  const scores = await buffer.append(title, async function(buf) {
    return scoreVideos(apiKey, buf);
  })
  return scores[title];
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
