
// Validates and normalizes simulation parameters from a plain object
function valandNormParams(body) {

    //debug log to help see what raw values are coming in
    console.log('awgn_variance:', body.awgn_variance, 'interference_power:', body.interference_power);

    //Extract parameters from the input object.
    const {
        schemeId,
        snr_min = 0,
        snr_max = 20,
        snr_step = 2,
        num_bits = 100000, //default number of bits for Monte Carlo simulation
        const_ebn0_db = 10,
        num_symbols = 3000, //default number of symbols to sim
        snr_profile = 'linear',
        is_adaptive = false,
        awgn_variance = 0,
        interference_power = 0,
    } = body;

    //schemeId required to run
    if (!schemeId) throw new Error('schemeId is required');

    //conv to lowercase
    const schemeLower = schemeId.toLowerCase();

    //all supported mod schemes
    const validSchemes = ['bpsk', 'qpsk', '16qam', '64qam', '256qam', '1024qam'];

    //reject unknown schemes
    if (!validSchemes.includes(schemeLower)) {
        throw new Error(`Unsupported scheme: ${schemeId}. Valid: ${validSchemes.join(', ')}`);
    }

    //snr_min must be a number within reasonable physical limits
    if (typeof snr_min !== 'number' || snr_min < -10 || snr_min > 50) {
        throw new Error('snr_min must be a number between -10 and 50');
    }
    // snr_max must be greater than snr_min and not extremely high
    if (typeof snr_max !== 'number' || snr_max < snr_min || snr_max > 60) {
        throw new Error('snr_max must be greater than snr_min and < 60');
    }
    //step size validation
    if (typeof snr_step !== 'number' || snr_step <= 0 || snr_step > 10) {
        throw new Error('snr_step must be a positive number < 10');
    }

    //what gets passed to buildOctaveParams()
    return {
        schemeId: schemeLower,
        snr_min,
        snr_max,
        snr_step,
        num_bits: Math.max(10000, Number(num_bits)), //ensure num_bits is atleast 10k
        const_ebn0_db: Number(const_ebn0_db), //convert to number incase someone sends string
        num_symbols: Math.max(1000, Number(num_symbols)),
        snr_profile,
        is_adaptive,
        awgn_variance: Number(awgn_variance),
        interference_power: Number(interference_power),
    };

}

// Express middleware wrapper — used in configs.js route
// Pulls params from req.body, validates, attaches normedParams to req
function valandNormParamsMiddleware(req, res, next) {
    console.log('=== validParams middleware ===');
    console.log('req.body:', JSON.stringify(req.body));
    try {
        // For config creation the params are nested under req.body.parameters
        // For direct sim runs they may be at the top level
        const source = req.body.parameters ?? req.body;
        console.log('source:', JSON.stringify(source));
        req.normedParams = valandNormParams(source);
        console.log('validation passed');

        if (!req.workspaceId && req.body.workspaceId) {
            req.workspaceId = req.body.workspaceId;
        }
        console.log('validation passed, about to call next()');
        next();

    } catch (err) {
        console.log('validation error:', err.message);
        return res.status(400).json({ message: err.message });
    }
}

module.exports = {
    valandNormParams,
    valandNormParamsMiddleware  // use this in routes instead of valandNormParams directly
};