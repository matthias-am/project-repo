const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    logId: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toString(),
        unique: true
    },
    userId: {
        type: String,
        ref: 'User',
        required: true
    },
    workspaceId: {
        type: String,
        ref: 'Workspace',
        required: true
    },
    configId: {
        type: String,
        ref: 'SimulationConfig'
    },
    entityType: {
        type: String,
        enum: ['config', 'run', 'workspace'],
        required: true
    },
    entityId: { type: String, required: true
    },
    action: {
        type: String,
        enum: ['create', 'update', 'execute', 'failed', 'share', 'delete'],
        required: true
    },
    details: {type: Object, default: {}},
    timestamp: {type: Date, default: Date.now}
});

module.exports = mongoose.model('AuditLog', auditLogSchema);