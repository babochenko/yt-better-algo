import { scoreVideos } from './api.js';

const MAX_VIDEO_THRESHOLD = 10;
const GPT_BUFFER_SIZE = 20;

class Buffer {
  constructor(size) {
    this.size = size;
    this.buffer = [];
    this.promises = [];
  }

  append(element) {
    this.buffer.push(element);

    if (this.buffer.length == this.size) {
      const buf = [...this.buffer];
      console.log(`>>> ${buf}`)
      this.clear()
      return buf;
    }
  }

  clear() {
    this.buffer = []
  }
}

let countDisplayed = 0;
let countRemoved = 0;
const buffer = new Buffer(GPT_BUFFER_SIZE);

const doScoreVideo = async (request) => {
  if (chrome.runtime.scoreCount > MAX_VIDEO_THRESHOLD) {
    console.log('Score response limit exceeded, stopping listener.');
    return [];
  }

  const title = request.title;

  const {
    extensionEnabled: isEnabled,
    openaiApiKey: apiKey,
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

const onScoreVideo = async (msg, sendResponse) => {
  if (countDisplayed >= 20 || countRemoved >= 50) {
    console.log('hit a threshold on scored video count - not scoring any more videos')
    sendResponse({
      action: 'onStopLoading',
    });
    return;
  }

  const scores = await doScoreVideo(msg)
  const shouldDisplay = Object.groupBy(scores, ({score}) => score > 0.5)
  countDisplayed += (shouldDisplay[true] || []).length
  countRemoved += (shouldDisplay[false] || []).length

  sendResponse({
    action: 'onScore',
    scores: scores,
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    countDisplayed = 0;
    countRemoved = 0;
    buffer.clear()
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getScoreVideo') {
    onScoreVideo(msg, sendResponse)
    return true
  }
})
