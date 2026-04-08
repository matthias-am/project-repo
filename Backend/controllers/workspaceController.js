const Workspace = require('../models/Workspace');
const SimulationRun = require('../models/SimRun');
const User = require('../models/User');

exports.createWorkSpace = async (req, res) => {
    try {
        const { name } = req.body; //destructures name
        const workspace = await Workspace.create({
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
        const workspaces = await Workspace.find({ owner: req.user.id }); //finds all workspaces where the user is the owner
        res.json(workspaces); //returns workspaces as JSON
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};