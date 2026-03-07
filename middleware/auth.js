const jwt = require('jsonwebtoken'); //library that creates and verifies JWT 
const user = require('../models/User'); //require  user schema model in folder models

//express middleware signature
module.exports = async (req, res, next) => {

  

  // Get token from request header
  const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
  //clients send JWTs either x-auth-token: (long random) or Authorization: Bearer (long random)

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' }); //deny access if no token
  }

  try { //checks token signature and expirery 
    const decoded = jwt.verify(token, process.env.JWT_ST);
    req.user = await user.findById(decoded.userId).select('-password'); //attaches user doc to the req
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' }); //valid token but deleted user
    }
    next(); //calls next once everything beforehand is good and valid
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' }); //error for any verification error
  }
};