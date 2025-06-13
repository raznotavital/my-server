const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');


const dataPath = path.join(process.cwd(), 'data');
const usersPath = path.join(dataPath, 'users.json');
const videosPath = path.join(dataPath, 'videos.json');
const descriptionsPath = path.join(dataPath, 'description.json');
const videosDirPath = path.join(dataPath, 'videos');

if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
if (!fs.existsSync(videosDirPath)) fs.mkdirSync(videosDirPath, { recursive: true });

function readJsonFile(fp) {
  if (!fs.existsSync(fp)) {
    fs.writeFileSync(fp, '[]', 'utf8');
    return [];
  }
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch (e) { console.error(`Error reading ${fp}:`, e); return []; }
}

function writeJsonFile(fp, data) {
  try { fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error(`Error writing to ${fp}:`, e); throw e; }
}

module.exports = async (req, res) => {
  try {
    const method = req.method;
    const action = req.query.action || req.body?.action;
    console.log(`[API] ${method} for action: ${action}`);

    if (method === 'GET') {
      if (action === 'load-description') {
        const email = req.query.email;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        const descs = readJsonFile(descriptionsPath);
        const found = descs.find(d => d.email === email) || { email, description: '' };
        return res.json(found);
      }
      if (action === 'user-videos') {
        const email = req.query.email;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        const vids = readJsonFile(videosPath);
        const userVids = vids.filter(v => v.owner && v.owner.toLowerCase() === email.toLowerCase());
        return res.json(userVids);
      }
      if (action === 'video-stats') {
        return res.json(readJsonFile(videosPath));
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (method === 'POST') {
      let body = req.body;
      if (!body || typeof body === 'string') {
        try { body = JSON.parse(req.body); }
        catch { /* ignore */ }
      }
      if (!body?.action) return res.status(400).json({ error: 'Action is required' });
      const { email } = body;

      if (body.action === 'save-description') {
        if (!email || body.description === undefined) return res.status(400).json({ error: 'Email and description are required' });
        const descs = readJsonFile(descriptionsPath);
        const idx = descs.findIndex(d => d.email === email);
        if (idx >= 0) descs[idx].description = body.description;
        else descs.push({ email, description: body.description });
        writeJsonFile(descriptionsPath, descs);
        return res.json({ success: true });
      }

      if (body.action === 'save-specialty') {
        if (!email || !body.specialty) return res.status(400).json({ error: 'Email and specialty are required' });
        const users = readJsonFile(usersPath);
        const idx = users.findIndex(u => u.email === email);
        if (idx < 0) return res.status(404).json({ error: 'User not found' });
        users[idx].specialty = body.specialty;
        writeJsonFile(usersPath, users);
        return res.json({ success: true });
      }

      if (body.action === 'update-profile-image') {
        if (!email || !body.profileImage) return res.status(400).json({ error: 'Email and image are required' });
        const users = readJsonFile(usersPath);
        const idx = users.findIndex(u => u.email === email);
        if (idx < 0) return res.status(404).json({ error: 'User not found' });
        users[idx].profileImage = body.profileImage;
        writeJsonFile(usersPath, users);
        return res.json({ success: true });
      }

      if (body.action === 'update-name') {
        if (!email || !body.newName) return res.status(400).json({ error: 'Email and new name are required' });
        const users = readJsonFile(usersPath);
        const idx = users.findIndex(u => u.email === email);
        if (idx < 0) return res.status(404).json({ error: 'User not found' });
        users[idx].name = body.newName;
        writeJsonFile(usersPath, users);
        return res.json({ success: true });
      }

      if (body.action === 'update-video') {
        const { videoId, fields } = body;
        if (!email || !videoId || typeof fields !== 'object') {
          return res.status(400).json({ error: 'Email, videoId and fields are required' });
        }
        const vids = readJsonFile(videosPath);
        const vIdx = vids.findIndex(v => v.id === videoId && v.owner.toLowerCase() === email.toLowerCase());
        if (vIdx < 0) return res.status(404).json({ error: 'Video not found or access denied' });
        const allowed = ['name', 'description', 'views'];
        allowed.forEach(key => {
          if (fields[key] !== undefined) vids[vIdx][key] = fields[key];
        });
        writeJsonFile(videosPath, vids);
        return res.json({ success: true, video: vids[vIdx] });
      }

      if (body.action === 'upload-video' && req.files?.videoFile) {
        const vf = req.files.videoFile;
        const { videoName, videoDescription } = body;
        if (!videoName || !email) return res.status(400).json({ error: 'Video name and email are required' });

        const videoId = uuidv4();
        const ext = path.extname(vf.name);
        const fn = `video_${videoId}${ext}`;
        const dest = path.join(videosDirPath, fn);

        try {
          await vf.mv(dest);
          const vids = readJsonFile(videosPath);
          const newVid = {
            id: videoId,
            name: videoName,
            description: videoDescription || '',
            path: `/api/videos/${fn}`,
            owner: email,
            views: 0,
            uploadedAt: new Date().toISOString(),
          };
          vids.push(newVid);
          writeJsonFile(videosPath, vids);
          return res.json({ success: true, video: newVid });
        } catch (err) {
          console.error('Video upload error:', err);
          return res.status(500).json({ error: 'Failed to save video', details: err.message });
        }
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};
