function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Buffer {
  constructor(size) {
    this.size = size;
    this.buffer = [];
  }

  append(element) {
    this.buffer.push(element);
    if (this.buffer.length === this.size) {
      return this.getNextBatch();
    }
  }

  getNextBatch() {
    if (this.buffer.length > 0) {
      const buf = [...this.buffer];
      this.buffer = [];
      return buf;
    }
  }
}

class Q {
  videosContainer = () => {
    return document.querySelector(
      "#contents.style-scope.ytd-rich-grid-renderer"
    );
  };

  allVideos = () => {
    return document.querySelectorAll(
      "ytd-browse:not(:has(#page-header-container)) ytd-rich-item-renderer.style-scope.ytd-rich-grid-row"
    );
  };

  video = (title) => {
    if (!title) {
      return;
    }
    for (const v of this.allVideos()) {
      const t = v.querySelector("#video-title");
      if (t?.innerText === title) {
        return v;
      }
    }
  };

  addVideoStats = (data) => {
    if (!data.score === undefined || !data.title === undefined) {
      console.error('unsupported video stat:', JSON.stringify(data))
      return
    }

    const id = "fairsearch-removed-videos-stats";
    var stats = document.querySelector(`#${id}`);

    // Check if the table exists, if not, create it
    let table = stats.querySelector('table');
    if (!table) {
        stats.innerText = '';
        table = document.createElement('table');
        const header = table.createTHead();
        const headerRow = header.insertRow(0);
        const scoreHeader = headerRow.insertCell(0);
        const titleHeader = headerRow.insertCell(1);
        scoreHeader.innerText = 'Score';
        titleHeader.innerText = 'Title';
        stats.appendChild(table);
    }

    // Create a new row in the table
    const row = table.insertRow();
    const scoreCell = row.insertCell(0);
    const titleCell = row.insertCell(1);

    // Set the cell values
    scoreCell.innerText = data.score;
    titleCell.innerText = data.title;

    // Calculate the row color based on the score
    const red = Math.min(255, Math.max(0, Math.round((1 - data.score) * 255)));
    const green = Math.min(255, Math.max(0, Math.round(data.score * 255)));
    row.style.backgroundColor = `rgb(${red}, ${green}, 0)`;
  }

  videoStats = (parent) => {
    const id = "fairsearch-removed-videos-stats";
    var stats = document.querySelector(`#${id}`);
    if (!stats) {
      const container = document.createElement("div");
      container.id = "fairsearch-removed-videos-container";
      container.style.display = "inline-block";

      const button = document.createElement("button");
      button.textContent = "Video Stats";

      stats = document.createElement("div");
      stats.id = id;
      stats.innerText = "<Stats will be here>";
      stats.style.background = "white";
      stats.style.display = "none";

      button.addEventListener("click", (e) => {
        if (stats.style.display === "none") {
          const rect = button.getBoundingClientRect();
          stats.style.top = `${rect.bottom}px`;
          stats.style.left = `${rect.left}px`;
          stats.style.display = "block";
          stats.style.position = "absolute";
          stats.style.padding = "10px";
          stats.style.zIndex = "999";
        } else {
          stats.style.display = "none";
        }
        e.stopPropagation();
      });

      document.addEventListener("click", (event) => {
        if (!stats.contains(event.target)) {
          stats.style.display = "none";
        }
      });

      container.appendChild(button);
      container.appendChild(stats);

      parent.insertAdjacentElement("afterend", container);
    }
    return stats;
  };

  counter = () => {
    const counterId = "fairsearch-removed-videos-counter";
    var counter = document.querySelector(`#${counterId}`);
    if (!counter) {
      const container = document.createElement("div");
      container.id = "fairsearch-main-container";
      container.style.display = "block";
      container.style.background = "white";
      container.style.borderBottom = "thin solid lightgrey";
      container.style.padding = "4px 0 4px 100px";

      counter = document.createElement("div");
      counter.id = counterId;
      counter.textContent = "videos displayed: 0, removed: 0";
      counter.style.display = "inline-block";
      counter.style.marginRight = "50px";
      counter.style.background = "white";

      container.appendChild(counter);

      const ytHeader = document.querySelector("ytd-masthead");
      ytHeader.insertBefore(container, ytHeader.firstChild);
    }
    this.videoStats(counter);
    return counter;
  };
}

