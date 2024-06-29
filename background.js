// ------------------------- API
const CATCH_ALL = [];

function queryScores(videos) {
  return "- " + videos.join("\n- ");
}

function parseScores(videos, resp) {
  const scores = resp.split(",").map(Number);
  const pairs = [];

  for (let i = 0; i < videos.length; i++) {
    pairs.push([videos[i], scores[i]]);
  }

  return pairs;
}

export async function scoreVideos(apiKey, videos) {
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const systemQuery = "You are a helpful assistant.";
  const userQuery =
    `I have a list of videos:
    
    ${queryScores(videos)}
    
    For each video, provide a score between 0 and 1, where 0 means that this video is` +
    ` not helpful and distracting, and 1 means that this video is useful for my personal` +
    ` growth. Respond with just the list of numbers, comma-separated, without spaces, ` +
    ` prefixes, or any other delimiters`;

  const body = JSON.stringify({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemQuery },
      { role: "user", content: userQuery },
    ],
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: headers,
    body: body,
  });
  const data = await response.json();

  if ("error" in data) {
    console.log("rate limit exceeded");
    return CATCH_ALL;
  }

  try {
    const content = data.choices[0].message.content;
    return parseScores(videos, content);
  } catch (e) {
    console.log(e);
    return CATCH_ALL;
  }
}

// ------------------------- ASYNCS

const GPT_BUFFER_SIZE = 10;
export let videoCount = 0;

class Buffer {
  constructor(size) {
    this.size = size;
    this.buffer = [];
    this.promises = [];
  }

  async append(input, transform) {
    return new Promise(async (resolve) => {
      this.buffer.push(input);
      this.promises.push(resolve);

      if (this.buffer.length == this.size) {
        // Apply the transformation function to the buffer
        const buf = [...this.buffer];
        this.buffer = [];

        const proms = [...this.promises];
        this.promises = [];

        const transformedBuffer = await transform(buf);

        // Resolve each promise with the corresponding transformed value
        proms.forEach((resolve, index) => {
          resolve(transformedBuffer[index][1]);
        });
      }
    });
  }
}

const buffer = new Buffer(GPT_BUFFER_SIZE);

export async function scoreVideo(apiKey, title) {
  return await buffer.append(title, async function (buf) {
    const s = await scoreVideos(apiKey, buf);
    videoCount += s.length;
    return s;
  });
}

// ------------------------- BACKGROUND

const MAX_VIDEO_THRESHOLD = 10

function onNextVideo(request, sendResponse) {
  if (request.action === "checkVideoEligible") {
    if (chrome.runtime.scoreCount > MAX_VIDEO_THRESHOLD) {
      console.log('Score response limit exceeded, stopping listener.');
      return;
    }

    chrome.runtime.scoreCount = 0;
    chrome.storage.sync.get(['extensionEnabled', 'openaiApiKey'], (result) => {
      if (!result.extensionEnabled) {
        console.log('>> extension is disabled');
        sendResponse({ score: 1 });

      } else if (!result.openaiApiKey) {
        console.log('>> no openai api key');
        sendResponse({ score: 1 });

      } else {
        scoreVideo(result.openaiApiKey, request.title).then(score => {
          console.log(score)
          chrome.runtime.scoreCount++;
          sendResponse({ score: score });
        });
      }
    });
    return true;
  }
}

let count = 0;
chrome.runtime.onMessage.addListener(function listener(request, sender, sendResponse) {
  count++;
  if (count > 30) {
    chrome.runtime.onMessage.removeListener(listener);
  }
  onNextVideo(request, sendResponse);
});
