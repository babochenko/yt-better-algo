import { listenMessage } from './messages.js';
import { Buffer } from './buffer.js';
import { scoreVideos } from './api.js';

const MAX_VIDEO_THRESHOLD = 10;
const GPT_BUFFER_SIZE = 20;

const buffer = new Buffer(GPT_BUFFER_SIZE);

async function getScoreVideo(request) {
  if (chrome.runtime.scoreCount > MAX_VIDEO_THRESHOLD) {
    console.log('Score response limit exceeded, stopping listener.');
    return [];
  }

  const title = request.title;

  const {
    extensionEnabled: isEnabled,
    openaiApiKey: apiKey
  } = await chrome.storage.sync.get(['extensionEnabled', 'openaiApiKey'])

  if (!isEnabled) {
    console.log('>> extension is disabled');
    return [{ title, score: 1 }]
  } else if (!apiKey) {
    console.log('>> no openai api key');
    return [{ title, score: 1 }]
  }

  const batch = buffer.append(title);
  if (batch) {
    return await scoreVideos(apiKey, batch)
  } else {
    return []
  }
}

let count = 0;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    count = 0;
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getScoreVideo') {
    if (count < 30) {
      (async () => {
        const scores = await getScoreVideo(msg)
        count += scores.length;
        sendResponse({
          action: 'onScore',
          scores: scores,
        });
      })()
    } else {
      console.log('count is over 30 - not scoring any more videos')
      sendResponse({
        action: 'onStopLoading'
      });
    }
    return true
  }
})
