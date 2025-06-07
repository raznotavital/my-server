const { getUsers, saveUsers } = require('./users');
const { getVideos, saveVideos } = require('./videos');
const { getDescriptions, saveDescriptions } = require('./descriptions');
const path = require('path');
const fs = require('fs');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      // טעינת תיאור משתמש
      if (req.query.action === 'load-description') {
        const descriptions = getDescriptions();
        const userDesc = descriptions.find(d => d.email === req.query.email) || {};
        return res.status(200).json(userDesc);
      }

      // טעינת סרטונים של משתמש
      if (req.query.action === 'user-videos') {
        const videos = getVideos();
        const userVideos = videos.filter(v => v.owner === req.query.email);
        return res.status(200).json(userVideos);
      }

      // סטטיסטיקות סרטונים
      if (req.query.action === 'video-stats') {
        const videos = getVideos();
        return res.status(200).json(videos);
      }
    }

    if (req.method === 'POST') {
      const body = req.body;

      // עדכון תיאור
      if (body.action === 'save-description') {
        const descriptions = getDescriptions();
        const existingIndex = descriptions.findIndex(d => d.email === body.email);
        
        if (existingIndex >= 0) {
          descriptions[existingIndex].description = body.description;
        } else {
          descriptions.push({
            email: body.email,
            description: body.description
          });
        }

        saveDescriptions(descriptions);
        return res.status(200).json({ success: true });
      }

      // עדכון התמחות
      if (body.action === 'save-specialty') {
        const users = getUsers();
        const userIndex = users.findIndex(u => u.email === body.email);
        
        if (userIndex >= 0) {
          users[userIndex].specialty = body.specialty;
          saveUsers(users);
          return res.status(200).json({ success: true });
        }
        
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // עדכון תמונת פרופיל
      if (body.action === 'update-profile-image') {
        const users = getUsers();
        const userIndex = users.findIndex(u => u.email === body.email);
        
        if (userIndex >= 0) {
          users[userIndex].profileImage = body.profileImage;
          saveUsers(users);
          return res.status(200).json({ success: true });
        }
        
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // עדכון שם
      if (body.action === 'update-name') {
        const users = getUsers();
        const userIndex = users.findIndex(u => u.email === body.email);
        
        if (userIndex >= 0) {
          users[userIndex].name = body.newName;
          saveUsers(users);
          return res.status(200).json({ success: true });
        }
        
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // העלאת סרטון
      if (body.action === 'upload-video') {
        const videos = getVideos();
        const newVideo = {
          id: Date.now().toString(),
          name: body.videoName,
          description: body.videoDescription,
          path: `/uploads/${body.videoFile.filename}`,
          owner: body.email,
          views: 0,
          uploadDate: new Date().toISOString()
        };

        videos.push(newVideo);
        saveVideos(videos);
        return res.status(200).json({ success: true, video: newVideo });
      }
    }

    return res.status(400).json({ success: false, message: 'Invalid request' });
  } catch (error) {
    console.error('Error in teacher profile:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
