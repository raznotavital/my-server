const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });
const teachersHandler = require('./api/teachers');
const cors = require('cors');
const app = express();

// הגדרות קבצים
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const VIDEOS_FILE = path.join(__dirname, 'data', 'videos.json');

// בדיקה אם הקבצים קיימים
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, '[]', 'utf8');
}
if (!fs.existsSync(VIDEOS_FILE)) {
  fs.writeFileSync(VIDEOS_FILE, '[]', 'utf8');
}

// פונקציות עזר לקריאה וכתיבה לקבצי JSON

function readVideos() {
  return readJson(VIDEOS_FILE);
}

function saveVideos(data) {
  writeJson(VIDEOS_FILE, data);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Failed to read ${file}:`, err);
    return [];
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Failed to write ${file}:`, err);
  }
}

// אמצעים
app.use(express.json());
app.use(fileUpload());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/api/videos', express.static(path.join(__dirname, 'data', 'videos'))); // חשוב!
app.use(cors());
// -------------------- API ROUTES -------------------- //

app.get('/api/teachers', (req, res) => {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    const users = JSON.parse(data);
    res.json(users);
  } catch (error) {
    console.error('Error reading users file:', error);
    res.status(500).json({ error: 'Failed to load users data' });
  }
});
app.get('data/users', (req, res) => {
  try {
    const users = fs.existsSync(USERS_FILE)
      ? JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
      : [];
    res.json(users);
  } catch (err) {
    console.error('Failed to read users:', err);
    res.status(500).json({ error: 'Failed to read users' });
  }
});

// הוספת משתמש חדש (POST)
app.post('/api/teachers', (req, res) => {
  try {
    const newUser = req.body;

    // ולידציה בסיסית
    if (!newUser.name || !newUser.email || !newUser.password || !newUser.role) {
      return res.status(400).json({ error: 'Missing required user fields' });
    }

    const data = fs.existsSync(USERS_FILE) ? fs.readFileSync(USERS_FILE, 'utf8') : '[]';
    const users = JSON.parse(data);

    // בדיקה אם כבר קיים מייל כזה
    if (users.some(u => u.email === newUser.email)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // ברירת מחדל לשדות שלא קיימים
    newUser.profileImage = newUser.profileImage || 'https://www.gravatar.com/avatar?d=mp';
    newUser.videos = [];
    newUser.description = newUser.description || '';
    newUser.specialty = newUser.specialty || '';

    users.push(newUser);

    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');

    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    console.error('Error writing users file:', error);
    res.status(500).json({ error: 'Failed to save user' });
  }
});

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

app.get('/api/teachers', teachersHandler);

app.get('/api/users', (req, res) => {
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

console.log('Saving video to:', uploadPath);
console.log('Video file info:', {
  name: videoFile.name,
  size: videoFile.size,
  mimetype: videoFile.mimetype
});

res.json({ 
  success: true, 
  video: newVideo,
  message: "Video uploaded successfully"
});

console.log('Video file info:', {
  name: videoFile.name,
  size: videoFile.size,
  mimetype: videoFile.mimetype
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






  

// צפייה בסרטון
app.post('/view-video', (req, res) => {
  try {
    const { videoId } = req.body;
    if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

    const videos = readVideos();
    const idx = videos.findIndex(v => v.id === videoId);
    if (idx === -1) return res.status(404).json({ error: 'Video not found' });

    videos[idx].views = (videos[idx].views || 0) + 1;
    saveVideos(videos);

    res.json({ success: true, views: videos[idx].views });
  } catch (err) {
    console.error('Error incrementing view:', err);
    res.status(500).json({ error: 'Failed to increment view count' });
  }
});

app.post('/like-video', (req, res) => {
  try {
    const { videoId, userId } = req.body;
    if (!videoId || !userId) {
      return res.status(400).json({ success: false, message: 'Missing data' });
    }

    const videos = readVideos();
    const videoIndex = videos.findIndex(v => v.id === videoId);
    if (videoIndex === -1) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    if (!Array.isArray(videos[videoIndex].likes)) {
      videos[videoIndex].likes = [];
    }

    const alreadyLiked = videos[videoIndex].likes.includes(userId);

    if (alreadyLiked) {
      videos[videoIndex].likes = videos[videoIndex].likes.filter(id => id !== userId);
    } else {
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



// קבלת מספר לייקים
app.get('/video-likes/:videoId', (req, res) => {
  try {
    const videoId = req.params.videoId;
    const videos = readVideos();
    const video = videos.find(v => v.id === videoId);

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found" });
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

// קבלת סטטיסטיקות צפיות ולייקים
app.get('/get-video-stats', (req, res) => {
  try {
    const videos = readVideos();
    const stats = videos.map(video => ({
      ...video,
      views: video.views || 0,
      likesCount: video.likes ? video.likes.length : 0
    }));
    res.json(stats);
  } catch (err) {
    console.error('Error getting video stats:', err);
    res.status(500).json({
      success: false,
      message: "Failed to get video statistics",
      error: err.message
    });
  }
});

// קבלת כל הסרטונים
app.get('/all-videos', (req, res) => {
  try {
    const videos = readVideos();
    res.json(videos);
  } catch (err) {
    console.error('Failed to read videos:', err);
    res.status(500).json({ error: 'Failed to read videos' });
  }
});

// קבלת רשימת המשתמשים
app.get('/users', (req, res) => {
  try {
    const users = fs.existsSync(USERS_FILE)
      ? JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
      : [];
    res.json(users);
  } catch (err) {
    console.error('Failed to read users:', err);
    res.status(500).json({ error: 'Failed to read users' });
  }
});

app.use('/api/teacher-profile', require('./api/teacher-profile'));
app.use('/api/teachers', require('./api/teachers'));



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
