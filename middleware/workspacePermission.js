const WorkspaceMember = require('../models/WSmem');
const SimulationConfig = require('../models/SimulationConfig');
const SimulationRun = require('../models/SimRun');

//Role hierarchy
const roleLevels = {
    viewer: 1, //lowest perms
    editor: 2,
    owner: 3, //highest perms
};

const requireWorkspaceAccess = (minRole = 'viewer') => async (req, res, next) => { //exports a function that defaults min role to viewer
    try {
        const userId = req.user.id;
        let workspaceId = req.body.workspaceId || req.query.workspaceId || req.params.workspaceId; //gets workspaceID from multiple location sin req
    
        if (!workspaceId) { //if no WSid found directly, try to get from other IDs
            if (req.params.configId) { //checks for configif in route params
                const config = await SimulationConfig. findOne({ config_id: req.params.configId}); //finds config by its ID
                if (config) workspaceId =config.workspace_id; //sets worksapceId from config if found
            } else if (req.params.runId || req.params.id) { //checks if runid or id is provided
                const run = await SimulationRun.findOne ({ run_id: req.params.runId || req.params.id }); //finds sim run by id
                if (run && run.workspace_id) workspaceId = run.workspace_id; //sets workspaceId from run if found
            }
        }

        if (!workspaceId) {
            return res.status(400).json({message: 'workspaceId is required'});
        } //if workspaceId still not found, returns 400 

        const membership = await WorkspaceMember.findOne ({
            workspace_id: workspaceId,
            user_id: userId
        }); //queries workspaceMember model collection and filters by the following

        if (!membership) {
            return res.status(403).json({message: 'You are not a member of this workspace'});
        } //checks if user is a member of workspace and returns 403 if they are not
        if (roleLevels[membership.role] < roleLevels[minRole]) { //checks if user role is sufficient
            return res.status(403).json ({
                message: `Insufficient permissions. Minimum requiredL ${minRole}`
            }); //returns 403 is user role not sufficient
        }

        req.workspaceId = workspaceId;
        req.userRoleInWorkspace = membership.role; //attaches workspaceId to req obj 

        next();
    } catch (err){ //catches any error
        console.error('Workspace permission error: ', err); //logs to cinsole
        res.status(500).json({ message: 'Server error during permission check'}); //returns 500 if error
    } 
};

module.exports = requireWorkspaceAccess;