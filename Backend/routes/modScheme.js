const express = require('express');
const router = express.Router();
const {getAllSchemes, getSchemeById} = require('../controllers/modSchemeController');
const protect = require('../middleware/auth');

router.get('/', protect, getAllSchemes);
router.get('/:id', protect, getSchemeById);

module.exports = router;