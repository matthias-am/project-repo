const Workspace = require('../models/Workspace');
const SimulationRun = require('../models/SimRun');

exports.createWorkSpace = async (req, res) => {
    try {
        const {name} = req.body;
        const workspace = await Workspace.create ({
            name,
            owner: req.user.id,
        });
        res.status(201).json(workspace);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
    };

    exports.getMyWorkspaces = async (req, res) => {
        try {
            const workspaces = await Workspace.find({owner: req.user.id});
            res.json(workspaces);
        } catch(err) {
            res.status(500).json({message: 'Server error'});
        }
    };

    exports.getWorkspaceSimulations = async (req, res) => {
      try {
        const workspaceId = req.workspaceId;
    
        const simulations = await SimulationRun.find({
          workspace_id: workspaceId
        })
        .sort({ startedAt: -1}) //newest first
        .limit(20) //return 20 at once
        .select('run_id status startedAt completedAt executor results error');
    
        await SimRun.populate(simulations, {path: 'executor', select: 'username'});
    
        res.json({
          success: true,
          simulations
        });
      } catch (err) {
        console.error('Error listing simulations:', err);
        res.status(500).json({message: 'Could not load simulations', error: err.message});
      }
    };
