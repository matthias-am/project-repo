const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');
const SimulationRun = require('../models/SimRun');
const { error } = require('console');
const AuditLog = require('../models/AuditLog');
const Oservice = require('../services/OctaveService');
const { logAudit } = require('../utils/auditLogger');

/*exports.runSimpleSimulation = async (req, res) => {
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
};*/

exports.runFullAnalysis = async (req, res) => {
  try {
    //block to creat run record as first step
    const run = await SimulationRun.create({
      executor: req.user.id,
      workspace_id: req.workspaceId,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      results: null,
      error: null
    });

    //message to client as soon as sim starts
    res.status(202).json({
      message: "Simulation started! We'll let you know when it's completed.",
      runId: run._id.toString(),
      checkStatusUrl: `/api/simulations/${run._id}/status`
    });

    //Background task to mask it as running
    (async () => {
      try {
    await SimulationRun.findByIdAndUpdate(run._id, {
      status: 'running',
      startedAt: new Date()
    });

    //Log the start of the sim

    await logAudit(req.user.id, req.workspaceId, run._id.toString(), 'execute', {schemeId: req.body.schemeId, snr_min: req.body.snr_min, snr_max: req.body.snr_max});

  /*await AuditLog.create({
    user_id: req.user.id,
    workspace_id: req.workspaceId,
    entity_type: run._id.toString(),
    action: 'execute',
    details: {schemeId: req.body.schemeId, snr_min: req.body.snr_min, snr_max: req.body.snr_max}
  }); */
  
  // Run Octave
  const results = await Oservice.runSimulation(req.body);

  //save successful sim
  await SimulationRun.findByIdAndUpdate(run._id, {
    status: 'completed',
    completedAt: new Date().
    results
  });

  //Log the completion of the sim
  await logAudit(req.user.id, req.workspaceId, 'run', run._id.toString(), 'complete', {success: true});

 /* await AuditLog.create({
    user_id: req.user.id,
    workspace_id: req.workspaceId,
    entity_type: 'run',
    entity_id:run._id.toString(),
    action: 'complete',
    details: {success: true}
  }); */

}catch (err) {
  console.error('Background simulation failed: ', err);

  await SimulationRun.findByIdAndUpdate(run._id, {
    status: 'failed',
    completedAt: new Date(),
    error: err.message || 'Unknown error'
  });

  await logAudit(req.user.id, req.workspaceId, 'run', run._id.toString(), 'fail', {error: err.message});

 /* await AuditLog.create({
    user_id: req.user.id,
    workspace_id: req.workspaceId,
    entity_type: 'run',
    entity_id: run._id.toString(),
    action: 'fail',
    details: {error: err.message}
  }); */
}
    })();

  }catch (err) {
    res.status(500).json({message: 'Failed to queue simulation', error: err.message});
  }
};

 /* const {  //default values
    schemeId, 
    snr_min = 0, snr_max = 20, snr_step = 2, 
    num_bits = 100000,
    const_ebn0_db = 10, 
    num_symbols = 3000 
  } = req.body;

  let mod_type;
  switch (schemeId.toLowerCase()) {
    case 'bpsk':   mod_type = 'BPSK'; break;
    case 'qpsk':   mod_type = 'QPSK'; break;
    case '16qam':  mod_type = '16QAM'; break;
    case '64qam':  mod_type = '64QAM'; break;
    case '256qam': mod_type = '256QAM'; break;
    case '1024qam': mod_type = '1024QAM'; break;
    default: return res.status(400).json({ message: 'Unsupported scheme' });
  }

  try {
    const scriptPath = path.join(__dirname, '..', 'OctaveScripts', 'combinedCall.m'); // the octave script path

    const snr_range = [];
    for (let s = snr_min; s <= snr_max; s += snr_step) snr_range.push(s);
    const snr_str = `[${snr_range.join(' ')}]`;

    const cmd = `octave-cli --no-gui -q "${scriptPath}" "${mod_type}" "${snr_str}" ${num_bits} ${const_ebn0_db} ${num_symbols}`;

    const { stdout, stderr } = await execPromise(cmd, { timeout: 180000 }); // 3 min max

    try {
    const { stdout, stderr } = await execPromise(cmd, { timeout: 180000 });

    await AuditLog.create({
      user_id: req.user.id,
      workspace_id: req.workspaceId,
      entity_type: 'run',
      entity_id: run._id.toString(),
      action: 'execute',
      details: {
        scheme: req.body.schemeId,
        snr_min: req.body.snr_min,
        snr_max: req.body.snr_max
      }
    })

    //await AuditLog.create({
      //user_id: req.user.id,
      //workspace_id: req.workspaceId,
      //entity_type: 'run',
      //entity_id: run._id.toString(),
      //action: 'completed',
      //details: {
        //scheme: req.body.schemeId,
        //snr_min: req.body.snr_min,
        //snr_max: req.body.snr_max
      //}
   // });



  
    // console.log('RAW STDOUT from Octave:');
    // console.log(stdout);                    // print everything Octave sent
    // console.log('RAW STDERR from Octave:');
    // console.log(stderr || '(empty)');

   // if (stderr && !stderr.toLowerCase().includes('warning')) {
     // throw new Error(`Octave error: ${stderr.trim()}`);
    //}

    // Find the actual JSON line (often not the very last line)
    //const lines = stdout.trim().split('\n').filter(line => line.trim());
    //console.log('Filtered non-empty lines:', lines);

    // Try to find a line that starts with '{' 
    // let jsonLine = lines.find(line => line.startsWith('{')) || lines[lines.length - 1];

    // if (!jsonLine) {
       // throw new Error('No JSON-like output found in stdout');
    //}

   // console.log('Attempting to parse this line:', jsonLine);

    // Parse (with fallback cleanup)
    let result;
    try {
      result = JSON.parse(jsonLine);
    } catch (parseErr) {
      // Common cleanup: remove any leading/trailing garbage
      const cleaned = jsonLine.replace(/^[^ {]*({.*})$/, '$1').trim();
      console.log('Cleaned attempt:', cleaned);
      result = JSON.parse(cleaned);
    }

  } catch (err) {
    console.error('Full analysis error:', err);
    res.status(500).json({ message: 'Simulation failed', error: err.message });
  }

    if (stderr && !stderr.toLowerCase().includes('warning')) {
      throw new Error(stderr.trim() || 'Octave execution error');
    }

    // Find the JSON line (usually last non-empty)
    const lines = stdout.trim().split('\n');
    const jsonLine = lines.find(l => l.trim().startsWith('{')) || lines[lines.length-1];

    // Parse (handle mat2str arrays manually if needed)
    const result = JSON.parse(jsonLine.replace(/(\w+):/g, '"$1":')); // simple fix for unquoted keys if any

    //  reshape flattened points back to objects
    if (result.constellation) {
      const idealFlat = result.constellation.ideal; // e.g. [ -0.7071, 0.7071, ... ]
      result.constellation.ideal = [];
      for (let i = 0; i < idealFlat.length; i += 2) {
        result.constellation.ideal.push({ r: idealFlat[i], i: idealFlat[i+1] });
      }
      // Same for received
      const noisyFlat = result.constellation.received;
      result.constellation.received = [];
      for (let i = 0; i < noisyFlat.length; i += 2) {
        result.constellation.received.push({ r: noisyFlat[i], i: noisyFlat[i+1] });
      }
    }

    // Save to DB (SimulationRun)
    const run = await SimuRun.create({
      executor: req.user.id,
      status: 'completed',
      results: result,
      // later: configId, workspaceId
    });

    res.json({ success: true, analysis: result, runId: run._id });
  } catch (err) {
    console.error('Full analysis error:', err);
    res.status(500).json({ message: 'Simulation failed', error: err.message });
  }
};

*/

