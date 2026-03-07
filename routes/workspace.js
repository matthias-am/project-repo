const express = require('express');
const router = express.Router();
const { createWorkSpace, getMyWorkspaces} = require('../controllers/workspaceController');
const protect = require('../middleware/auth');
const requireWorkspaceAccess = require('../middleware/workspacePermission');
const simController = require('../controllers/simController');

router.post('/', protect, createWorkSpace)

router.get('/MyWS', protect, getMyWorkspaces);

router.get('/workspace/:workspaceId/simulations', protect, requireWorkspaceAccess('viewer'));

router.post('/simulations/run', protect, requireWorkspaceAccess('editor'), simController.runFullAnalysis);


module.exports = router;