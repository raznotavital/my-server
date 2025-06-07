const fs = require('fs');
const path = require('path');

const videosPath = path.join(process.cwd(), 'data', 'videos.json');

function getVideos() {
  try {
    const data = fs.readFileSync(videosPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveVideos(videos) {
  fs.writeFileSync(videosPath, JSON.stringify(videos, null, 2));
}

module.exports = {
  getVideos,
  saveVideos
};
