const mongoose = require('mongoose');

const simulationRunSchema = new mongoose.Schema ({
    configId: { type: mongoose.Schema.Types.ObjectId, ref: 'SimulationConfig'},
    executor: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    status: {type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending'},
    results: {type: mongoose.Schema.Types.Mixed, default: {}},
    errorLog: {type: String},
    startedAt: {type: Date},
    completedAt: { type: Date},
    createdAt: {type: Date, default: Date.Now},
    workspaceId: {
        type: String,
        ref: 'Workspace',
        required: true
    },
});

module.exports = mongoose.model('SimRun', simulationRunSchema);