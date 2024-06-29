const queryVideo = (title) => {
  const selector = 'ytd-rich-item-renderer'
  const xpath = `//${selector}[contains(., '${title}')]`;

  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue
}

const onScoreVideo = (scores) => {
  scores.forEach(entry => {
    if (entry.score < 0.5) { // You can adjust the threshold
      const video = queryVideo(entry.title)
      video.remove()
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
        onScoreVideo(resp)
      });
    }
  });
});

// Start observing the search results container for changes
const videos = document.querySelector("#contents.style-scope.ytd-rich-grid-renderer");
if (videos) {
  youtubeObserver.observe(videos, { childList: true, subtree: true });
}
