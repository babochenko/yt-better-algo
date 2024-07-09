const path = require('path');

module.exports = {
  entry: {
    'sw': path.resolve(__dirname, 'service_worker/sw.js'),
    'content': path.resolve(__dirname, 'content_scripts/main.js'),
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
};
