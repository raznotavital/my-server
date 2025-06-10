const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// הגדרת נתיבים
const dataPath = path.join(process.cwd(), 'data');
const usersPath = path.join(dataPath, 'users.json');
const videosPath = path.join(dataPath, 'videos.json');
const descriptionsPath = path.join(dataPath, 'description.json');
const videosDirPath = path.join(dataPath, 'videos');

// וידוא שהתיקייה והקבצים קיימים
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}
if (!fs.existsSync(videosDirPath)) {
  fs.mkdirSync(videosDirPath, { recursive: true });
}

// פונקציות עזר לטיפול בקבצי JSON
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf8');
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
    return [];
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error writing to ${filePath}:`, e);
    throw e;
  }
}

module.exports = async (req, res) => {
  try {
    console.log(`[API] Received ${req.method} request for action: ${req.query.action || req.body?.action}`);

    // טיפול בבקשות GET
    if (req.method === 'GET') {
      const action = req.query.action;

      if (action === 'load-description') {
        const email = req.query.email;
        if (!email) {
          return res.status(400).json({ error: 'Email is required' });
        }

        const descriptions = readJsonFile(descriptionsPath);
        const description = descriptions.find(d => d.email === email) || { 
          email, 
          description: '' 
        };
        
        console.log('Returning description for:', email);
        return res.json(description);
      }

      if (action === 'user-videos') {
        const email = req.query.email;
        if (!email) {
          return res.status(400).json({ error: 'Email is required' });
        }

        const videos = readJsonFile(videosPath);
        const userVideos = videos.filter(v => v.owner && v.owner.toLowerCase() === email.toLowerCase());
        return res.json(userVideos);
      }

      if (action === 'video-stats') {
        const videos = readJsonFile(videosPath);
        return res.json(videos);
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    // טיפול בבקשות POST
    if (req.method === 'POST') {
      let body;
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        body = req.body;
      } else {
        try {
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (e) {
          return res.status(400).json({ error: 'Invalid JSON body' });
        }
      }

      const action = body.action;
      if (!action) {
        return res.status(400).json({ error: 'Action is required' });
      }

      if (action === 'save-description') {
        const { email, description } = body;
        if (!email || description === undefined) {
          return res.status(400).json({ error: 'Email and description are required' });
        }

        const descriptions = readJsonFile(descriptionsPath);
        const existingIndex = descriptions.findIndex(d => d.email === email);
        
        if (existingIndex >= 0) {
          descriptions[existingIndex].description = description;
        } else {
          descriptions.push({ email, description });
        }

        writeJsonFile(descriptionsPath, descriptions);
        return res.json({ success: true });
      }

      if (action === 'upload-video') {
        if (!req.files || !req.files.videoFile) {
          return res.status(400).json({ error: 'No video file uploaded' });
        }

        const videoFile = req.files.videoFile;
        const { videoName, videoDescription, email } = body;

        if (!videoName || !email) {
          return res.status(400).json({ error: 'Video name and email are required' });
        }

        // יצירת שם קובץ ייחודי
        const videoId = uuidv4();
        const fileExt = path.extname(videoFile.name);
        const fileName = `video_${videoId}${fileExt}`;
        const uploadPath = path.join(videosDirPath, fileName);

        try {
          // שמירת הקובץ
          await videoFile.mv(uploadPath);
          console.log(`Video saved to: ${uploadPath}`);

          // הוספת הסרטון לרשימה
          const videos = readJsonFile(videosPath);
          const newVideo = {
            id: videoId,
            name: videoName,
            description: videoDescription || '',
            path: `/api/videos/${fileName}`,
            owner: email,
            views: 0,
            uploadedAt: new Date().toISOString()
          };

          videos.push(newVideo);
          writeJsonFile(videosPath, videos);

          return res.json({ 
            success: true,
            video: newVideo
          });
        } catch (err) {
          console.error('Video upload error:', err);
          return res.status(500).json({ 
            error: 'Failed to save video',
            details: err.message 
          });
        }
      }

      // פעולות נוספות...
      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
