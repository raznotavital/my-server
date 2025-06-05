 const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');

const app = express();
const PORT = 3000;

// יצירת תיקיות אם לא קיימות
const ensureDir = dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};
ensureDir(path.join(__dirname, 'public', 'uploads'));
ensureDir(path.join(__dirname, 'data'));

// וידוא שקובץ ההודעות קיים
const messagesFilePath = path.join(__dirname, 'data', 'messages.json');
if (!fs.existsSync(messagesFilePath)) {
  fs.writeFileSync(messagesFilePath, JSON.stringify([], null, 2));
}

app.use(express.static('public'));
app.use(express.json({ limit: '1GB' })); // ביטול מגבלת גודל
app.use(express.urlencoded({ extended: true, limit: '1GB' }));

// הגדרות העלאת קבצים - שמירה לפי משתמש
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const email = req.body.email ? req.body.email.trim().toLowerCase() : 'unknown';
    const userUploadDir = path.join(__dirname, 'public', 'uploads', email);
    ensureDir(userUploadDir);
    cb(null, userUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Not a video file!'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter
});

// נתיבי קבצים
const usersFilePath = path.join(__dirname, 'api', 'users.json');
const descriptionsFilePath = path.join(__dirname, 'data', 'description.json');
const videosFilePath = path.join(__dirname, 'data', 'videos.json');

// פונקציות עזר
function readJSON(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    return defaultValue;
  }
  
  try {
    const data = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
    return defaultValue;
  }
}
function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: 'utf8', flag: 'w' });
  } catch (e) {
    console.error(`Error saving to ${filePath}:`, e);
    throw e;
  }
}
function readUsers() {
  return readJSON(usersFilePath, []);
}

function saveUsers(users) {
  saveJSON(usersFilePath, users);
}

