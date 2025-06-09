const fs = require('fs');
const path = require('path');

// נתיבים לקבצים
const dataPath = path.join(process.cwd(), 'data');
const usersPath = path.join(dataPath, 'users.json');
const videosPath = path.join(dataPath, 'videos.json');
const descPath = path.join(dataPath, 'description.json');

// פונקציות קריאה עם טיפול בשגיאות
function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', 'utf8');
      return [];
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
    return [];
  }
}
