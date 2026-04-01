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
}; //returns 500 if error getting workspaces
/*exports.inviteToWorkspace = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { email, role = 'editor' } = req.body;
 
        if (!email) return res.status(400).json({ message: 'Email is required' });
 
        const validRoles = ['editor', 'viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: 'Role must be editor or viewer' });
        }
 
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
 
        if (workspace.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Only the workspace owner can invite members' });
        }
 
        const invitedUser = await User.findOne({ email });
        if (!invitedUser) {
            return res.status(404).json({ message: 'No user found with that email address' });
        }
 
        const existing = await WorkspaceMember.findOne({
            workspace_id: workspaceId,
            user_id:      invitedUser._id.toString()
        });
        if (existing) {
            return res.status(400).json({ message: 'User is already a member of this workspace' });
        }
 
        await WorkspaceMember.create({
            workspace_id: workspaceId,
            user_id:      invitedUser._id.toString(),
            role,
            joined_at:    new Date()
        });
 
        res.status(201).json({
            success: true,
            message: `${invitedUser.username} added as ${role}`,
            member: { username: invitedUser.username, email: invitedUser.email, role }
        });
    } catch (err) {
        console.error('Invite error:', err);
        res.status(500).json({ message: 'Server error during invite', error: err.message });
    }
};

exports.getWorkspaceMembers = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const members = await WorkspaceMember.find({ workspace_id: workspaceId });
        const enriched = await Promise.all(members.map(async m => {
            const user = await User.findById(m.user_id).select('username email');
            return {
                userId:   m.user_id,
                username: user?.username ?? 'Unknown',
                email:    user?.email ?? '',
                role:     m.role,
                joinedAt: m.joined_at
            };
        }));
        res.json({ success: true, members: enriched });
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching members' });
    }
};

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
      } //returns 500 if catches error */