exports.deleteSimulation = async(req, res) => {
  try {
    const runId = req.params.id;
    const workspaceId = req.workspaceId;

    const run = await SimulationRun.findOne({
      _id: runId,
      workspace_id: workspaceId
    });

    if (!run) {
      return res.status(404).json({message: 'Simulation not found or not in this workspace'});
    }
    if (run.status === 'running') {
      return res.status(400).json({message: 'Cannot delete a running simulation'});
    }

    await SimulationRun.deleteOne({_id: runId});

    //Log in audit
    await logAudit(req.user.id, req.workspaceId,'run' , run._id.toString(), 'delete', {deletedRunStatus: run.status});

    /*await AuditLog.create({
      user_id: req.user.id,
      workspace_id: workspaceId,
      entity_type: 'run',
      entity_id: runId,
      action: 'delete',
      details: {deletedRunStatus: run.status}
    }); */

    res.json ({
      success: true,
      message: 'Simulation deleted',
      deletedId: runId
    });
  } catch (err) {
    console.error('Delete simulation error:', err);
    res.status(500).json({message: 'Could not delete simulation', error: err.message});
  }
};

exports.getSimulationStatus = async (req, res) => {
  try {
    const runId = req.params.id;

    const run = await SimulationRun.findOne({_id: runId, workspace_id: req.workspaceId})
    .select('status results error startedAt completedAt executor');

    if (!run) {
      return res.status(404).json({messsage: 'Simulation not found or not in your workspace'});
    }

    res.json ({
      success: true,
      status: run.status,
      progress: run.status === 'completed' ? 100: run.status === 'running' ? 50:10,
      results: run.results || null,
      error: run.error || null,
      startedAt: run.startedAt,
      completedAt: run.completedAt
    });
  } catch (err) {
    console.error ('Status fetch error:', err);
    res.status(500).json({message: 'Error fetching simulation status', error: err.message});
  }
  };

