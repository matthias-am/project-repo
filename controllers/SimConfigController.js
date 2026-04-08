const SimulationConfig = require('../models/SimulationConfig');
const SimRun = require('../models/SimRun');
const AuditLog = require('../models/AuditLog');
const WSMember = require('../models/WSmem');
const { trusted } = require('mongoose');
const { logAudit } = require('../utils/auditLogger');
const OctaveService = require('../services/OctaveService')

const logAction = async (userId, workspaceId, entityId, action, details = {}) => { //details provided default empty object
    try {
        await AuditLog.create({ // creates new audit log entry
            userId, //mappings
            workspaceId,
            entityType: 'config', //this log is for a config identity
            entityId,
            action,
            details,
            timestamp: new Date()
        });
    } catch (err) {
        console.error('Audit log failed: ', err); //error msg is log fails
    }
};

exports.createConfig = async (req, res) => { //exports as a route handler
    console.log('req.workspaceId:', req.workspaceId);
    console.log('req.body.workspaceId:', req.body.workspaceId);
    try {



        const { name, description, scheme_id, parameters, is_template = false, is_adaptive = false, adaptive_settings = {} } = req.body; //defauls for reg body
        const workspaceId = req.workspaceId;
        const userId = req.user.id;


        if (!name || !scheme_id || !parameters || Object.keys(parameters).length === 0) { //validates the fields required
            return res.status(400).json({ message: 'Name, scheme_id and parameters are required' }); //err messafe is required parameters not found
        }

        const config = await SimulationConfig.create({ //creats new config in database
            workspace_id: workspaceId,
            owner_id: userId,
            name,
            description: description || '',
            scheme_id,
            parameters,
            is_template,
            parent_config_id: null,
            is_adaptive,
            adaptive_settings: is_adaptive ? adaptive_settings : undefined, //only save if enabled
            created_at: new Date(),
            last_modified: new Date()
        });

        //Log creation
        await logAction(userId, workspaceId, config.config_id, 'create', { name });

        res.status(201).json({
            success: true,
            message: 'Configuration created',
            config
        });
    } catch (err) {
        console.error('Create config error: ', err); //error catcher if config failed to create for wtv reason
        res.status(500).json({ message: 'Failed to create config', error: err.message });
    }
};

exports.getMyConfigs = async (req, res) => {
    try {
        //console.log('getMyConfigs userId:', req.user.id);
        //get workspaces the user belongs to
        const memberships = await WSMember.find({ user_id: req.user.id }).select('workspace_id'); //Find all the user's workspace memberships (workspace_id field)
        // console.log('memberships found:', JSON.stringify(memberships));

        const workspaceIds = memberships.map(m => m.workspace_id); //maps to array of workspace IDs
        // console.log('workspaceIds:', workspaceIds);

        if (workspaceIds.length === 0) {
            return res.json([]); //user has no workspace
        }

        const configs = await SimulationConfig.find({
            owner_id: req.user.id

            // workspace_id: { $in: workspaceIds } //all configs where workspace_id is in the user's workspace IDs

        })

            //.populate('scheme_id', 'family display_name') //populates scheme id with 
            // .populate('owner_id', 'username') //pops owner Id reference
            .sort({ created_at: -1 }); //newest first sort

        console.log('configs found:', configs.length);

        res.json(configs); //return configs as JSON
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching my configs' }); //500 error for catching configs
    }
};



exports.getConfigsByWS = async (req, res) => {
    try {
        const { workspaceId } = req.params;  //destructures workspace ID from params
        const membership = await WorkspaceMember.findOne({
            workspace_id: workspaceId,
            user_id: req.user.id
        });

        if (!membership) {
            return res.status(403).json({
                message: 'Access denied to this workspace'
            });
        }

        const configs = await SimulationConfig.find({ workspace_id: workspaceId }) //finds all configs for the specific workspace
            //.populate('scheme_id', 'family_display_name')
            // .populate('owner_id', 'username') //populates references
            .sort({ created_at: -1 }); //newest first sort

        res.json(configs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching workspace configurations' }); //500 error for failed fetching
    }
};

exports.getTemplates = async (req, res) => {
    try {
        const membership = await WSMember.find({ user_id: req.user.id })
            .select('workspace_id'); //finds user's workspace memberships, selects only workspace_id field

        const workspaceIds = membership.map(m => m.workspace_id); //maps to array of workspace IDs

        if (workspaceIds.length === 0) {
            return res.json([]); //return empty array if user has no workspaces
        }
        const templates = await SimulationConfig.find({
            workspace_id: { $in: workspaceIds }, // finds configs in user's workspaces
            is_template: true

        }) //filters for templates only
            //.populate('scheme_id', 'family dsiplay_name')
            .sort({ created_at: -1 }); //newest

        res.json(templates); //returns templates
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching templates' }); //500 error
    }
};
exports.createRunfromConfig = async (req, res) => { //create a run from a config
    try {
        const { configId } = req.params;

        const config = await SimulationConfig.findOne({ config_id: configId }); //finds config by its ID
        console.log('config found:', config?.config_id, 'workspace_id:', config?.workspace_id);

        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' });
        } //404 if config not found when looking for it by ID

        const workspaceId = config.workspace_id;

        const newRun = await SimRun.create({ //create new simrun with the following
            configid: config.config_id,
            executor: req.user.id,
            workspaceId: workspaceId,
            status: 'pending',
            startedAt: null
        });

        await logAudit(req.user.id, workspaceId, 'config', config.config_id, 'execute', {}

        ); //calls auditlogger util

        res.status(201).json({
            message: 'Simulation run created and queued', //returns 201 created
            run: newRun //returns new run
        });

        const rawParams = {
            ...config.parameters.toObject?.() ?? config.parameters,
            schemeId: config.scheme_id
        };
        OctaveService.processFullSim(
            newRun._id,
            req.user.id,
            workspaceId,
            rawParams,
            config.is_adaptive
        ).catch(err => console.error('[createRunfromConfig] background sim error:', err));

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error creating simulation run' });
    } //500 error when creating run
};


