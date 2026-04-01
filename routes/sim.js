const express = require('express');
const router = express.Router();
//const { runSimpleSimulation, runFullAnalysis } = require('../controllers/simController');
const simctlr = require('../controllers/simController');
const protect = require('../middleware/auth');
const requireWorkspaceAccess = require('../middleware/workspacemid')
const SimulationRun = require('../models/SimRun');

//router.post('/run', protect, runSimpleSimulation);
router.post('/fullAnalysis', protect, requireWorkspaceAccess('editor'), simctlr.runFullAnalysis)



router.delete(
  '/:id',
  protect,
  requireWorkspaceAccess('owner'),
  simctlr.deleteSimulation
);

router.get('/:id/status',
  protect, //requireWorkspaceAccess('viewer'), 
  simctlr.getSimulationStatus
);

router.get('/debug-test', (req, res) => {
  res.json({ message: 'Simulation routes are mounted correctly' });
});

module.exports = router;