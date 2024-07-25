# BetterAlgo

A Chrome extension which filters out YouTube's recommended videos based on their usefulness (by default), or whatever other rule you want, using one of available LLM backends

Install by pulling the repo, then Chrome -> Manage Extensions -> Developer Mode -> Load unpacked

When installed, will filter out videos on the https://youtube.com page. At the top of the page, you'll see stats:

![video statistics with score button](README/preview.png)

Video Scores button reveals scores given to each video by the LLM backend (0 is a skip, 1 is a show, threshold is 0.5):

![video scores](README/preview-scores.png)

In extension settings, you can choose the LLM backend to use:

![extension settings](README/settings.png)

You can edit the LLM query if you want:

![extension settings with query](README/settings-full.png)
