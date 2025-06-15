// api/users.js
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  try {
    // קריאת הקובץ מהתיקייה data
const filePath = path.join(process.cwd(), 'data', 'videos', 'users.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const users = JSON.parse(data);
    
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(users);
  } catch (error) {
    console.error('Error reading users file:', error);
    res.status(500).json({ error: 'Failed to load users data' });
  }
};
