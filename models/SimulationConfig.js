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
        type: mongoose.Schema.Types.Mixed,
        required: true,
        default: {}
    },

    //Adaptive modulation
    is_adaptive: {
        type: Boolean, default: false

    },

    adaptive_settings: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: () => ({
            /*target_ber: 1e-3,
            snr_profile: 'linear',
            min_snr_db: 0,
            max_snr_sb: 30,
            num_points: 100,*/
        })
    },

    target_ber: {
        type: Number, default: 1e-3
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
    },
    results: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
});

simulationConfigSchema.pre('save', async function () {
    this.last_modified = Date.now();
});

module.exports = mongoose.model('SimulationConfig', simulationConfigSchema);