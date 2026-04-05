//Simulation controller for runs
//functions and debugging assistance provided by claudAI - Matthias Mohamed, 816028510, 25/02/2026
//All other code done independently

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');
const SimulationRun = require('../models/SimRun');
const { error } = require('console');
const AuditLog = require('../models/AuditLog');
const Oservice = require('../services/OctaveService');
const { logAudit } = require('../utils/auditLogger');
const SimulationConfig = require('../models/SimulationConfig');
const JobQueue = require('../services/Jobqueue');

exports.runFullAnalysis = async (req, res) => {
  try {
    if (!req.body.configId) { //checks if configID provided in req body
      return res.status(400).json({ message: 'configId is required to run a simulation' }); //returns 400 if configID missing
    }

    //Load config from DB (must be in the same workspace)
    const config = await SimulationConfig.findOne({
      config_id: req.body.configId,
      workspace_id: req.workspaceId
    });

    if (!config) {
      return res.status(404).json({ message: 'Configuration not found or not in this workspace' }); //return 404 is config not found
    }

    const params = {
      schemeId: config.scheme_id,
      ...config.parameters,
      ...req.body
    }; //parameterer object for simulation, ... spreads params

    delete params.configId; //deletes configID from params obj(not needed for sim)

    //block to create run record in DB
    const run = await SimulationRun.create({
      executor: req.user.id, //user is set as executor
      workspace_id: req.workspaceId,
      config_id: req.body.configId,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      results: null,
      error: null
    });

    const isAdaptive = req.body.is_adaptive === true || (await SimulationConfig.findOne({ config_id: req.body.configId }))?.is_adaptive === true; //checks if sim should be adaptive through reg body or adaptive flag set to true

    JobQueue.addSimJob( //adds to job queue
      run._id,
      req.user.id,
      req.workspaceId,
      params,
      isAdaptive //adaptive flag
    );

    //message to client as soon as sim starts
    res.status(202).json({
      message: "Simulation started! We'll let you know when it's completed.",
      runId: run._id.toString(), //returns runid as string
      checkStatusUrl: `/api/simulations/${run._id}/status`
    }); //obv checks the run status

    Oservice.processFullSim(run._id, req.user.id, req.workspaceId, params, isAdaptive) //octave service to run sim in bg
      .catch(err => console.error('Background error:', err));

  } catch (err) {
    res.status(500).json({ message: 'Failed to start simulation', error: err.message });
  }
}


// exports.deleteSimulation = async (req, res) => { //export delete function
//   try {
//     const runId = req.params.id;
//     const workspaceId = req.workspaceId;

//     const run = await SimulationRun.findOne({ //finfd the sim run by id and workspace id
//       _id: runId,
//       workspace_id: workspaceId
//     });

//     if (!run) {
//       return res.status(404).json({ message: 'Simulation not found or not in this workspace' }); // returns 404 if run does not exist
//     }
//     if (run.status === 'running') {
//       return res.status(400).json({ message: 'Cannot delete a running simulation' }); // checks if simulation is running atm
//     }

//     await SimulationRun.deleteOne({ _id: runId }); //deletes the sim from the database


//     //Log the deletion in audit log
//     await logAudit(req.user.id, req.workspaceId, 'run', run._id.toString(), 'delete', { deletedRunStatus: run.status });

//     /*await AuditLog.create({
//       user_id: req.user.id,
//       workspace_id: workspaceId,
//       entity_type: 'run',
//       entity_id: runId,
//       action: 'delete',
//       details: {deletedRunStatus: run.status}
//     }); */

//     res.json({
//       success: true,
//       message: 'Simulation deleted',
//       deletedId: runId
//     }); //returns success response and id of deleted run
//   } catch (err) {
//     console.error('Delete simulation error:', err); //catches error and logs it
//     res.status(500).json({ message: 'Could not delete simulation', error: err.message });
//   } //returns 500 error is could not delete
// };

exports.getSimulationStatus = async (req, res) => { //exports status check
  try {
    const runId = req.params.id; //Gets run ID from URL

    const run = await SimulationRun.findOne({ _id: runId, workspaceId: req.query.workspaceId }) //finds run by ID and workspace
      .select('status results error startedAt completedAt executor'); //selects these specific fields

    console.log('[getSimulationStatus] raw run:', JSON.stringify({
      id: run?._id,
      status: run?.status,
      hasResults: !!run?.results,
      statusMessage: run?.statusMessage
    }));

    if (!run) {
      return res.status(404).json({ messsage: 'Simulation not found or not in your workspace' }); //return 404 if run not found
    }

    res.json({
      success: true,
      status: run.status,
      progress: run.status === 'completed' ? 100 : run.status === 'running' ? 50 : 10, //calcs progress , 10 for pending/failed, 50 running, 100 completed 
      results: run.results || null,
      error: run.errorLog || null,
      statusMessage: run.statusMessage || null,
      startedAt: run.startedAt,
      completedAt: run.completedAt
    });

  } catch (err) {
    console.error('Status fetch error:', err);
    res.status(500).json({ message: 'Error fetching simulation status', error: err.message }); //returns 500 when cannot fetch or error fetching
  }
};