const models = {
  llama70b: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama3-70b-8192",
    apiKey: "...",
    customQuery: "...",
  },
  gpt4o: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o",
    apiKey: "...",
    customQuery: "...",
  },
};

const baseQueryString =
  `I have a list of videos:

{videos}

For each video, provide a score between 0 and 1, where 0 means that this video is` +
  ` not helpful and distracting, and 1 means that this video is useful for my personal` +
  ` growth. Respond with just the list of numbers, comma-separated, without spaces, ` +
  ` prefixes, or any other delimiters`;

class API {
  genScores = async (model, videos) => {
    const systemQuery = "You are a helpful assistant.";

    const titles = "- " + videos.join("\n- ");
    const userQuery = model.customQuery.replace("{videos}", titles);

    const body = JSON.stringify({
      model: model.model,
      messages: [
        { role: "system", content: systemQuery },
        { role: "user", content: userQuery },
      ],
    });

    const url = model.url;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${model.apiKey}`,
    };

    console.log("calling model", model.model);
    const resp = await fetch(url, { method: "POST", headers, body }).then((r) =>
      r.json()
    );
    const scoresStr = resp?.choices?.[0]?.message?.content;
    if (!scoresStr) {
      console.error(JSON.stringify(resp));
      return [];
    }
    return this.parseScores(videos, scoresStr);
  };

  parseScores = (videos, resp) => {
    const scores = resp.split(",").map(Number);
    const pairs = [];

    for (let i = 0; i < videos.length; i++) {
      pairs.push({ title: videos[i], score: scores[i] });
    }

    return pairs;
  };

  stubGenScores = async (_, videos) => {
    return sleep(1000).then((_) =>
      videos.map((v) => ({ title: v, score: Math.random() }))
    );
  };
}

const MAX_VIDEO_THRESHOLD = 10;
const buffer = new Buffer(10);
const api = new API();
const q = new Q();

let countDisplayed = 0;
let countRemoved = 0;
let bufferTrailingLoader = null;

const meterScores = (scores) => {
  const shouldDisplay = Object.groupBy(scores, ({ score }) => score > 0.5);
  countDisplayed += (shouldDisplay[true] || []).length;
  countRemoved += (shouldDisplay[false] || []).length;

  for (let score of scores) { 
    q.addVideoStats(score)
  }

  return scores;
};

const onStopLoadingVideos = (observer) => {
  const stopLoader = () => filterRemoved(document);

  stopLoader();
  new MutationObserver(stopLoader).observe(q.allVideos(), {
    childList: true,
    subtree: true,
  });

  observer.disconnect();
};

const displayVideo = (video) => {
  video.style.opacity = 1;
  video.style.pointerEvents = "all";
};

const displayVideos = (scores) => {
  console.log("scores", JSON.stringify(scores));
  const counter = q.counter();

  scores.forEach((entry) => {
    const shouldDisplay = entry.score > 0.5;

    const parts = counter.innerText.split(", ");
    let displayed = parseInt(parts[0].split(": ")[1], 10);
    let removed = parseInt(parts[1].split(": ")[1], 10);
    if (shouldDisplay) {
      displayed++;
    } else {
      removed++;
    }
    counter.textContent = `videos displayed: ${displayed}, removed: ${removed}`;

    const video = q.video(entry.title);
    if (video && shouldDisplay) {
      console.log("[on_display]", entry.title);
      displayVideo(video);
    } else {
      console.log("[on_hide]", entry.title);
      video.remove();
    }
  });
};

const selectorsToRemove = {
  breakingNews: "ytd-rich-shelf-renderer",
  adVideo: "ytd-display-ad-renderer",
  continuation: "ytd-continuation-item-renderer",
};

const filterRemoved = (video) => {
  for (const [_, sel] of Object.entries(selectorsToRemove)) {
    const toRemove = video.querySelector(sel);
    if (toRemove) {
      const title = toRemove.querySelector("#video-title");
      if (title) {
        console.log("[filter_rm]", title.innerText);
      }

      toRemove.remove();
      return true;
    }
  }
  return false;
};

const filterSeen = (video) => {
  const titleEl = video.querySelector("#video-title");
  if (!(titleEl && "innerText" in titleEl)) {
    return false;
  }

  const title = titleEl.innerText;
  const attr = "fsch-seen";
  if (video.getAttribute(attr) === "true") {
    // console.log('[filter_seen]', title)
    return true;
  }
  console.log("[vid]", title);
  video.setAttribute(attr, "true");
  return false;
};

const filterSettings = async () => {
  if (chrome.runtime.scoreCount > MAX_VIDEO_THRESHOLD) {
    console.log("Score response limit exceeded, stopping listener.");
    return [];
  }

  const {
    extensionEnabled: isEnabled,
    keyOpenai,
    keyGroq,
    model,
    customQuery,
  } = await chrome.storage.sync.get([
    "extensionEnabled",
    "keyOpenai",
    "keyGroq",
    "model",
    "customQuery",
  ]);
  if (!model) {
    console.log(">> no model selected");
    return;
  }
  const m = { ...models[model] };

  if (!isEnabled) {
    console.log(">> extension is disabled");
    return null;
  } else if (!m) {
    console.error(">> no model by name", model);
    return null;
  }

  if (model === "gpt4o") {
    m.apiKey = keyOpenai;
  } else if (model === "llama70b") {
    m.apiKey = keyGroq;
  } else {
    console.error(">> no model by name", model);
  }
  m.customQuery = customQuery;

  return m;
};

const doScoreVideo = async (model, getNextBatch) => {
  const batch = getNextBatch();
  if (batch) {
    return await api.genScores(model, batch);
  } else {
    return [];
  }
};

const onNextVideo = (video, model) => {
  const titleEl = video.querySelector("#video-title");
  if (!titleEl) {
    return;
  } else if (countDisplayed >= 20 || countRemoved >= 50) {
    console.log(
      "hit a threshold on scored video count - not scoring any more videos"
    );
    onStopLoadingVideos(youtubeObserver);
    return;
  }

  const title = titleEl.innerText;
  if (!bufferTrailingLoader) {
    bufferTrailingLoader = sleep(2000)
      .then(() => doScoreVideo(model, () => buffer.getNextBatch()))
      .then(meterScores)
      .then(displayVideos);
  }

  doScoreVideo(model, () => buffer.append(title))
    .then(meterScores)
    .then(displayVideos);
};

const observeVideos = (videos) => {
  filterSettings().then((model) => {
    const youtubeObserver = new MutationObserver(() => {
      // pre-remove unwanted elements - e.g. ads
      filterRemoved(document);

      q.allVideos().forEach((video) => {
        if (!model) {
          displayVideo(video);
          return;
        } else if (!(filterRemoved(video) || filterSeen(video))) {
          onNextVideo(video, model);
        }
      });
    });

    q.counter();
    youtubeObserver.observe(videos, { childList: true, subtree: true });
  });
};

const waitForVideos = () =>
  new Promise((resolve) => {
    const videos = q.videosContainer();
    if (videos) {
      resolve(videos);
    }

    const bodyObserver = new MutationObserver(() => {
      const videos = q.videosContainer();
      if (videos) {
        bodyObserver.disconnect();
        resolve(videos);
      }
    });

    bodyObserver.observe(document.body, { childList: true, subtree: true });
  });

const displayPredefinedSearches = () => {
  const searches = ["--- select", "Machine learning", "Minecraft"];

  const search = document.querySelector("#search-form");
  if (!search) {
    return;
  }

  const dropdown = document.createElement("select");
  dropdown.id = "fsch-dropdown";

  for (var s of searches) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.text = s;
    dropdown.appendChild(opt);
  }

  dropdown.addEventListener("change", () => {
    const query = dropdown.options[dropdown.selectedIndex].text;
    if (query !== "--- select") {
      window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}`;
    }
  });
  search.appendChild(dropdown);
};

displayPredefinedSearches();
waitForVideos().then(observeVideos);
