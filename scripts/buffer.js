export class Buffer {
  constructor(size) {
    this.size = size;
    this.buffer = [];
    this.promises = [];
  }

  append(element) {
    this.buffer.push(element);

    if (this.buffer.length == this.size) {
      const buf = [...this.buffer];
      this.buffer = [];
      return buf;
    }
  }
}
