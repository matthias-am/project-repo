const WorkspaceMember = require('../models/Workspace');
const SimulationConfig = require('../models/SimulationConfig');
const SimulationRun = require('../models/SimRun');

//Role hierarchy
const roleLevels = {
    viewer: 1,
    editor: 2,
    owner: 3,
};

const requireWorkspaceAccess = (minRole = 'viewer') => async (req, res, next) => {
    try {
        const userId = req.user.id;
        let workspaceId = req.body.workspaceId || req.query.workspaceId || req.params.workspaceId;
    
        if (!workspaceId) {
            if (req.params.configId) {
                const config = await SimulationConfig. findOne({ config_id: req.params.confidId});
                if (config) workspaceId =config.workspace_id;
            } else if (req.params.runId || req.params.id) {
                const run = await SimulationRun.findOne ({ run_id: req.params.runId || req.params.id });
                if (run && run.workspace_id) workspaceId = run.workspace_id;
            }
        }

        if (!workspaceId) {
            return res.status(400).json({message: 'workspaceId is required'});
        }

        const membership = await WorkspaceMember.findOne ({
            workspace_id: workspaceId,
            user_id: userId
        });

        if (!membership) {
            return res.status(403).json({message: 'You are not a member of this workspace'});
        }
        if (roleLevels[membership.role] < roleLevels[minRole]) {
            return res.status(403).json ({
                message: `Insufficient permissions. Minimum requiredL ${minRole}`
            });
        }

        req.workspaceId = workspaceId;
        req.userRoleInWorkspace = membership.role;

        next();
    } catch (err){
        console.error('Workspace permission error: ', err);
        res.status(500).json({ message: 'Server error during permission check'});
    }
};

module.exports = requireWorkspaceAccess;