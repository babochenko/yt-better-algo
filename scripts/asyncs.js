import { scoreVideos } from "./scripts/api";

const GPT_BUFFER_SIZE = 10;
export let videoCount = 0;

class Buffer {
  constructor(size) {
    this.size = size;
    this.buffer = [];
    this.promises = [];
  }

  async append(input, transform) {
    return new Promise(async (resolve) => {
      this.buffer.push(input);
      this.promises.push(resolve);

      if (this.buffer.length == this.size) {
        // Apply the transformation function to the buffer
        const buf = [...this.buffer];
        this.buffer = [];

        const proms = [...this.promises];
        this.promises = [];

        const transformedBuffer = await transform(buf);

        // Resolve each promise with the corresponding transformed value
        proms.forEach((resolve, index) => {
          resolve(transformedBuffer[index][1]);
        });
      }
    });
  }
}

const buffer = new Buffer(GPT_BUFFER_SIZE);

export async function scoreVideo(apiKey, title) {
  return await buffer.append(title, async function (buf) {
    const s = await scoreVideos(apiKey, buf);
    videoCount += s.length;
    return s;
  });
}
