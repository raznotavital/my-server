export default async function handler(req, res) {
  try {
    // כאן תשים את הכתובת של השרת המקומי שלך
  import users from './users.json';

export default function handler(req, res) {
  res.status(200).json(users);
}
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}
