const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    
    // קריאת הקובץ מהתיקייה data
    const filePath = path.join(process.cwd(), 'data', 'users.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const users = JSON.parse(data);
    
    // חיפוש המשתמש
    const user = users.find(u => 
      u.email === email && u.password === password
    );
    
    if (!user) {
      return res.status(401).json({ 
        message: 'שם משתמש או סיסמה לא נכונים' 
      });
    }
    
    // לא נחזיר את הסיסמה בתגובה
    const { password: _, ...userWithoutPassword } = user;
    
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'שגיאה בשרת, נסה שוב מאוחר יותר' 
    });
  }
};
