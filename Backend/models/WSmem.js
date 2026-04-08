const mongoose = require('mongoose');
const WSMemberSchema = new mongoose.Schema ({
    workspace_id: {
        type: String,
        required: true,
        ref: 'Workspace'
    },
    user_id: {
        type: String,
        required: true,
        ref: 'User'
    },
    role: {
       type: String,
       enum: ['owner', 'editor', 'viewer'],
       required: true
    },
    joined_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    indexes: [
        {workspace_id: 1, user_id: 1, unique: true} 
    ]
    });

    module.exports = mongoose.model('WorkspaceMember', WSMemberSchema);