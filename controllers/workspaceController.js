const Workspace = require('../models/Workspace');
const SimulationRun = require('../models/SimRun');

exports.createWorkSpace = async (req, res) => {
    try {
        const {name} = req.body; //destructures name
        const workspace = await Workspace.create ({
            name,
            owner: req.user.id,
        }); //creates new WS in the DB
        res.status(201).json(workspace); //returns 201 when created and workspace object
    } catch (err) {
        res.status(400).json({ message: err.message }); //returns 400 when error creating
    }
    };

    exports.getMyWorkspaces = async (req, res) => { //export function
        try {
            const workspaces = await Workspace.find({owner: req.user.id}); //finds all workspaces where the user is the owner
            res.json(workspaces); //returns workspaces as JSON
        } catch(err) {
            res.status(500).json({message: 'Server error'}); 
        }
    }; //returns 500 if error getting workspaces

    exports.getWorkspaceSimulations = async (req, res) => {
      try {
        const workspaceId = req.workspaceId; //gets from req obj (set by middleware)
    
        const simulations = await SimulationRun.find({ //finds the runs in the simrun model
          workspace_id: workspaceId
        }) //filters by workspaceID
        .sort({ startedAt: -1}) //newest first
        .limit(20) //return 20 at once
        .select('run_id status startedAt completedAt executor results error'); //selects only specific fields to return
    
        await SimulationRun.populate(simulations, {path: 'executor', select: 'username'}); //inserts username from user model in executor field
    
        res.json({
          success: true,
          simulations
        }); //returns success response with array of sim objects
      } catch (err) {
        console.error('Error listing simulations:', err);
        res.status(500).json({message: 'Could not load simulations', error: err.message});
      } //returns 500 if catches error
    };
