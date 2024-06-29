// Observe changes on the search results page to filter the videos
const observer = new MutationObserver((mutations) => {
  const videos = document.querySelectorAll("ytd-rich-item-renderer.style-scope.ytd-rich-grid-row");
  videos.forEach((video) => {
    const title = video.querySelector("#video-title");
    if (title) {
      chrome.runtime.sendMessage({
        action: "checkVideoEligible",
        title: title.innerText
      }, (response) => {
        if (response && response.score < 0.5) { // You can adjust the threshold
          video.style.display = "none"; // Hide non-matching videos
        }
      });
    }
  });
});

// Start observing the search results container for changes
const videos = document.querySelector("#contents.style-scope.ytd-rich-grid-renderer");
if (videos) {
  observer.observe(videos, { childList: true, subtree: true });
}
