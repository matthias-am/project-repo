const express = require('express');
const router = express.Router();
const configController = require('../controllers/SimConfigController');

//Middleware and services
const protect = require('../middleware/auth');
const validateConfig = require('../services/validParams');
const checkWSAccess = require('../middleware/workspacePermission');

router.use(protect);


//create new config
router.post('/', validateConfig.valandNormParams, checkWSAccess, configController.createConfig);

//get all configs for user
router.get(
    '/user',
    configController.getMyConfigs
);

//get all the configs used in a workspace
router.get(
    '/workspace/:workspaceId',
    checkWSAccess,
    configController.getConfigsByWS
);
//get config by Id
router.get(
    '/:configId', checkWSAccess,configController.getConfigById
);

//get templates
router.get(
    'templates',
    configController.getTemplates
);

//executes a sim run from config
router.post(
    '/:configId/run',
    checkWSAccess,
    configController.createRunfromConfig
);

module.exports = router;