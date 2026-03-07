const {exec} = require('child_process');
const util = require('util');
const path = require('path');
const { logAudit } = require('../utils/auditLogger');
const validparams = require('../services/validParams')

const execPromise = util.promisify(exec);
const SimulationRun = require('../models/SimRun');
const Auditlogger = ('../utils/auditLogger');

/*function ValandNormParams(params) {
    if(!params.schemeId) throw new Error('schemeId is required (from config)');

    const scheme = params.schemeId.toLowerCase();
    const valid = ['bpsk', 'qpsk', '16qam', '64qam', '256qam', '1024qam'];
    if (!valid.includes(scheme)) {
        throw new Error(`Invalid scheme: ${params.schemeId}. Allowed: ${valid.join(', ')}`);
    }

    const snr_min = Number(params.snr_min ?? 0);
    const snr_max = Number (params.snr_max ?? 20);
    const snr_step = Number (params.snr_step ?? 2);

    if(isNaN(snr_min) || snr_min < -20 || snr_min > 50) {
        throw new Error('snr_min must be a number between -20 and 50');
    }
    if (isNaN(snr_max) || snr_max < snr_min || snr_max > 60) {
        throw new Error('snr_max must be greater than snr_min and < 60');
    }
    if (isNaN(snr_step) || snr_step <= 0 || snr_step > 10) {
        throw new Error('snr_step must be positive and < 10');
    }

    return {
        schemeId: scheme,
        snr_min,
        snr_max,
        snr_step,
        num_bits: Math.max(10000, Number(params.num_bits ?? 100000)),
    };
} */

let activeProcesses = 0; //number of currently running octave processes
const MAX_CONCURRENT = 8; //max number of concurrent Octave processes allowed

 async function runSimulation(valparams) { //params = {schemeId, snr_min, snr_max, num_bits etc
        if (activeProcesses >= MAX_CONCURRENT) {
            throw new Error ('Server is busy. Please try again in a few seconds.');
        } //checks if number of active process is greater than or equal to max

        activeProcesses++;
        try{
        const scriptPath = path.join(__dirname, '../OctaveScripts/combinedCall.m'); //builds path to Octave script

        let mod_type;
        switch (valparams.schemeId?.toLowerCase()) {
            case 'bpsk': mod_type = 'BPSK'; break;
            case 'qpsk': mod_type = 'QPSK'; break;
            case '16qam': mod_type = '16QAM'; break;
            case '64qam': mod_type = '64QAM'; break;
            case '256qam': mod_type = '256QAM'; break;
            case '1024qam': mod_type = '1024QAM'; break;
            default: throw new Error('Unsupported modulation scheme');
        } //maps lowercase scheme Ids to uppercase Octave-compatible names

        const snr_range = [];
        for (let s = valparams.snr_min; s<= valparams.snr_max; s += valparams.snr_step) {
            snr_range.push(s);
        } //generates array of SNR values by step (min to max)

        const snr_str = `[${snr_range.join(' ')}]`; //formats SNR array as Octave-style vector string

        const cmd = `octave-cli --no-gui -q "${scriptPath}" "${mod_type}" "${snr_str}" ${valparams.num_bits} ${valparams.const_ebn0_db} ${valparams.num_symbols}`; //builds Octave command with all parameters

        console.log('[OctaveService] Executing:', cmd); //logs comand

        const {stdout, stderr} = await execPromise(cmd, {timeout: 180000});

        if (stderr && !stderr.toLowerCase().includes('warning')) {
            console.error('[OctaveService] STDERR:', stderr);
            throw new Error(`Octave execution failed: ${stderr.trim()}`); 
        } //checks for errors (AI assisted function)

        //AI assisted function
        const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean); //parses stdout to find JSON output
        const jsonStartIndex = lines.findIndex(l => l.startsWith('{')); 
        if (jsonStartIndex === -1) {
            console.log('[OctaveService] Full stdout was: \n', stdout); //Here too
            throw new Error('No JSON object found in Octave output');
        } //Logs output if no JSON found

        const jsonText = lines.slice(jsonStartIndex).join('\n'); //extracts JSON portion from output
        let result = JSON.parse(jsonText); //Json to object

        if (result.constellation) {
            const reshape =(flat) => {
                const points = [];
                for (let i = 0; i < flat.length; i += 2) {
                    points.push({real: flat[i], imag: flat[i+1]});
                }
                return points;
            };
            result.constellation.ideal = reshape(result.constellation.ideal || []);
            result.constellation.received = reshape(result.constellation.received || []);
        } //converts to array of real, imag objects

        return result; //returns on success
    } catch (err) { 
        console.error('[OctaveService] Failed: ', err); //logs error
        throw err; 
    } finally {
        activeProcesses--;
    } 

    }

