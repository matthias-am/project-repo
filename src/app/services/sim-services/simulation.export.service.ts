//export helperr

import { SimulationConfig } from '../../components/simulation/sim-types/simulation.types';
import { SimulationResults } from '../../services/sim-services/simulation.service';

export type ExportFormat = 'json' | 'csv';

export interface ExportOptions {
    format: ExportFormat;
    includeParams: boolean;
    includeResults: boolean;
    includeVisuals: boolean;
}

// ── File-name helper 

export function buildExportFileName(
    scheme: string,
    format: ExportFormat,
): string {
    const s = scheme.replace('-', '');
    const d = new Date().toLocaleDateString('en-CA');
    return `simulation_${s}_${d}.${format}`;
}

// ── Payload builders 

function buildJsonPayload(
    config: SimulationConfig,
    raw: SimulationResults | undefined,
    opts: ExportOptions,
): string {
    const r = raw as any;
    const snrValues: number[] = r?.snr_db ?? r?.snr_values ?? [];

    const payload: Record<string, any> = {};

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

    if (opts.includeResults) {
        payload['results'] = {
            ber: r?.ber ?? [],
            snr_values: snrValues,
            overall_ber: r?.overall_ber ?? null,
            spectral_efficiency: r?.spectral_efficiency ?? null,
            avg_throughput: r?.avg_throughput ?? null,
        };
    }

    if (opts.includeVisuals && r?.constellation) {
        payload['constellation'] = r.constellation;
    }

    return JSON.stringify(payload, null, 2);
}

function buildCsvPayload(
    raw: SimulationResults | undefined,
): string {
    const r = raw as any;
    const snrValues: number[] = r?.snr_db ?? r?.snr_values ?? [];
    const rows = ['SNR_dB,BER'];
    snrValues.forEach((s: number, i: number) => {
        rows.push(`${s},${r?.ber?.[i] ?? ''}`);
    });
    return rows.join('\n');
}

// ── Main export function 
/*Builds the export content and triggers a browser download */
export function exportAndDownload(
    config: SimulationConfig,
    raw: SimulationResults | undefined,
    opts: ExportOptions,
): void {
    let content = '';
    let mimeType = 'application/octet-stream';

    if (opts.format === 'json') {
        content = buildJsonPayload(config, raw, opts);
        mimeType = 'application/json';
    } else if (opts.format === 'csv') {
        content = buildCsvPayload(raw);
        mimeType = 'text/csv';
    }

    const fname = buildExportFileName(config.modulationScheme, opts.format);
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
}