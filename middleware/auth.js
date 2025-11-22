// middleware/auth.js
const jwt = require('jsonwebtoken');

function auth(required = true){
  return (req, res, next) => {
    try {
      const token = req.cookies && req.cookies.token;
      if(!token){
        if(required) return res.status(401).json({ message: 'Unauthorized' });
        req.user = null; return next();
      }
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload; // payload should include phone
      return next();
    } catch(e){
      if(required) return res.status(401).json({ message: 'Invalid token' });
      req.user = null; return next();
    }
  };
}

module.exports = auth;
