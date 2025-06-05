// קובץ: api/users.js
const users = [
  {
    "name": "מתן",
    "email": "raznotavital@gmail.com",
    "password": "123",
    "role": "teacher",
    "profileImage": "https://www.gstatic.com/images/branding/product/1x/avatar_square_blue_512dp.png",
    "specialty": "בישול",
    "description": "ררר",
    "videos": [
      {
        "id": "1748502695906",
        "owner": "raznotavital@gmail.com",
        "name": "טלפון",
        "description": "שלום",
        "path": "/uploads/raznotavital@gmail.com/1748502695887-77019547873__DF01E434-3863-405F-8394-6F55D8607114.MOV",
        "timestamp": 1748502695906,
        "views": 0
      }
    ]
  },
  // ניתן להוסיף כאן עוד מורים לפי אותו פורמט
  {
    "name": "מורה נוסף",
    "email": "teacher2@example.com",
    "role": "teacher",
    "profileImage": "https://www.gravatar.com/avatar?d=identicon",
    "specialty": "מתמטיקה"
  }
];

export default async function handler(req, res) {
  try {
    // מחזירים רק מורים (role: teacher)
    const teachers = users.filter(user => user.role === "teacher");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
}
