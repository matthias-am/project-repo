const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const { logAudit } = require('../utils/auditLogger');
const { valandNormParams } = require('../services/validParams');
const execPromise = util.promisify(exec);
const SimulationRun = require('../models/SimRun');

let activeProcesses = 0;
const MAX_CONCURRENT = 8;

// ── Fixed modulation simulation ───────────────────────────────────────────────
// Called by processFullSim when is_adaptive = false
// Runs combinedCall.m → adaptive_modulation_sim.m and returns parsed JSON results
async function runSimulation(valparams) {
    if (activeProcesses >= MAX_CONCURRENT) {
        throw new Error('Server is busy. Please try again in a few seconds.');
    }

    activeProcesses++;
    try {
        const scriptPath = path.join(__dirname, '../OctaveScripts/combinedCall.m');

        // Build the params JSON file path for combinedCall.m
        // combinedCall.m reads a JSON param file, so we write one to a temp file
        const fs = require('fs');
        const os = require('os');
        const tmpFile = path.join(os.tmpdir(), `sim_params_${Date.now()}.json`);

        // Build the params object that adaptive_modulation_sim expects
        const octaveParams = buildOctaveParams(valparams);
        fs.writeFileSync(tmpFile, JSON.stringify(octaveParams));

        const cmd = `octave-cli --no-gui -q "${scriptPath}" "${tmpFile}"`;
        console.log('[OctaveService] Executing:', cmd);

        const { stdout, stderr } = await execPromise(cmd, { timeout: 180000 });

        // Clean up temp file
        try { fs.unlinkSync(tmpFile); } catch (_) {}

        if (stderr && !stderr.toLowerCase().includes('warning')) {
            console.error('[OctaveService] STDERR:', stderr);
            throw new Error(`Octave execution failed: ${stderr.trim()}`);
        }

        // Find the JSON line in stdout
        const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
        const jsonStartIndex = lines.findIndex(l => l.startsWith('{'));
        if (jsonStartIndex === -1) {
            console.log('[OctaveService] Full stdout:\n', stdout);
            throw new Error('No JSON object found in Octave output');
        }

        const jsonText = lines.slice(jsonStartIndex).join('\n');
        const result = JSON.parse(jsonText);

        // The updated adaptive_modulation_sim.m already outputs constellation as
        // {real, imag} objects — no reshaping needed here.
        return result;

    } catch (err) {
        console.error('[OctaveService] runSimulation failed:', err);
        throw err;
    } finally {
        activeProcesses--;
    }
}

// ── Adaptive modulation simulation ────────────────────────────────────────────
// Called by processFullSim when is_adaptive = true
// Uses the same Octave script but with is_adaptive = true in the params
async function runAdaptive(valparams) {
    if (activeProcesses >= MAX_CONCURRENT) {
        throw new Error('Server is busy. Please try again in a few seconds.');
    }

    activeProcesses++;
    try {
        const fs = require('fs');
        const os = require('os');
        const scriptPath = path.join(__dirname, '../OctaveScripts/combinedCall.m');
        const tmpFile = path.join(os.tmpdir(), `sim_adaptive_${Date.now()}.json`);

        const octaveParams = buildOctaveParams(valparams, true);
        fs.writeFileSync(tmpFile, JSON.stringify(octaveParams));

        const cmd = `octave-cli --no-gui -q "${scriptPath}" "${tmpFile}"`;
        console.log('[OctaveService] Executing adaptive:', cmd);

        const { stdout, stderr } = await execPromise(cmd, { timeout: 300000 });

        try { fs.unlinkSync(tmpFile); } catch (_) {}

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
    } finally {
        activeProcesses--;
    }
}

// ── Build Octave params object ────────────────────────────────────────────────
// Maps the normalized JS params to the structure adaptive_modulation_sim.m expects
function buildOctaveParams(valparams, isAdaptive = false) {
    const schemeId = valparams.schemeId?.toLowerCase() ?? 'qpsk';

    // Default scheme thresholds matching the Octave script
    const schemeConfigs = {
        'bpsk':    { display_name: 'BPSK',    snr_threshold_db: 0,  bits_per_symbol: 1 },
        'qpsk':    { display_name: 'QPSK',    snr_threshold_db: 6,  bits_per_symbol: 2 },
        '16qam':   { display_name: '16QAM',   snr_threshold_db: 12, bits_per_symbol: 4 },
        '64qam':   { display_name: '64QAM',   snr_threshold_db: 18, bits_per_symbol: 6 },
        '256qam':  { display_name: '256QAM',  snr_threshold_db: 24, bits_per_symbol: 8 },
        '1024qam': { display_name: '1024QAM', snr_threshold_db: 30, bits_per_symbol: 10 },
    };

    let schemes;
    if (isAdaptive) {
        // For adaptive: include all schemes up to and including the selected one
        const allSchemes = ['bpsk', 'qpsk', '16qam', '64qam', '256qam', '1024qam'];
        const idx = allSchemes.indexOf(schemeId);
        const activeSchemes = allSchemes.slice(0, idx + 1);
        schemes = activeSchemes.map(s => ({
            display_name:       schemeConfigs[s].display_name,
            snr_threshold_db:   schemeConfigs[s].snr_threshold_db,
            base_parameters: {
                bits_per_symbol: schemeConfigs[s].bits_per_symbol
            }
        }));
    } else {
        // For fixed: single scheme only, threshold = snr_min so it always activates
        const cfg = schemeConfigs[schemeId] ?? schemeConfigs['qpsk'];
        schemes = [{
            display_name:     cfg.display_name,
            snr_threshold_db: valparams.snr_min,  // always meets threshold
            base_parameters:  { bits_per_symbol: cfg.bits_per_symbol }
        }];
    }

    return {
        snr_min:       valparams.snr_min,
        snr_max:       valparams.snr_max,
        num_points:    Math.round((valparams.snr_max - valparams.snr_min) / valparams.snr_step) + 1,
        symbol_rate:   1e6,
        is_adaptive:   isAdaptive,
        target_ber:    1e-3,
        snr_profile:   'linear',
        const_ebn0_db: valparams.const_ebn0_db,
        schemes
    };
}

// ── Background simulation runner ──────────────────────────────────────────────
// Called by simController after creating the SimRun record
// Runs in the background, updates SimRun status when done
async function processFullSim(runId, userId, workspaceId, rawParams, isAdaptive) {
    try {
        await SimulationRun.findByIdAndUpdate(runId, {
            status: 'running',
            startedAt: new Date()
        });

        await logAudit(userId, workspaceId, 'run', runId.toString(), 'execute', { ...rawParams });

        const normedParams = valandNormParams(rawParams);

        let results;
        if (isAdaptive) {
            console.log(`[processFullSim] Running ADAPTIVE simulation for run ${runId}`);
            results = await runAdaptive(normedParams);
        } else {
            console.log(`[processFullSim] Running FIXED simulation for run ${runId}`);
            results = await runSimulation(normedParams);
        }

        await SimulationRun.findByIdAndUpdate(runId, {
            status: 'completed',
            completedAt: new Date(),
            results
        });

        await logAudit(userId, workspaceId, 'run', runId.toString(), 'complete', { success: true });

    } catch (err) {
        console.error(`[processFullSim] Run ${runId} failed:`, err);
        await SimulationRun.findByIdAndUpdate(runId, {
            status: 'failed',
            completedAt: new Date(),
            errorLog: err.message
        });
        await logAudit(userId, workspaceId, 'run', runId.toString(), 'fail', { error: err.message });
    }
}

module.exports = {
    runSimulation,
    runAdaptive,
    processFullSim
};