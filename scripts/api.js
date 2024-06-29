const CATCH_ALL = [];

function queryScores(videos) {
  return "- " + videos.join("\n- ");
}

function parseScores(videos, resp) {
  const scores = resp.split(",").map(Number);
  const pairs = [];

  for (let i = 0; i < videos.length; i++) {
    pairs.push([videos[i], scores[i]]);
  }

  return pairs;
}

export async function scoreVideos(apiKey, videos) {
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const systemQuery = "You are a helpful assistant.";
  const userQuery =
    `I have a list of videos:
    
    ${queryScores(videos)}
    
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

  const response = await fetch(endpoint, {
    method: "POST",
    headers: headers,
    body: body,
  });
  const data = await response.json();

  if ("error" in data) {
    console.log("rate limit exceeded");
    return CATCH_ALL;
  }

  try {
    const content = data.choices[0].message.content;
    return parseScores(videos, content);
  } catch (e) {
    console.log(e);
    return CATCH_ALL;
  }
}
