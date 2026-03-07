const {exec} = require('child_process');
const util = require('util');
const path = require('path');
const { logAudit } = require('../utils/auditLogger');

const execPromise = util.promisify(exec);
const SimulationRun = ('../models/SimRun');
const Auditlogger = ('../utils/auditLogger');

function ValandNormParams(params) {
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
}

let activeProcesses = 0;
const MAX_CONCURRENT = 8;

 async function runSimulation(valparams) { //params = {schemeId, snr_min, snr_max, num_bits etc
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
        this.activeProcesses--;
    }

    }

    async function processFullSim(runId, userId, workspaceId, rawParams) {
        try {
            await SimulationRun.findByIdAndUpdate(runId, {status: 'running', startedAt: new Date()});

            await logAudit(userId, workspaceId, 'run', runId, 'execute', { ...rawParams });

            const normedParams = ValandNormParams(rawParams);

            const results = runSimulation(normedParams);

            await SimulationRun.findByIdAndUpdate(runId, {
                status: 'completed',
                completedAt: new Date(),
                results
            });
            await logAudit(userId, workspaceId, 'run', runId, 'complete');
        } catch(err) {
            await SimulationRun.findByIdAndUpdate(runId, {
                status: 'failed',
                completedAt: new Date(),
                error: err.message
            })
            await logAudit(userId, workspaceId, 'run', runId, 'fail', {error: err.message});
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

module.exports = new OctaveService();