//Get single config by ID
exports.getConfigById = async (req, res) => {
    try {
        const configId = req.params.configId;
        const workspaceId = req.workspaceId;

        const config = await SimulationConfig.findOne({ //finds a config
            config_id: configId, //matches the configID
            workspace_id: workspaceId //makes sure config belongs to the workspace
        });

        if (!config) { //checks if config does/doesnt exists
            return res.status(404).json({ message: 'Configuration not found in this workspace' }); //error message code 404 if config isnt found
        }

        res.json({
            success: true,
            config
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch config', error: err.message }); //fetching error
    }
};

//Edit config
// exports.updateConfig = async (req, res) => {
//     try {
//         const configId = req.params.configId;
//         const workspaceId = req.workspaceId;
//         const userId = req.user.id;

//         const { name, description, parameters, is_template } = req.body; //destructures update fields from the req body

//         const config = await SimulationConfig.findOne({
//             config_id: configId,
//             workspace_id: workspaceId
//         }); //finds the config to be update by config id and workspace ID

//         if (!config) {
//             return res.status(404).json({ message: 'Configration not found' }); //error message if config not found
//         }

//         const allowedUpdates = [ //array if allowed update fields
//             'name', 'description', 'parameters', 'is_template',
//             'is_adaptive', 'adaptive_settings'
//         ];

//         const updates = {}; //empty updates object

//         allowedUpdates.forEach(field => { //loops through each allowed field 
//             if (req.body[field] !== undefined) { //checks if field provided in req
//                 updates[field] = req.body[field]; //adds field to empty updates object
//             }
//         });

//         if (Object.keys(updates).length === 0) { //checks if any updates were made
//             return res.status(400).json({ message: 'No valid fields to update' }); //400 if no updates
//         }

//         //clear settings if turning off adaptive
//         if (updates.is_adaptive === false) {
//             updates.adaptive_settings = undefined;
//         }

//         Object.assign(config, updates); //applies updates to config object
//         config.last_modified = new Date();


//         // Only lets owner update (figure out if wanna change to editor)
//         if (config.owner_id !== userId) {
//             return res.status(403).json({ message: 'Only the owner can edit this config' });
//         }

//         //Apply updates
//         if (name) config.name = name;
//         if (description !== undefined) config.description = description;
//         if (parameters) config.parameters = parameters;
//         if (is_template !== undefined) config.is_template = is_template;

//         config.last_modified = new Date();
//         await config.save();

//         //Log the update made
//         await logAction(userId, workspaceId, configId, 'update', { changeFields: Object.keys(req.body) });

//         res.json({ //returns success response
//             success: true,
//             message: 'Configuration updated',
//             config
//         });
//     } catch (err) {
//         res.status(500).json({ message: 'Failed to update config', error: err.message }); //returns 500 error is failed to update
//     }
// };

//Delete a config
exports.deleteConfig = async (req, res) => {
    try {
        const configId = req.params.configId;
        const userId = req.user.id;


        const config = await SimulationConfig.findOne({ //finds the config to delete
            $or: [
                { config_id: configId },
                { _id: configId }
            ]

        });

        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' }); //returns 404 if config not found
        }

        if (config.owner_id.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Only the owner can delete this config' });
        }

        // if (config.owner_id !== userId) { //checks if user is the config owner
        //     return res.status(403).json({ message: 'Only the owner can delete this config' }); //returns 403 is user is not the owner
        // }

        await SimulationConfig.deleteOne({ _id: config._id }); //deletes the config from DB

        await logAction(userId, config.workspace_id, config.config_id, 'delete', { name: config.name }); //logs deletion

        res.json({
            success: true,
            message: 'Configuration deleted',
            deletedId: configId //returns success response
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete config', error: err.message }); //returns 500 is failed to delete
    }
};

exports.saveResults = async (req, res) => {
    try {
        const { configId } = req.params;
        const { results } = req.body;

        if (!results) {
            return res.status(400).json({ message: 'Results payload is required' });
        }

        const config = await SimulationConfig.findOne({
            $or: [
                { config_id: configId },
                { _id: configId }
            ]
        });

        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' });
        }

        config.results = results;
        config.last_modified = new Date();
        await config.save();

        await logAction(req.user.id, config.workspace_id, configId, 'save_results', {});

        res.json({ success: true, message: 'Results saved to config' });
    } catch (err) {
        console.error('Save results error:', err);
        res.status(500).json({ message: 'Failed to save results', error: err.message });
    }
};