async function runAdaptive(valparams) { //
        if (activeProcesses >= MAX_CONCURRENT) {
            throw new Error('Server is busy. Please try again in a few seconds')
        } //same as first func

        activeProcesses++
        try {
            const thresholds = {
                'BPSK': 0,
                'QPSK': 6,
                '16QAM': 12,
                '64QAM': 18,
                '256QAM': 24,
                '1024QAM': 30,
            }; //SNR thresholds for each scheme
            const schemes = Object.keys(thresholds);  //gets array of scheme names
            scheme.sort((a, b) => thresholds[a] - thresholds[b]); //lowest to highest threshold

            //result protection
            const resultsPerSegment = [];
            let overallBer = 0;
            let totalBits =0;


            const snrRange = [];
            for (let s = valparams.snr_min; s <= valparams.snr_max; s += valparams.snr_step) {
                snrRange.push(s);
            } //
            let currentMod = 'BPSK'; //sets default mod
            for (const snr of snrRange) {
                //finds highest mod that SNR supports

                let selectedMod = schemes[0];
                for (let i = schemes.length - 1; i >= 0; i--){
                    if (snr >= thresholds[schemes[i]])
                    currentMod = schemes[i];
                    break; //highest supported found
                }
            }
            const segmentParams = {
                valparams,
                schemeId: currentMod.toLowerCase(),
                snr_min: snr,
                snr_max: snr,
                snr_step: valparams.snr_step,
            }; //parameters for single SNR point

            const segmentResult = await runSimulation(segmentParams); //calls runsim for that point

            resultsPerSegment.push({
                snr,
                mod: currentMod,
                ber: segmentResult.ber || null,
            }); //stores segment result

            overallBer = totalBits > 0 ? overallBer /totalBits: 0;

            return { //returns results
                type: 'adaptive',
                segments: resultsPerSegment,
                overall_ber: overallBer,
                note: 'Segmented adaptive switching based on SNR thresholds'
            };
        } catch (err) {
            console.error('[OctaveService] Adaptive failed:', err);
            throw err;
        } finally {
            activeProcesses--;
        } //error handling
    }
    
    module.exports = {
        runSimulation,
        runAdaptive,
    };

//complete function, called by controller
    async function processFullSim(runId, userId, workspaceId, rawParams, isAdaptive) {
        try {
            await SimulationRun.findByIdAndUpdate(runId, {status: 'running', startedAt: new Date()}); //updates status to running

            await logAudit(userId, workspaceId, 'run', runId, 'execute', { ...rawParams }); //logs execution

            const normedParams = validparams.valandNormParams(rawParams); //validates and normalizes params

            if (isAdaptive) {
                console.log(`[processFullSim] Running ADAPTIVE simulation for run ${runId}`);
                results = await runAdaptive(normedParams)
            } else {
                console.log(`[processFullSim] Running Fixed modulation simulation for run ${runId}`);
                results = await runSimulation(normedParams);
            }
            

            //const results = runSimulation(normedParams);

            await SimulationRun.findByIdAndUpdate(runId, {
                status: 'completed',
                completedAt: new Date(),
                results
            
            }); //updates run as completed
            await logAudit(userId, workspaceId, 'run', runId, 'complete'); //logs completion
        } catch(err) {
            await SimulationRun.findByIdAndUpdate(runId, {
                status: 'failed',
                completedAt: new Date(),
                error: err.message
            }) //updates run as fauled on error
            await logAudit(userId, workspaceId, 'run', runId, 'fail', {error: err.message}); //logs failure
        }
    }
    
