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

// Observe changes on the search results page to filter the videos
const youtubeObserver = new MutationObserver(() => {
  const videos = document.querySelectorAll("ytd-rich-item-renderer.style-scope.ytd-rich-grid-row");
  videos.forEach((video) => {
    const title = video.querySelector("#video-title");
    if (title) {
      chrome.runtime.sendMessage({
        action: "getScoreVideo",
        title: title.innerText,
      }, resp => {
        if (resp === undefined) {
          console.error('resp is undefined')
        } else {
          onScoreVideo(resp)
        }
      });
    }
  });
});

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

// Start observing the search results container for changes
const videos = document.querySelector("#contents.style-scope.ytd-rich-grid-renderer");
if (videos) {
  getCounter();
  youtubeObserver.observe(videos, { childList: true, subtree: true });
}
