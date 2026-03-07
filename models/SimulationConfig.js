const mongoose = require('mongoose');

const simulationConfigSchema = new mongoose.Schema({
    config_id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toString(),
        unique: true,
        required: true
    },

    workspace_id: {
        type: String,
        ref: 'Workspace',
        required: true,
        index: true
    },

    owner_id: {
        type: String,
        ref: 'User',
        required: true
    },

    scheme_id: {
        type: String,
        ref: 'ModulationScheme',
        required: true
    },

    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },

    description: {
        type: String,
        trim: true,
        maxlength: 500
    },

    parameters: {
        type: mongoose.Schema. Types.Mixed,
        required: true,
        default: {}
    },

    // for saving adaptive experiments
    parent_config_id: {
        type: String,
        ref: 'SimulationConfig',
        default: null
    },

    //for reusable templates
    is_template: {
        type: Boolean,
        default: false
    },

    created_at: {
        type: Date,
        default: Date.now
    },

    last_modified: {
        type: Date,
        default: Date.now
    }
});

simulationConfigSchema.pre('save', function(next) {
    this.last_modified = Date.now();
    next();
});

module.exports = mongoose.model('SimulationConfig', simulationConfigSchema);