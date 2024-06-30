const queryVideo = (title) => {
  const escaped = title.replace("'", '&quot;')
  const selector = 'ytd-rich-item-renderer'
  const xpath = `//${selector}[contains(., '${escaped}')]`;

  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue
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
    console.log(`moved video ${video}`)
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
  const loader = document.querySelector("ytd-continuation-item-renderer")
  if (loader) {
    loader.remove()
  }
  observer.disconnect()
  onCompactRows()
}

const onScoreVideo = (scores) => {
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
      // console.log(`displaying ${entry.title}`)
      video.style.display = 'block';
    } else {
      // console.log(`hiding ${entry.title}`)
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

const observeVideos = (videos) => {
  const youtubeObserver = new MutationObserver(() => {
    const videos = document.querySelectorAll("ytd-rich-item-renderer.style-scope.ytd-rich-grid-row");
    videos.forEach((video) => {
      const isAd = video.querySelector('ytd-display-ad-renderer');
      if (isAd) {
        video.remove();
        return;
      }

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
            console.error(`unsupported message: ${resp}`)
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

waitForVideos().then(observeVideos)
