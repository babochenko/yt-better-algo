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
        chrome.runtime.sendMessage({
          action: "getScoreVideo",
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
