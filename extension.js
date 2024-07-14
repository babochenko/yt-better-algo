function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
      this.buffer = []
      return buf;
    }
  }
}

class Q {

  videosContainer = () => {
    return document.querySelector("#contents.style-scope.ytd-rich-grid-renderer");
  }

  allVideos = () => {
    return document.querySelectorAll("ytd-rich-item-renderer.style-scope.ytd-rich-grid-row");
  }

  video = (title) => {
    for (const v of this.allVideos()) {
      const t = v.querySelector("#video-title")
      if (t.innerText === title) {
        return v;
      }
    }
  }

  counter = () => {
    const counterId = "fairsearch-removed-videos-counter";
    var counter = document.querySelector(`#${counterId}`);
    if (!counter) {
      counter = document.createElement("div");
      counter.id = counterId;
      counter.textContent = "videos displayed: 0, removed: 0";
      counter.style.paddingLeft = '200px';
      counter.style.background = 'white';
      
      const ytHeader = document.querySelector("ytd-masthead")
      ytHeader.insertBefore(counter, ytHeader.firstChild);
    }
    return counter;
  }
}

class GPT4 {
  genScores = async (apiKey, videos) => {
    const systemQuery = "You are a helpful assistant.";
    const userQuery = `I have a list of videos:

    ${"- " + videos.join("\n- ")}

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

    const url = "https://api.openai.com/v1/chat/completions";
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    const resp = await fetch(url, {method: "POST", headers, body}).then(r => r.json())
    const scoresStr = resp?.choices?.[0]?.message?.content
    if (!scoresStr) {
      console.error(JSON.stringify(resp));
      return [];
    }
    return this.parseScores(videos, scoresStr);
  }

  parseScores = (videos, resp) => {
    const scores = resp.split(",").map(Number);
    const pairs = [];
  
    for (let i = 0; i < videos.length; i++) {
      pairs.push({title: videos[i], score: scores[i]});
    }
  
    return pairs;
  }

  stubGenScores = async (_, videos) => {
    return sleep(1000)
      .then(_ => videos.map(v => ({title: v, score: Math.random()})))
  }
}

const MAX_VIDEO_THRESHOLD = 10;
const buffer = new Buffer(15);
const gpt4 = new GPT4();
const q = new Q();

let countDisplayed = 0;
let countRemoved = 0;
let bufferTrailingLoader = null

const meterScores = (scores) => {
  const shouldDisplay = Object.groupBy(scores, ({score}) => score > 0.5)
  countDisplayed += (shouldDisplay[true] || []).length
  countRemoved += (shouldDisplay[false] || []).length
  return scores
}

const onStopLoadingVideos = (observer) => {
  const stopLoader = () => filterRemoved(document)

  stopLoader();
  new MutationObserver(stopLoader).observe(q.allVideos(), { childList: true, subtree: true });

  observer.disconnect()
}

const displayVideos = (scores) => {
  console.log('scores', JSON.stringify(scores))
  const counter = q.counter();

  scores.forEach(entry => {
    const shouldDisplay = entry.score > 0.5;

    const parts = counter.innerText.split(', ');
    let displayed = parseInt(parts[0].split(": ")[1], 10)
    let removed = parseInt(parts[1].split(": ")[1], 10)
    if (shouldDisplay) {
      displayed++;
    } else {
      removed++;
    }
    counter.textContent = `videos displayed: ${displayed}, removed: ${removed}`

    const video = q.video(entry.title)
    if (shouldDisplay) {
      console.log('[on_display]', entry.title)
      video.style.opacity = 1;
      video.style.pointerEvents = 'all';
    } else {
      console.log('[on_hide]', entry.title)
      video.remove()
    }
  })
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
        console.log('[filter_rm]', title.innerText)
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
    console.log('[filter_seen]', title)
    return true;
  }
  console.log('[vid]', title)
  video.setAttribute(attr, 'true');
  return false;
}

const filterApiKey = async () => {
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
    return null
  } else if (!apiKey) {
    console.log('>> no openai api key');
    return null
  } else {
    return apiKey
  }
}

const doScoreVideo = async (apiKey, getNextBatch) => {
  const batch = getNextBatch()
  if (batch) {
    return await gpt4.genScores(apiKey, batch)
  } else {
    return []
  }
}

const onNextVideo = (video, apiKey) => {
  video.style.opacity = 0;
  video.style.pointerEvents = 'none';

  const titleEl = video.querySelector("#video-title");
  if (!titleEl) {
    return
  } else if (countDisplayed >= 20 || countRemoved >= 50) {
    console.log('hit a threshold on scored video count - not scoring any more videos')
    onStopLoadingVideos(youtubeObserver)
    return
  }

  const title = titleEl.innerText
  if (!bufferTrailingLoader) {
    bufferTrailingLoader = sleep(2000)
      .then(() => doScoreVideo(apiKey, () => buffer.getNextBatch()))
      .then(meterScores)
      .then(displayVideos)
  }

  doScoreVideo(apiKey, () => buffer.append(title))
    .then(meterScores)
    .then(displayVideos)
}

const observeVideos = (videos) => {
  filterApiKey().then(apiKey => {
    if (apiKey) {
      const youtubeObserver = new MutationObserver(() => {
        // pre-remove unwanted elements - e.g. ads
        filterRemoved(document);

        q.allVideos().forEach((video) => {
          if (!(filterRemoved(video) || filterSeen(video))) {
            onNextVideo(video, apiKey)
          }
        });
      });
    
      q.counter();
      youtubeObserver.observe(videos, { childList: true, subtree: true });
    }
  })
}

const waitForVideos = () => new Promise(resolve => {
  const videos = q.videosContainer()
  if (videos) {
    resolve(videos);
  }

  const bodyObserver = new MutationObserver(() => {
    const videos = q.videosContainer()
    if (videos) {
      bodyObserver.disconnect();
      resolve(videos);
    }
  })

  bodyObserver.observe(document.body, { childList: true, subtree: true });
});

const displayPredefinedSearches = () => {
  const searches = [
    '--- select',
    'Machine learning',
    'Minecraft',
  ]

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
