const SimulationConfig = require('../models/SimulationConfig');
const AuditLog = require('../models/AuditLog');

const logAction = async (userId, workspaceId, entityId, action, details = {}) => {
    try {
        await AuditLog.create({
            user_id: userId,
            workspace_id: workspaceId,
            entity_type: 'config',
            entity_id: entityId,
            action,
            details,
            timestamp: new Date()
        });
    } catch (err) {
        console.error('Audit log failed: ', err);
    }
};

exports.createConfig = async (req, res) => {
    try {
        const { name, description, scheme_id, parameters, is_template = false } = req.body;
        const workspaceId = req.workspaceId; 
        const userId = req.user.id;

        if (!name || !scheme_id || !parameters || Object.keys(parameters).length === 0 ) {
            return res.status(400).json({message: 'Name, scheme_id and parameters are required'});
        }

        const config = await SimulationConfig.create({
            workspace_id: workspaceId,
            owner_id: userId,
            name,
            description: description || '',
            scheme_id,
            parameters,
            is_template,
            parent_config_id: null,
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
        console.error('Create config error: ', err);
        res.status(500).json({message: 'Failed to create config', error: err.message});
    }
};

//Get single config by ID
exports.getConfigById = async (req, res) => {
    try {
        const configId = req.params.configId;
        const workspaceId = req.workspaceId;

        const config = await SimulationConfig.findOne({
            config_id: configId,
            workspace_id: workspaceId
        });

        if (!config) {
            return res.status(404).json({message: 'Configuration not found in this workspace'});
        }

        res.json({
            success: true,
            config
        });
    } catch(err) {
        res.status(500).json({message: 'Failed to fetch config', error: err.message});
    }
};

//Edit config
exports.updateConfig = async (req, res) => {
    try {
        const configId = req.params.configId;
        const workspaceId = req.workspaceId;
        const userId = req.user.id;

        const {name, description, parameters, is_template} = req.body;

        const config = await SimulationConfig.findOne({
            config_id: configId,
            workspace_id: workspaceId
        });

        if (!config) {
            return res.status(404).json({message: 'Configration not found'});
        }

        //Only lets owner update (figure out if wanna change to editor)
        if (config.owner_id !== userId) {
            return res.status(403).json({message: 'Only the owner can edit this config'});
        }

        //Apply updates
        if (name) config.name = name;
        if (description !== undefined) config.description = description;
        if (parameters) config.parameters = parameters;
        if (is_template !== undefined) config.is_template = is_template;

        config.last_modified = new Date();
        await config.save();

        //Log the update made
        await logAction(userId, workspaceId, configId, 'update', { changeFields: Object.keys(req.body)});

        res.json({
            success: true,
            message: 'Configuration updated',
            config
        });
    } catch (err) {
        res.status(500).json({message: 'Failed to update config', error: err.message});
    }
};

//Delete a config
exports.deleteConfig = async (req, res) => {
    try {
        const configId = req.params.configId;
        const workspaceId = req.workspaceId;
        const userId = req.user.id;

        const config = await SimulationConfig.findOne ({
            config_id: configId,
            workspace_id: workspaceId
        });

        if (!config) {
            return res.status(404).json({message: 'Configuration not found'});
        }

        if (config.owner_id !== userId) {
            return res.status(403).json({message: 'Only the ownder can delete this config'});
        }

        await SimulationConfig.deleteOne({config_id: configId});

        await logAction(userId, workspaceId, configId, 'delete', {name: config.name});

        res.json({
            success: true,
            message: 'Configuration deleted',
            deletedId: configId
        });
    } catch(err) {
        res.status(500).json({message: 'Failed to delete config', error: err.message});
    }
};