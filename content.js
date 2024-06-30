const queryVideo = (title) => {
  const escaped = title.replace("'", '&quot;')
  const selector = 'ytd-rich-item-renderer'
  const xpath = `//${selector}[contains(., '${escaped}')]`;

  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue
}

const onScoreVideo = (scores) => {
  scores.forEach(entry => {
    if (entry.score < 0.5) { // You can adjust the threshold
      const video = queryVideo(entry.title)
      video.remove()

      const counter = getCounter();
      const count = parseInt(counter.innerText.split(": ")[1], 10)
      counter.textContent = `removed videos: ${count + 1}`
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
    counter.textContent = "removed videos: 0";
    counter.style.paddingLeft = '200px';
    
    getCounterParent().insertBefore(counter, parent.firstChild);
  }
  return counter;
}

const observeVideos = (videos) => {
  const youtubeObserver = new MutationObserver(() => {
    const videos = document.querySelectorAll("ytd-rich-item-renderer.style-scope.ytd-rich-grid-row");
    videos.forEach((video) => {
      const title = video.querySelector("#video-title");
      if (title) {
        chrome.runtime.sendMessage({
          action: "getScoreVideo",
          title: title.innerText,
        }, resp => {
          onScoreVideo(resp)
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