/*class OctaveService{
    constructor(){
        this.activeProcesses = 0
        this.MAX_CONCURRENT = 8;
    }

    

    async runSimpleBer(snr_db){
        if (this.activeProcesses >= this.MAX_CONCURRENT) {
            throw new Error('Server busy - too many simulations running');
        }

        this.activeProcesses++;
        try {
            const cmd = `octave-cli --no-gui -q --eval "snr = ${snr_db}; ber = 0.5 * erfc(sqrt(snr/2)); disp(ber);"`;
            const { stdout, stderr } = await execPromise(cmd, {timeout: 15000});

            if (stderr && !stderr.toLowerCase().includes('warning')) {
                throw new Error(`Octave error: ${stderr.trim()}`); //give credit to AI here
            }

            const ber = parseFloat(stdout.trim());
            return { ber, snr_db, note: 'theoretical single-point'};
        } finally {
            this.activeProcesses--;
        }
    }

    async runSimulation(params) { //params = {schemeId, snr_min, snr_max, num_bits etc
        if (this.activeProcesses >= this.MAX_CONCURRENT) {
            throw new Error ('Server is busy. Please try again in a few seconds.');
        }

        this.activeProcesses++;
        try{
        const scriptPath = path.join(__dirname, '../OctaveScripts/combinedCall.m');

        let mod_type;
        switch (params.schemeId?.toLowerCase()) {
            case 'bpsk': mod_type = 'BPSK'; break;
            case 'qpsk': mod_type = 'QPSK'; break;
            case '16qam': mod_type = '16QAM'; break;
            case '64qam': mod_type = '64QAM'; break;
            case '256qam': mod_type = '256QAM'; break;
            case '1024qam': mod_type = '1024QAM'; break;
            default: throw new Error('Unsupported modulation scheme');
        }

        const snr_range = [];
        for (let s = params.snr_min; s<= params.snr_max; s += params.snr_step) {
            snr_range.push(s);
        }

        const snr_str = `[${snr_range.join(' ')}]`;

        const cmd = `octave-cli --no-gui -q "${scriptPath}" "${mod_type}" "${snr_str}" ${params.num_bits} ${params.const_ebn0_db} ${params.num_symbols}`;

        console.log('[OctaveService] Executing:', cmd);

        const {stdout, stderr} = await execPromise(cmd, {timout: 180000});

        if (stderr && !stderr.toLowerCase().includes('warning')) {
            console.error('[OctaveService] STDERR:', stderr);
            throw new Error(`Octave execution failed: ${stderr.trim()}`); //give credit to AI here
        }

        const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
        const jsonStartIndex = lines.findIndex(l => l.startsWith('{'));
        if (jsonStartIndex === -1) {
            console.log('[OctaveService] Full stdout was: \n', stdout); //Here too
            throw new Error('No JSON object found in Octave output');
        }

        const jsonText = lines.slice(jsonStartIndex).join('\n');
        let result = JSON.parse(jsonText);

        if (result.constellation) {
            const reshape =(flat) => {
                const points = [];
                for (let i = 0; i < flat.length; i += 2) {
                    points.push({real: flat[i], imag: flat[i+1]});
                }
                return points;
            };
            result.constellation.ideal = reshape(result.constellation.ideal || []);
            result.constellation.received = reshape(result.constellation.received || []);
        }

        return result;
    } catch (err) {
        console.error('[OctaveService] Failed: ', err);
        throw err;
    } finally {
        this.activeCount--;
    }

    }
    async runSimpleSimulation (snr_db) {
        const { schemeId, snr_db, symbol_rate = 1000000} = req.body //sample parameters
    
        try {
            
            const octaveCmd = ` octave-cli --no-gui -q --eval "snr = ${snr_db}; ber = 0.5 * erfc(sqrt(snr/2)); disp(ber);"`;
    
            const run = await SimulationRun.create ({
                executor: req.user.id,
                status: 'running',
                startedAt: new Date(),
            });
    
            const { stdout, stderr} = await execPromise(octaveCmd);
    
            if (stderr) throw new Error(stderr);
    
            const ber = parseFloat(stdout.trim());
    
            run.status = 'completed';
            run.results = {ber, snr_db, iterations: 10000}; //fake data
            run.CompletedAt = new Date();
            await run.save();
    
            res.json({success: true, run});
        } catch (err) {
            res.status(500).json ({ message: 'Simulation failed', error: err.message });
        }
    };
  
}*/

module.exports = { runSimulation,
runAdaptive,
processFullSim

};