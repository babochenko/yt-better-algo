// Observe changes on the search results page to filter the videos
const observer = new MutationObserver((mutations) => {
  const videos = document.querySelectorAll("ytd-video-renderer");
  videos.forEach((video) => {
    const titleElement = video.querySelector("#video-title");
    if (titleElement) {
      const titleText = titleElement.innerText;
      chrome.runtime.sendMessage({
        action: "checkVideoEligible",
        title: titleText
      }, (response) => {
        if (response && response.score < 0.5) { // You can adjust the threshold
          video.style.display = "none"; // Hide non-matching videos
        }
      });
    }
  });
});

// Start observing the search results container for changes
const targetNode = document.querySelector("#contents");
if (targetNode) {
  observer.observe(targetNode, { childList: true, subtree: true });
}
