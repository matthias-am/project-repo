const {spawn} = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const SimRun = require('../models/SimRun');
const SimulationConfig = require('../models/SimulationConfig');
const Oservice = require('../services/OctaveService');

const jobQueue = []; //array to hold pending jobs
let isProcessing = false; //track if queue processor running
const MAX_CONCURRENT = 8;
let activeProcesses = 0;

async function addSimJob(runId, isAdaptive = false) {
    jobQueue.push({ runId, isAdaptive}); //add job obj to array
    console.log(`Job added to queue: runId=${runId}, adaptive=${isAdaptive}. Queue length: ${jobQueue.length}`); //logs job addition with queue length

    if (!isProcessing) {
        processQueue();
    } //start queue processer if not running
}

async function processQueue(){
    isProcessing = true;

    while (jobQueue.length > 0 && activeProcesses < MAX_CONCURRENT) {
        activeProcesses++;
        const job = jobQueue.shift(); //job contains all needed data

        processJob(job).finally(() => {
            activeProcesses--;
        });
    }

    //function to handle each job
    async function processJob(job) {

        try{
            const {
                runId,
                userId, workspaceId,
                params,
                isAdaptive
            } = job;

            console.log(`[JobQueue] Processing jobL runId=${runId}, userId=${userId}, adaptive=${isAdaptive}`);

            await Oservice.processFullSim(runId, userId, workspaceId, params, isAdaptive);

            console.log(`[JobQueue] Job completed successfully: runId=${runId}`);
        } catch (err) {
            console.error (`Job failed for run ${job.runId}:`, err);
        }
}
}
