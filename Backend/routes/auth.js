const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { register, login } = require('../controllers/authController');
const auth = require('../middleware/auth');


//test route
router.get('/test', (req, res) => {
  res.json({ message: "Auth routes are alive" });
});
// @route   POST /api/auth/register
// @desc    Register user
router.post(
  '/register',
  [
    body('username', 'Username is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  ],
  register
);

// @route   POST /api/auth/login
// @desc    Login user & get token
router.post(
  '/login',
  [
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists(),
  ],
  login
);

// Example protected route (for testing)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await req.user; // set by auth middleware
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;