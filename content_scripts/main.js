const CATCH_ALL = [];

function queryScores(videos) {
  return "- " + videos.join("\n- ");
}

function buildQuery(videos) {
  return `I have a list of videos:
  
  ${queryScores(videos)}
  
  For each video, provide a score between 0 and 1, where 0 means that this video is` +
  ` not helpful and distracting, and 1 means that this video is useful for my personal` +
  ` growth. Respond with just the list of numbers, comma-separated, without spaces, ` +
  ` prefixes, or any other delimiters`;
}

function parseScores(videos, resp) {
  const scores = resp.split(",").map(Number);
  const pairs = [];

  for (let i = 0; i < videos.length; i++) {
    pairs.push({title: videos[i], score: scores[i]});
  }

  return pairs;
}

async function scoreVideos(apiKey, videos) {
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const systemQuery = "You are a helpful assistant.";
  const userQuery = buildQuery(videos);
  console.log(userQuery)

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
    console.error(e);
    return CATCH_ALL;
  }
}


// ----- SW

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

const onScoreVideoSW = async (msg, sendResponse) => {
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
    onScoreVideoSW(msg, sendResponse)
    return true
  }
})

// ----- MAIN

const logSeen = '[filter_seen]'
const logRm = '[filter_rm]'
const logNew = '[vid]'
const logDisplay = '[on_display]'
const logHide = '[on_hide]'

const log = (pfx, text) => {
  console.log(pfx, text)
}

const error = (text) => {
  console.error(text)
}

const queryAllVideos = () => {
  return document.querySelectorAll("ytd-rich-item-renderer.style-scope.ytd-rich-grid-row");
}

const queryVideo = (title) => {
  const videos = queryAllVideos();
  for (const v of videos) {
    const t = v.querySelector("#video-title")
    if (t.innerText === title) {
      return v;
    }
  }
}

const onCompactRows = () => {
  const rows = document.querySelectorAll('ytd-rich-grid-row#contents:has(ytd-rich-item-renderer.style-scope.ytd-rich-grid-row)');
  const videos = document.querySelectorAll("ytd-rich-item-renderer.style-scope.ytd-rich-grid-row");

  let ri = 0
  let vi = 0
  while (ri < rows.length && vi < videos.length) {
    const video = videos[vi]
    video.parentElement.removeChild(video)

    const row = rows[ri]
    row.appendChild(video)
    log(`moved video ${video}`)
    const rowVids = rows[ri].querySelectorAll('ytd-rich-grid-media')

    if (rowVids.length >= 3) {
      ri++
    }

    vi++
  }

  document.querySelectorAll('ytd-rich-grid-row').forEach(row => {
    if (row.querySelectorAll('ytd-rich-item-renderer').length === 0) {
      row.remove()
    }
  })
}

const onStopLoadingVideos = (observer) => {
  const stopLoader = () => filterRemoved(document)

  stopLoader();
  new MutationObserver(stopLoader).observe(queryAllVideos(), { childList: true, subtree: true });

  observer.disconnect()
  onCompactRows()
}

const onScoreVideo = (scores) => {
  log('scores', JSON.stringify(scores))
  scores.forEach(entry => {
    const shouldDisplay = entry.score > 0.5;

    const counter = getCounter();
    const parts = counter.innerText.split(', ');

    let displayed = parseInt(parts[0].split(": ")[1], 10)
    let removed = parseInt(parts[1].split(": ")[1], 10)
    if (shouldDisplay) {
      displayed++;
    } else {
      removed++;
    }
    counter.textContent = `videos displayed: ${displayed}, removed: ${removed}`

    const video = queryVideo(entry.title)
    if (shouldDisplay) {
      log(logDisplay, entry.title)
      video.style.opacity = 1;
      video.style.pointerEvents = 'all';
    } else {
      video.style.opacity = 1;
      log(logHide, entry.title)
      video.remove()
    }
  })
}

const getCounterParent = () => {
  return document.querySelector("ytd-masthead")
}

const getCounter = () => {
  const counterId = "fairsearch-removed-videos-counter";
  var counter = document.querySelector(`#${counterId}`);
  if (!counter) {
    counter = document.createElement("div");
    counter.id = counterId;
    counter.textContent = "videos displayed: 0, removed: 0";
    counter.style.paddingLeft = '200px';
    counter.style.background = 'white';
    
    getCounterParent().insertBefore(counter, parent.firstChild);
  }
  return counter;
}

const selectorsToRemove = {
  breakingNews: 'ytd-rich-shelf-renderer',
  adVideo: 'ytd-display-ad-renderer',
  continuation: 'ytd-continuation-item-renderer',
}

const filterRemoved = (video) => {
  for (const [_, sel] of Object.entries(selectorsToRemove)) {
    const toRemove = video.querySelector(sel);
    if (toRemove) {
      const title = toRemove.querySelector("#video-title")
      if (title) {
        log(logRm, title.innerText)
      }

      toRemove.remove();
      return true;
    }
  }
  return false;
}

const filterSeen = (video) => {
  const titleEl = video.querySelector("#video-title");
  if (!(titleEl && 'innerText' in titleEl)) {
    return false;
  }

  const title = titleEl.innerText;
  const attr = 'fsch-seen';
  if (video.getAttribute(attr) === 'true') {
    log(logSeen, title)
    return true;
  }
  log(logNew, title)
  video.setAttribute(attr, 'true');
  return false;
}

const observeVideos = (videos) => {
  const youtubeObserver = new MutationObserver(() => {
    filterRemoved(document);
    queryAllVideos().forEach((video) => {
      if (filterRemoved(video) || filterSeen(video)) {
        return
      }

      // doesn't work for some reason - if you set it here' the videos get hidden
      // and deleted from dom. Might need another way to leave the placeholders
      video.style.opacity = 0;
      video.style.pointerEvents = 'none';

      const title = video.querySelector("#video-title");
      if (title) {
        onScoreVideoSW({
          title: title.innerText,
        }, resp => {
          if (resp.action === 'onScore') {
            onScoreVideo(resp.scores)
          } else if (resp.action === 'onStopLoading') {
            onStopLoadingVideos(youtubeObserver)
          } else {
            error(`unsupported message: ${resp}`)
          }
        });
      }
    });
  });

  getCounter();
  youtubeObserver.observe(videos, { childList: true, subtree: true });
}

const waitForVideos = () => new Promise(resolve => {
  const videosSelector = "#contents.style-scope.ytd-rich-grid-renderer";
  const videos = document.querySelector(videosSelector);
  if (videos) {
    resolve(videos);
  }

  const bodyObserver = new MutationObserver(() => {
    const videos = document.querySelector(videosSelector);
    if (videos) {
      bodyObserver.disconnect();
      resolve(videos);
    }
  })

  bodyObserver.observe(document.body, { childList: true, subtree: true });
});

const searches = [
  '--- select',
  'Machine learning',
  'Minecraft',
]

const displayPredefinedSearches = () => {
  const search = document.querySelector('#search-form')
  if (!search) {
    return;
  }

  const dropdown = document.createElement('select')
  dropdown.id = 'fsch-dropdown'

  for (var s of searches) {
    const opt = document.createElement('option')
    opt.value = s
    opt.text = s
    dropdown.appendChild(opt)
  }

  dropdown.addEventListener('change', () => {
    const query = dropdown.options[dropdown.selectedIndex].text;
    if (query !== '--- select') {
      window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    }
  })
  search.appendChild(dropdown)
}

displayPredefinedSearches()
waitForVideos().then(observeVideos)
