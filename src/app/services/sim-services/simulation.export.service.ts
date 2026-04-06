//export helperr

import { SimulationConfig } from '../../components/simulation/sim-types/simulation.types';
import { SimulationResults } from '../../services/sim-services/simulation.service';

export type ExportFormat = 'json' | 'csv'; //export options

export interface ExportOptions {
    format: ExportFormat;
    includeParams: boolean; //options
    includeResults: boolean;
    includeVisuals: boolean;
}

// Function to generate a file name for the download

export function buildExportFileName(
    scheme: string,
    format: ExportFormat,
): string {
    const s = scheme.replace('-', ''); //remove hyphens from scheme name
    const d = new Date().toLocaleDateString('en-CA'); //yyyy/mmm/ddd
    return `simulation_${s}_${d}.${format}`;
}

//  Payload builders 
//creates the content for json
function buildJsonPayload(
    config: SimulationConfig,
    raw: SimulationResults | undefined,
    opts: ExportOptions,
): string {
    const r = raw as any;
    const snrValues: number[] = r?.snr_db ?? r?.snr_values ?? [];

    const payload: Record<string, any> = {};

    //if user enables sim parameters
    if (opts.includeParams) {
        payload['simulation'] = {
            modulation: config.modulationScheme,
            snr_db: config.snr,
            awgn_variance: config.awgn,
            interference: config.interference,
            method: config.method,
            date: new Date().toISOString(),
        };
    }
    //if user enables sim results
    if (opts.includeResults) {
        payload['results'] = {
            ber: r?.ber ?? [],
            snr_values: snrValues,
            overall_ber: r?.overall_ber ?? null,
            spectral_efficiency: r?.spectral_efficiency ?? null,
            avg_throughput: r?.avg_throughput ?? null,
        };
    }
    //if user includes visuals (not sure how to implement this but putting just incase)
    if (opts.includeVisuals && r?.constellation) {
        payload['constellation'] = r.constellation;
    }

    return JSON.stringify(payload, null, 2);
}

//function for cvs file
function buildCsvPayload(
    raw: SimulationResults | undefined,
): string {
    const r = raw as any;
    const snrValues: number[] = r?.snr_db ?? r?.snr_values ?? [];
    const rows = ['SNR_dB,BER']; //header row
    snrValues.forEach((s: number, i: number) => { //loop through SNR values
        rows.push(`${s},${r?.ber?.[i] ?? ''}`);//add row
    });
    return rows.join('\n');
}

// Main export function 
// Builds the export content and triggers a browser download 
export function exportAndDownload(
    config: SimulationConfig,
    raw: SimulationResults | undefined,
    opts: ExportOptions,
): void {
    let content = ''; //will hold file data
    let mimeType = 'application/octet-stream'; //default file type is generic binary

    if (opts.format === 'json') {
        content = buildJsonPayload(config, raw, opts);
        mimeType = 'application/json';
    } else if (opts.format === 'csv') {
        content = buildCsvPayload(raw);
        mimeType = 'text/csv';
    }

    const fname = buildExportFileName(config.modulationScheme, opts.format);
    const blob = new Blob([content], { type: mimeType }); //creates a binary file in memory
    const url = URL.createObjectURL(blob); //temp url pointing to the file
    const a = document.createElement('a');
    a.href = url; //set file url
    a.download = fname; //set filr name
    a.click(); //triggers download
    URL.revokeObjectURL(url);
}