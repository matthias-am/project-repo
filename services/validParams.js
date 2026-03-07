const {exec} = require('child_process');
const util = require('util');
const path = require('path');

const execPromise = util.promisify(exec);

const SimulationRun = require('../models/SimRun');


//validates and normalizes sim parameters
function valandNormParams(body) {
    const { //extracts params with default values
        schemeId,
        snr_min = 0,
        snr_max = 20,
        snr_step = 2,
        num_bits = 100000,
        const_ebn0_db = 10,
        num_symbols = 3000
    } = body;

    if  (!schemeId) throw new Error('schemeId is required'); //throws error is schemeId missing

    //scheme validation
    const schemeLower = schemeId.toLowerCase(); //converts to lowercase for case-sensitive comparison
    const validSchemes = ['bpsk', 'qpsk', '16qam', '64qam', '256qam','1024qam'];  //checks against list of supported modulation
    if (!validSchemes.includes(schemeLower)){
        throw new Error(`Unsupported scheme: ${schemeId}. Valid: ${validSchemes.join(', ')}`);
    }//error with valid options

    //checks type is number and vals range
    if (typeof snr_min !== 'number' || snr_min < -10 || snr_min > 50) {
        throw new Error('snr_min must be a number between -10 and 50');
    }
    if (typeof snr_max !== 'number' || snr_max < snr_min || snr_max > 60) {
        throw new Error('snr_max must be greater than snr_min and < 60');
    }
    if (typeof snr_step !== 'number' || snr_min <= 0 || snr_step > 10) {
        throw new Error('snr_step must be a positive number <10');
    }
    return { //returning validated object
        schemeId: schemeLower,
        snr_min,
        snr_max,
        snr_step,
        num_bits: Math.max(10000, Number(num_bits)), //min value of 10k
        const_ebn0_db: Number(const_ebn0_db),
        num_symbols: Math.max(1000, Number(num_symbols)) //min valid of 1k
    };
}

module.exports = {valandNormParams};