const mongoose = require('mongoose');

const simulationRunSchema = new mongoose.Schema ({
    configId: { type: mongoose.Schema.Types.ObjectId, ref: 'SimulationConfig'}, //Type is mongoDB objectID
    executor: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    status: {type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending'}, //only allows these 4 options
    results: {type: mongoose.Schema.Types.Mixed, default: {}}, //mixed means can hold any JSON
    adaptive_summary: { type: Map, of: mongoose.Schema.Types.Mixed,
        default: {}
    }, //map type for key-value pairs and values can be any mixed typw
    errorLog: {type: String},
    startedAt: {type: Date},
    completedAt: { type: Date},
    createdAt: {type: Date, default: Date.now},
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true
    },
});

module.exports = mongoose.model('SimRun', simulationRunSchema);