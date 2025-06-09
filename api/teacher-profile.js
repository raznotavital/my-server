const fs = require('fs');
const path = require('path');

// 1. הדפס את הנתיב הנוכחי בתחילת הקובץ
console.log('[1] Current working directory:', process.cwd());

// הגדר את הנתיבים
const dataPath = path.join(process.cwd(), 'data');
const usersPath = path.join(dataPath, 'users.json');
const videosPath = path.join(dataPath, 'videos.json');
const descriptionsPath = path.join(dataPath, 'description.json');

// 2. הדפס את הנתיבים המלאים
console.log('[2] Users JSON path:', usersPath);
console.log('[2] Videos JSON path:', videosPath);
console.log('[2] Descriptions JSON path:', descriptionsPath);

// 3. בדוק אם הקבצים קיימים
console.log('[3] Users file exists:', fs.existsSync(usersPath));
console.log('[3] Videos file exists:', fs.existsSync(videosPath));
console.log('[3] Descriptions file exists:', fs.existsSync(descriptionsPath));

module.exports = async (req, res) => {
    try {
        // 4. הדפס את פרטי הבקשה
        console.log('[4] Incoming request:', {
            method: req.method,
            query: req.query,
            body: req.body
        });

        // ... קוד ה-API שלך כאן ...

    } catch (error) {
        console.error('[ERROR] Full error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
};
