import { scoreVideos } from './api.js';

const MAX_VIDEO_THRESHOLD = 10;
const GPT_BUFFER_SIZE = 15;

class Buffer {
  constructor(size) {
    this.size = size;
    this.buffer = [];
  }

  append(element) {
    this.buffer.push(element);
    if (this.buffer.length === this.size) {
      return this.getNextBatch()
    }
  }

  getNextBatch() {
    if (this.buffer.length > 0) {
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

const stubScoreVideos = async (_, videos) => {
  console.log('...', JSON.stringify(videos))
  return new Promise(r => setTimeout(r, 1000)).then(_ => 
    videos.map(v => ({title: v, score: Math.random()})))
}

const doScoreVideo = async (request) => {
  if (chrome.runtime.scoreCount > MAX_VIDEO_THRESHOLD) {
    console.log('Score response limit exceeded, stopping listener.');
    return [];
  }

  const {
    extensionEnabled: isEnabled,
    openaiApiKey: apiKey,
  } = await chrome.storage.sync.get(['extensionEnabled', 'openaiApiKey'])

  const title = request.title;
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
    // return await stubScoreVideos(apiKey, batch)
  } else {
    return []
  }
}

const doScoreVideoTimeout = async () => {
  if (chrome.runtime.scoreCount > MAX_VIDEO_THRESHOLD) {
    console.log('Score response limit exceeded, stopping listener.');
    return [];
  }

  const {
    extensionEnabled: isEnabled,
    openaiApiKey: apiKey,
  } = await chrome.storage.sync.get(['extensionEnabled', 'openaiApiKey'])

  if (!isEnabled) {
    console.log('>> extension is disabled');
    return []
  } else if (!apiKey) {
    console.log('>> no openai api key');
    return []
  }

  console.log(JSON.stringify(buffer))
  const batch = buffer.getNextBatch();
  if (batch) {
    return await scoreVideos(apiKey, batch)
    // return await stubScoreVideos(apiKey, batch)
  } else {
    return []
  }
}

const onScores = (scores, sendResponse) => {
  const shouldDisplay = Object.groupBy(scores, ({score}) => score > 0.5)
  countDisplayed += (shouldDisplay[true] || []).length
  countRemoved += (shouldDisplay[false] || []).length

  sendResponse({
    action: 'onScore',
    scores: scores,
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let finalizer = null

const onScoreVideo = async (msg, sendResponse) => {
  if (countDisplayed >= 20 || countRemoved >= 50) {
    console.log('hit a threshold on scored video count - not scoring any more videos')
    sendResponse({
      action: 'onStopLoading',
    });
    return;
  }

  if (!finalizer) {
    console.log(Date())
    finalizer = sleep(2000)
      .then(() => doScoreVideoTimeout())
      .then(s => {
        console.log(Date())
        console.log(JSON.stringify(s))
        onScores(s, sendResponse)
      })
  }

  const scores = await doScoreVideo(msg)
  onScores(scores, sendResponse)
}

// what is this code supposed to do?
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//   if (changeInfo.status === 'complete') {
//     countDisplayed = 0;
//     countRemoved = 0;
//     buffer.clear()
//   }
// });

// awaits from the message from FE
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getScoreVideo') {
    onScoreVideo(msg, sendResponse)
    return true
  }
})