function readMessages() {
  try {
    const data = fs.readFileSync(messagesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Error reading messages:', e);
    return [];
  }
}

function saveMessages(messages) {
  try {
    fs.writeFileSync(messagesFilePath, JSON.stringify(messages, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving messages:', e);
    return false;
  }
}

function readDescriptions() {
  return readJSON(descriptionsFilePath, {});
}

function saveDescription(email, description) {
  const descriptions = readDescriptions();
  const users = readUsers();
  const lowerEmail = email.toLowerCase();

  descriptions[lowerEmail] = description;
  saveJSON(descriptionsFilePath, descriptions);

  const userIndex = users.findIndex(u => (u.email || '').trim().toLowerCase() === lowerEmail);
  if (userIndex !== -1) {
    users[userIndex].description = description;
    saveUsers(users);
  }
}

function readVideos() {
  return readJSON(videosFilePath, []);
}

function saveVideos(videos) {
  saveJSON(videosFilePath, videos);
}

function addVideoToUser(email, videoData) {
  const users = readUsers();
  const lowerEmail = email.toLowerCase();
  const userIndex = users.findIndex(u => (u.email || '').trim().toLowerCase() === lowerEmail);
  
  if (userIndex !== -1) {
    if (!users[userIndex].videos) {
      users[userIndex].videos = [];
    }
    users[userIndex].videos.push(videoData);
    saveUsers(users);
  }
}

// -------------------- API ROUTES -------------------- //
app.post('/login', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password;
  const users = readUsers();
  const user = users.find(u => (u.email || '').trim().toLowerCase() === email && u.password === password);
  if (!user) return res.status(401).json({ message: "Incorrect email or password" });
  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

app.post('/register', (req, res) => {
  try {
    const { name, email, password, role, specialty, description, profileImage } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const users = readUsers();
    if (users.find(u => (u.email || '').trim().toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ message: "User already exists" });
    }

    const newUser = {
      id: Date.now().toString(),
      name,
      email: email.toLowerCase(),
      password, // חשוב: במציאות יש להצפין את הסיסמה לפני השמירה!
      role,
      profileImage: profileImage || 'https://www.gstatic.com/images/branding/product/1x/avatar_square_blue_512dp.png',
      specialty: role === 'teacher' ? specialty : '',
      description: role === 'teacher' ? description : '',
      videos: [],
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    const { password: _, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
});
app.get('/users', (req, res) => {
  const users = readUsers();
  const safeUsers = users.map(({ password, ...rest }) => rest);
  res.json(safeUsers);
});

// נתיב שליחת הודעה - מעודכן עם שדה התפקיד
app.post('/messages', (req, res) => {
  try {
    const { from, to, message, name } = req.body;
    
    if (!from || !to || !message) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

    const users = readUsers();
    const sender = users.find(u => u.email.toLowerCase() === from.toLowerCase());
    const senderRole = sender ? sender.role : "unknown";

    const messages = readMessages();
    const newMessage = {
      id: Date.now().toString(),
      from: from.trim().toLowerCase(),
      to: to.trim().toLowerCase(),
      name: name || "Unknown",
      message: message.trim(),
      timestamp: new Date().toISOString(),
      fromRole: senderRole
    };
    
    messages.push(newMessage);
    const saved = saveMessages(messages);
    
    if (!saved) {
      throw new Error('Failed to save messages');
    }

    res.json({ 
      success: true,
      message: "Message sent successfully",
      messageId: newMessage.id
    });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to send message",
      error: err.message 
    });
  }
});

// נתיב קבלת הודעות לפי אימייל - מעודכן
app.get('/messages/:email', (req, res) => {
  try {
    const messages = readMessages();
    const users = readUsers();
    const recipientEmail = (req.params.email || '').trim().toLowerCase();

    const filtered = messages
      .filter(msg => (msg.to || '').trim().toLowerCase() === recipientEmail)
      .map(msg => {
        const sender = users.find(u => u.email.toLowerCase() === msg.from.toLowerCase());
        return {
          from: msg.from,
          fromName: msg.name || (sender ? sender.name : "Unknown"),
          fromRole: msg.fromRole || (sender ? sender.role : "unknown"),
          text: msg.message,
          timestamp: msg.timestamp
        };
      });

    res.json(filtered);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

app.post('/save-description', (req, res) => {
  const { email, description } = req.body;
  if (!email || !description) {
    return res.status(400).json({ message: "Missing email or description" });
  }
  try {
    saveDescription(email, description);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save description" });
  }
});

app.post('/update-profile-image', (req, res) => {
  try {
    const { email, profileImage } = req.body;
    
    if (!email || !profileImage) {
      return res.status(400).json({ message: "Missing email or profile image" });
    }

    const users = readUsers();
    const userIndex = users.findIndex(u => (u.email || '').toLowerCase() === email.toLowerCase());
    
    if (userIndex === -1) {
      return res.status(404).json({ message: "User not found" });
    }

    users[userIndex].profileImage = profileImage;
    users[userIndex].updatedAt = new Date().toISOString();
    saveUsers(users);

    res.json({ 
      success: true,
      message: "Profile image updated successfully",
      profileImage: profileImage 
    });
  } catch (err) {
    console.error('Profile image update error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
});
app.get('/description/:email', (req, res) => {
  const email = (req.params.email || '').trim().toLowerCase();
  const descriptions = readDescriptions();
  const description = descriptions[email] || '';
  res.json({ description });
});
app.post('/update-name', (req, res) => {
  try {
    const { email, newName } = req.body;
    
    if (!email || !newName) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing email or new name" 
      });
    }

    const users = readUsers();
    const userIndex = users.findIndex(u => 
      (u.email || '').toLowerCase() === email.toLowerCase()
    );
    
    if (userIndex === -1) {
      return res.status(404).json({ message: "User not found" });
    }

    // עדכון השם
    users[userIndex].name = newName;
    users[userIndex].updatedAt = new Date().toISOString();
    saveUsers(users);

    res.json({ 
      success: true,
      message: "Name updated successfully",
      newName: newName
    });
  } catch (err) {
    console.error('Name update error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post('/upload-video', upload.single('videoFile'), (req, res) => {
  try {
    const { email, videoName, videoDescription } = req.body;
    const file = req.file;

    if (!email || !videoName || !file) {
      if (req.fileValidationError) {
        return res.status(400).json({ message: req.fileValidationError });
      }
      return res.status(400).json({ message: "Missing video data" });
    }

    const lowerEmail = email.trim().toLowerCase();
    const relativePath = path.join('/uploads', lowerEmail, file.filename).replace(/\\/g, '/');

    const newVideo = {
      id: Date.now().toString(),
      owner: lowerEmail,
      name: videoName,
      description: videoDescription || '',
      path: relativePath,
      timestamp: Date.now(),
      views: 0
    };

    // שמירה ברשימת הסרטונים הכללית
    const videos = readVideos();
    videos.push(newVideo);
    saveVideos(videos);

    // הוספת הסרטון למשתמש הספציפי
    addVideoToUser(lowerEmail, newVideo);

    res.json({ 
      success: true, 
      video: newVideo,
      message: "Video uploaded successfully"
    });
  } catch (err) {
    console.error('Error uploading video:', err);
    res.status(500).json({ success: false, message: "Failed to upload video" });
  }
});

app.get('/videos/:email', (req, res) => {
  try {
    const email = (req.params.email || '').trim().toLowerCase();
    const videos = readVideos();
    
    const userVideos = videos.filter(video => 
      video.owner && video.owner.toLowerCase() === email
    );
    
    res.json(userVideos);
  } catch (err) {
    console.error('Error fetching videos:', err);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

app.get('/user-videos/:email', (req, res) => {
  try {
    const email = (req.params.email || '').trim().toLowerCase();
    const users = readUsers();
    const user = users.find(u => (u.email || '').trim().toLowerCase() === email);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(user.videos || []);
  } catch (err) {
    console.error('Error fetching user videos:', err);
    res.status(500).json({ error: "Failed to fetch user videos" });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(413).json({ 
      success: false, 
      message: 'Payload too large' 
    });
  }
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ 
      success: false, 
      message: 'File upload error: ' + err.message 
    });
  }
  
  console.error('Server error:', err);
  res.status(500).json({ message: "Internal server error" });
});

app.get('/all-videos', (req, res) => {
  try {
    const videos = readVideos();
    res.json(videos);
  } catch (err) {
    console.error('Error reading all videos:', err);
    res.status(500).json({ error: "Failed to read videos" });
  }
});

app.get('/api/teacher/:email', (req, res) => {
  const email = (req.params.email || '').trim().toLowerCase();
  const users = readUsers();
  const user = users.find(u => (u.email || '').toLowerCase() === email);

  if (!user) {
    return res.status(404).json({ error: 'Teacher not found' });
  }

  res.json({
    name: user.name,
    email: user.email,
    profileImage: user.profileImage || null,
    description: user.description || '',
    videos: user.videos || []
  });
});

// נתיבים סטטיים נוספים
app.use('/api', express.static(path.join(__dirname, 'api')));
// נתיב ספציפי ל-users.json
app.get('/users.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'data', 'users.json'));
});
// Add this to your existing server.js file

// Like a video
app.post('/like-video', (req, res) => {
  try {
    const { videoId, userId } = req.body;
    
    if (!videoId || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing videoId or userId" 
      });
    }

    const videos = readVideos();
    const videoIndex = videos.findIndex(v => v.id === videoId);
    
    if (videoIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: "Video not found" 
      });
    }

    // Initialize likes array if it doesn't exist
    if (!videos[videoIndex].likes) {
      videos[videoIndex].likes = [];
    }

    // Check if user already liked this video
    const alreadyLiked = videos[videoIndex].likes.includes(userId);
    
    if (alreadyLiked) {
      // Unlike the video
      videos[videoIndex].likes = videos[videoIndex].likes.filter(id => id !== userId);
    } else {
      // Like the video
      videos[videoIndex].likes.push(userId);
    }

    saveVideos(videos);

    res.json({ 
      success: true,
      likesCount: videos[videoIndex].likes.length,
      isLiked: !alreadyLiked
    });
  } catch (err) {
    console.error('Error liking video:', err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to like video",
      error: err.message 
    });
  }
});

// Get video likes count
app.get('/video-likes/:videoId', (req, res) => {
  try {
    const videoId = req.params.videoId;
    const videos = readVideos();
    const video = videos.find(v => v.id === videoId);
    
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: "Video not found" 
      });
    }

    res.json({ 
      success: true,
      likesCount: video.likes ? video.likes.length : 0
    });
  } catch (err) {
    console.error('Error getting video likes:', err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to get video likes",
      error: err.message 
    });
  }
});
// נתיב לעדכון צפיות בסרטון
app.post('/view-video', (req, res) => {
  try {
    const { videoId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing videoId" 
      });
    }

    const videos = readVideos();
    const videoIndex = videos.findIndex(v => v.id === videoId);
    
    if (videoIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: "Video not found" 
      });
    }

    // עדכון מספר הצפיות
    if (!videos[videoIndex].views) {
      videos[videoIndex].views = 0;
    }
    videos[videoIndex].views += 1;

    saveVideos(videos);

    res.json({ 
      success: true,
      views: videos[videoIndex].views
    });
  } catch (err) {
    console.error('Error incrementing video view:', err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to increment view count",
      error: err.message 
    });
  }
});
app.get('/all-videos', (req, res) => {
  try {
    const videos = readVideos();
    res.json(videos);
  } catch (err) {
    console.error('Error reading all videos:', err);
    res.status(500).json({ error: "Failed to read videos" });
  }
});
app.get('/get-video-stats', (req, res) => {
  try {
    const videos = readVideos();
    console.log('All videos:', videos); // נוסיף לוג לבדיקה
    
    // נשנה את הפילטר כדי לוודא שאנחנו מקבלים את כל הסרטונים עם ערך views
    const videosWithStats = videos.map(video => ({
      ...video,
      views: video.views || 0 // נבטיח שלכל סרטון יש ערך views
    }));
    
    console.log('Videos with stats:', videosWithStats); // לוג נוסף לבדיקה
    res.json(videosWithStats);
  } catch (err) {
    console.error('Error getting video stats:', err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to get video statistics",
      error: err.message 
    });
  }
});
app.listen(3000, '0.0.0.0', () => {
  console.log('Server is running on http://0.0.0.0:3000');
});
