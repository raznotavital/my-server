// קובץ: api/users.js
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'users.json');

export default async function handler(req, res) {
  try {
    // קריאת הקובץ באופן סינכרוני (אפשר גם עם await אם מעדיפים אסינכרוני)
    const fileData = fs.readFileSync(filePath, 'utf8');
    const allUsers = JSON.parse(fileData);
    
    // סינון רק מורים
    const teachers = allUsers.filter(user => user.role === "teacher");
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(teachers);
  } catch (error) {
    console.error('שגיאה בקריאת הקובץ:', error);
    res.status(500).json({ 
      error: 'נכשל בטעינת המורים',
      details: error.message 
    });
  }
}
