const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const execPromise = util.promisify(exec);
const SimulationRun = require('../models/SimRun');

// Validates and normalizes simulation parameters from a plain object
function valandNormParams(body) {
    const {
        schemeId,
        snr_min = 0,
        snr_max = 20,
        snr_step = 2,
        num_bits = 100000,
        const_ebn0_db = 10,
        num_symbols = 3000
    } = body;

    if (!schemeId) throw new Error('schemeId is required');

    const schemeLower = schemeId.toLowerCase();
    const validSchemes = ['bpsk', 'qpsk', '16qam', '64qam', '256qam', '1024qam'];
    if (!validSchemes.includes(schemeLower)) {
        throw new Error(`Unsupported scheme: ${schemeId}. Valid: ${validSchemes.join(', ')}`);
    }

    if (typeof snr_min !== 'number' || snr_min < -10 || snr_min > 50) {
        throw new Error('snr_min must be a number between -10 and 50');
    }
    if (typeof snr_max !== 'number' || snr_max < snr_min || snr_max > 60) {
        throw new Error('snr_max must be greater than snr_min and < 60');
    }
    // FIX: was checking snr_min instead of snr_step
    if (typeof snr_step !== 'number' || snr_step <= 0 || snr_step > 10) {
        throw new Error('snr_step must be a positive number < 10');
    }

    return {
        schemeId: schemeLower,
        snr_min,
        snr_max,
        snr_step,
        num_bits:      Math.max(10000, Number(num_bits)),
        const_ebn0_db: Number(const_ebn0_db),
        num_symbols:   Math.max(1000, Number(num_symbols))
    };
}

// Express middleware wrapper — used in configs.js route
// Pulls params from req.body, validates, attaches normedParams to req
function valandNormParamsMiddleware(req, res, next) {
    try {
        // For config creation the params are nested under req.body.parameters
        // For direct sim runs they may be at the top level
        const source = req.body.parameters ?? req.body;
        req.normedParams = valandNormParams(source);
        next();
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
}

module.exports = {
    valandNormParams,
    valandNormParamsMiddleware  // use this in routes instead of valandNormParams directly
};