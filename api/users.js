const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  console.log('Received request for users data');
  
  try {
    const filePath = path.join(process.cwd(), 'data', 'users.json');
    console.log('Looking for users file at:', filePath);
    
    // בדיקה אם הקובץ קיים
    if (!fs.existsSync(filePath)) {
      console.error('Users file not found');
      return res.status(404).json({ error: 'Users file not found' });
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    console.log('Successfully read users file');
    
    const users = JSON.parse(data);
    console.log(`Loaded ${users.length} users`);
    
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(users);
    
  } catch (error) {
    console.error('Error in users API:', error);
    res.status(500).json({ 
      error: 'Failed to load users data',
      details: error.message 
    });
  }
};
