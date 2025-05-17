const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Token ungültig oder abgelaufen' });
      }
      req.user = {
        id: user.userId,
        email: user.email
      };
      next();
    });
  } catch (err) {
    console.error('Authentifizierungsfehler:', err);
    res.status(500).json({ error: 'Interner Serverfehler bei der Authentifizierung' });
  }
};

module.exports = { authenticateToken }; 