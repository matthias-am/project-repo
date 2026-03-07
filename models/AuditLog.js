const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({ //creates a new mongoose schema for audit logs
    logId: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toString(), //generates a new mongoDB objectID and converts to string
        unique: true
    },
    userId: {
        type: String,
        ref: 'User', //ref allows joining with the referenced collection when querying
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