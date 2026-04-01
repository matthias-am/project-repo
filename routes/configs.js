const express = require('express');
const router = express.Router();
const configController = require('../controllers/SimConfigController');

//Middleware and services
const protect = require('../middleware/auth');
const { valandNormParamsMiddleware } = require('../services/validParams');
const checkWSAccess = require('../middleware/workspacemid');

router.use(protect);


//create new config
router.post('/', (req, res, next) => {
    console.log('=== HIT POST /api/configs ===');
    next();
}, valandNormParamsMiddleware, configController.createConfig);

//router.post('/', configController.createConfig);

//get all configs for user
router.get(
    '/user',
    configController.getMyConfigs
);

//get all the configs used in a workspace
/*router.get(
    '/workspace/:workspaceId',
    checkWSAccess,
    configController.getConfigsByWS
); */

router.patch(
    '/:configId/results',
    configController.saveResults
);

//get config by Id
router.get(
    '/:configId', checkWSAccess, configController.getConfigById
);

//get templates
router.get(
    '/templates',
    configController.getTemplates
);

//executes a sim run from config
router.post(
    '/:configId/run',
    configController.createRunfromConfig
);

// Delete a config
router.delete(
    '/:configId',
    configController.deleteConfig
);

module.exports = router;