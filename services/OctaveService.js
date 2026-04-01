const { exec } = require('child_process'); //used to run external commands (like octave-cli)
const util = require('util');
const path = require('path'); //to handle paths safely
const { logAudit } = require('../utils/auditLogger'); //log user auctions
const { valandNormParams } = require('../services/validParams'); //val and norm the sim params
const execPromise = util.promisify(exec);
const SimulationRun = require('../models/SimRun'); //model for storing sim run records

let activeProcesses = 0; //tracks how many Octave simulations are currently running
const MAX_CONCURRENT = 2; //Max number of simultaneous processes allowed

// Add temporarily at the top of OctaveService.js
console.log('[OctaveService] LOADED - MAX_CONCURRENT:', MAX_CONCURRENT);

// Fixed modulation simulation, Called by processFullSim when is_adaptive = false
// Runs combinedCall.m and returns parsed JSON results
async function runSimulation(valparams) {
    try {
        //path to main octave script
        const scriptPath = path.join(__dirname, '../OctaveScripts/combinedCall.m');

        // Builds the params JSON file path for combinedCall.m, combinedCall.m reads a JSON param file, so we write one to a temp file
        const fs = require('fs');
        const os = require('os');
        const tmpFile = path.join(os.tmpdir(), `sim_params_${Date.now()}.json`);

        // Builds the params object that adaptive_modulation_sim expects
        const octaveParams = buildOctaveParams(valparams);
        fs.writeFileSync(tmpFile, JSON.stringify(octaveParams));

        //Builds the command to run Octave in CLI mode
        const cmd = `octave-cli --no-gui -q "${scriptPath}" "${tmpFile}"`;
        console.log('[OctaveService] Executing:', cmd);

        //execute octave script and wait for it to finish (3 min timeout)
        const { stdout, stderr } = await execPromise(cmd, { timeout: 180000 });

        // Cleans up temp file
        try { fs.unlinkSync(tmpFile); } catch (_) { }

        //trear stderr that it not just a warning as an error
        if (stderr && !stderr.toLowerCase().includes('warning')) {
            console.error('[OctaveService] STDERR:', stderr);
            throw new Error(`Octave execution failed: ${stderr.trim()}`);
        }

        // Finds the JSON line in stdout from octave
        const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
        const jsonStartIndex = lines.findIndex(l => l.startsWith('{'));
        if (jsonStartIndex === -1) {
            console.log('[OctaveService] Full stdout:\n', stdout);
            throw new Error('No JSON object found in Octave output');
        }

        const jsonText = lines.slice(jsonStartIndex).join('\n');
        const result = JSON.parse(jsonText);


        // {real, imag} objects 
        return result; //return sim results

    } catch (err) {
        console.error('[OctaveService] runSimulation failed:', err);
        throw err;
    }
}

// Adaptive modulation simulation 
// Called by processFullSim when is_adaptive = true
// Uses the same Octave script but with is_adaptive = true in the params
async function runAdaptive(valparams) {
    try {
        const fs = require('fs');
        const os = require('os');
        const scriptPath = path.join(__dirname, '../OctaveScripts/combinedCall.m');
        const tmpFile = path.join(os.tmpdir(), `sim_adaptive_${Date.now()}.json`);

        //Build parameters with isAdaptive = true (includes multiple schemes)
        const octaveParams = buildOctaveParams(valparams, true);
        fs.writeFileSync(tmpFile, JSON.stringify(octaveParams));

        const cmd = `octave-cli --no-gui -q "${scriptPath}" "${tmpFile}"`;
        console.log('[OctaveService] Executing adaptive:', cmd);

        //Longer timeout because adaptive sims are heavier (5 mins)
        const { stdout, stderr } = await execPromise(cmd, { timeout: 300000 });

        try { fs.unlinkSync(tmpFile); } catch (_) { }

        if (stderr && !stderr.toLowerCase().includes('warning')) {
            console.error('[OctaveService] Adaptive STDERR:', stderr);
            throw new Error(`Octave adaptive failed: ${stderr.trim()}`);
        }

        const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
        const jsonStartIndex = lines.findIndex(l => l.startsWith('{'));
        if (jsonStartIndex === -1) {
            console.log('[OctaveService] Full stdout:\n', stdout);
            throw new Error('No JSON object found in Octave adaptive output');
        }

        const jsonText = lines.slice(jsonStartIndex).join('\n');
        return JSON.parse(jsonText);

    } catch (err) {
        console.error('[OctaveService] runAdaptive failed:', err);
        throw err;

    }
}

// Builds Octave params object, Maps the normalized JS params to the structure adaptive_modulation_sim.m expects
function buildOctaveParams(valparams, isAdaptive = false) {
    const schemeId = valparams.schemeId?.toLowerCase() ?? 'qpsk';

    // Default scheme thresholds matching the Octave script
    const schemeConfigs = {
        'bpsk': { display_name: 'BPSK', snr_threshold_db: 0, bits_per_symbol: 1 },
        'qpsk': { display_name: 'QPSK', snr_threshold_db: 2, bits_per_symbol: 2 },
        '16qam': { display_name: '16QAM', snr_threshold_db: 6, bits_per_symbol: 4 },
        '64qam': { display_name: '64QAM', snr_threshold_db: 10, bits_per_symbol: 6 },
        '256qam': { display_name: '256QAM', snr_threshold_db: 14, bits_per_symbol: 8 },
        '1024qam': { display_name: '1024QAM', snr_threshold_db: 18, bits_per_symbol: 10 },
    };

    let schemes;
    if (isAdaptive) {
        // For adaptive: includes all schemes up to and including the selected one
        const allSchemes = ['qpsk', '16qam', '64qam', '256qam', '1024qam'];
        const idx = allSchemes.indexOf(schemeId);
        const activeSchemes = allSchemes.slice(0, idx + 1);
        schemes = activeSchemes.map(s => ({
            display_name: schemeConfigs[s].display_name,
            snr_threshold_db: schemeConfigs[s].snr_threshold_db,
            base_parameters: {
                bits_per_symbol: schemeConfigs[s].bits_per_symbol
            }
        }));
    } else {
        // For fixed: single scheme only, threshold = snr_min so it always activates
        const cfg = schemeConfigs[schemeId] ?? schemeConfigs['qpsk'];
        schemes = [{
            display_name: cfg.display_name,
            snr_threshold_db: valparams.snr_min,  // always meets threshold
            base_parameters: { bits_per_symbol: cfg.bits_per_symbol }
        }];
    }

    //Final object passed to Octave script
    return {
        snr_min: valparams.snr_min,
        snr_max: valparams.snr_max,
        num_points: Math.round((valparams.snr_max - valparams.snr_min) / valparams.snr_step) + 1, //formula for num of points
        symbol_rate: 1e6, //1 Msymbols/s (fixed)
        is_adaptive: isAdaptive,
        target_ber: 1e-3,
        snr_profile: valparams.snr_profile ?? 'linear',
        const_ebn0_db: valparams.const_ebn0_db,
        awgn_variance: valparams.awgn_variance ?? 0,
        interference_power: valparams.interference_power ?? 0,
        schemes

    };
}

// Background simulation runner Called by simController after creating the SimRun record
// Runs in the background, updates SimRun status when done
async function processFullSim(runId, userId, workspaceId, rawParams, isAdaptive) {

    activeProcesses++;
    console.log(`[processFullSim] ENTERED run ${runId}. Active: ${activeProcesses}/${MAX_CONCURRENT}`);

    //concurrency  queuing logic
    if (activeProcesses > MAX_CONCURRENT) {
        activeProcesses--;

        while (activeProcesses >= MAX_CONCURRENT) {
            console.log(`[processFullSim] Run ${runId} queued, waiting... active: ${activeProcesses}`);

            //Updata database so user sees "queued" status
            await SimulationRun.findByIdAndUpdate(runId, {
                status: 'queued',
                statusMessage: 'Server is busy - your simulation will start automatically in a few seconds.'
            });
            await new Promise(resolve => setTimeout(resolve, 5000)); //wait 5 secs before checking again
        }
        activeProcesses++;
        console.log(`[processFullSim] Slot claimed for run ${runId}. Active: ${activeProcesses}/${MAX_CONCURRENT}`);
    }



    // Wait 5 seconds then retry

    //return processFullSim(runId, userId, workspaceId, rawParams, isAdaptive);


    // activeProcesses++;



    try {
        //Mark simulation as "running" in the database
        await SimulationRun.findOneAndUpdate(
            { _id: runId, status: { $in: ['queued', 'pending'] } }, // ← condition
            { status: 'running', startedAt: new Date(), statusMessage: null }
        );

        // //(runId, {
        //     status: 'running',
        //     startedAt: new Date(),
        //     statusMessage: null
        // });
        // log the action
        await logAudit(userId, workspaceId, 'run', runId.toString(), 'execute', { ...rawParams });

        console.log('[processFullSim] rawParams:', JSON.stringify(rawParams));

        //validate and normalize input parameters
        const normedParams = valandNormParams(rawParams);

        console.log('[processFullSim] normedParams:', JSON.stringify(normedParams));

        let results;
        if (isAdaptive) { //if it's an adaptive modulation
            console.log(`[processFullSim] Running ADAPTIVE simulation for run ${runId}`);
            results = await runAdaptive(normedParams);
        } else { //if it's fixed
            console.log(` [processFullSim] Running FIXED simulation for run ${runId}`);
            results = await runSimulation(normedParams);
        }

        //save successful results to database
        await SimulationRun.findByIdAndUpdate(runId, {
            status: 'completed',
            completedAt: new Date(),
            results,
        });

        await logAudit(userId, workspaceId, 'run', runId.toString(), 'complete', { success: true });

    } catch (err) {
        console.error(`[processFullSim] Run ${runId} failed:`, err);

        //Mark as failed and save error message
        await SimulationRun.findByIdAndUpdate(runId, {
            status: 'failed',
            completedAt: new Date(),
            errorLog: err.message
        });
        await logAudit(userId, workspaceId, 'run', runId.toString(), 'fail', { error: err.message });

    } finally {
        // Always release the slot when done (success or failure)
        activeProcesses--;
        console.log(`[processFullSim] Slot released. Active: ${activeProcesses}/${MAX_CONCURRENT}`);
    }
}

//exported functions
module.exports = {
    runSimulation,
    runAdaptive,
    processFullSim
};