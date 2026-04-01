// ─────────────────────────────────────────────────────────────────────────────
// simulation-charts.service.ts
// Responsible for creating and updating the BER and Constellation Chart.js
// instances.  The component hands it canvas elements and data; this service
// owns all Chart.js configuration details.
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { SimulationResults } from '../sim-services/simulation.service';
import { AccumulatedRun, BerScheme } from '../../components/simulation/sim-types/simulation.types';
import { theoreticalBer } from '../../components/simulation/Formulas/BER';

Chart.register(...registerables);

// ── Shared tick / grid colours 
const TICK_COLOR = '#7d8590';
const GRID_COLOR = 'rgba(125,133,144,0.15)';
const LABEL_COLOR = '#e6edf3';

@Injectable({ providedIn: 'root' })
export class SimulationChartsService {

    // ── BER chart 
    /**
     * (Re-)renders the BER vs SNR chart.*/
    initBerChart(
        canvas: HTMLCanvasElement,
        existing: Chart | null,
        rawResults: SimulationResults | undefined,
        accumulated: AccumulatedRun[],
        berSchemes: BerScheme[],
    ): Chart {
        existing?.destroy();

        const raw = rawResults as any;
        const snrValues: number[] =
            raw?.snr_db ?? raw?.snr_values ?? Array.from({ length: 21 }, (_, i) => i);

        const datasets: any[] = [];

        // ── Solid lines — one per accumulated simulated run 
        for (const run of accumulated) {
            const snr = run.snr_db.length > 0 ? run.snr_db : snrValues;
            datasets.push({
                label: `${run.label} (Simulated)`,
                data: run.ber.map((y, i) => ({ x: snr[i], y })),
                borderColor: run.color,
                borderWidth: 2.5,
                pointRadius: 0,
                tension: 0.3,
                borderDash: [],
                parsing: false,
            });
        }

        // ── Dashed lines — theoretical overlays toggled by user 
        for (const scheme of berSchemes) {
            if (!scheme.visible || scheme.key === 'simulated') continue;
            datasets.push({
                label: `${scheme.label} (Theoretical)`,
                data: snrValues.map(s => ({ x: s, y: theoreticalBer(scheme.key, s) })),
                borderColor: scheme.color,
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.3,
                borderDash: [6, 3],
                parsing: false,
            });
        }

        // ── Compute tight axis bounds from actual data 
        const allSnr = [
            ...accumulated.flatMap(r => r.snr_db),
            ...snrValues,
        ].filter(v => isFinite(v));
        const xMin = Math.floor(Math.min(...allSnr)) - 1;
        const xMax = Math.ceil(Math.max(...allSnr)) + 1;

        // collect every positive BER value across all datasets, then round
        const allBer = [
            ...accumulated.flatMap(r => r.ber),
            ...snrValues.flatMap(s =>
                berSchemes
                    .filter(sc => sc.visible && sc.key !== 'simulated')
                    .map(sc => theoreticalBer(sc.key, s))
            ),
        ].filter(v => v > 1e-11 && isFinite(v));  // exclude the clamp floor

        const berMin = allBer.length > 0 ? Math.min(...allBer) : 1e-6;
        const berMax = allBer.length > 0 ? Math.max(...allBer) : 0.5;

        // Floor to clean power of 10, but never go below 1e-8 cause lower cannot be measured by Monte Carlo with realistic bit counts anyway
        const yMin = Math.max(1e-8, Math.pow(10, Math.floor(Math.log10(berMin))));
        const yMax = Math.pow(10, Math.ceil(Math.log10(berMax)));

        // ── Superscript helper 
        const SUP: Record<string, string> = {
            '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
            '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
        };
        const toSup = (n: number) =>
            String(n).split('').map(ch => SUP[ch] ?? ch).join('');

        return new Chart(canvas, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        min: xMin,
                        max: xMax,
                        title: { display: true, text: 'SNR — Eb/N0 (dB)', color: TICK_COLOR },
                        ticks: { color: TICK_COLOR },
                        grid: { color: GRID_COLOR },
                    },
                    y: {
                        type: 'logarithmic',
                        min: yMin,
                        max: yMax,
                        title: { display: true, text: 'Bit Error Rate (BER)', color: TICK_COLOR },
                        ticks: {
                            color: TICK_COLOR,
                            // Render only clean powers of 10 as 10⁻ⁿ
                            callback: (value: string | number) => {
                                const v = Number(value);
                                const log = Math.log10(v);
                                if (Number.isInteger(Math.round(log))) {
                                    return `10${toSup(Math.round(log))}`;
                                }
                                return null;
                            },
                        },
                        grid: { color: GRID_COLOR },
                    },
                },
                plugins: {
                    legend: { labels: { color: LABEL_COLOR, usePointStyle: true } },
                },
            },
        });
    }

    // ── Constellation chart 

    initConstellationChart(
        canvas: HTMLCanvasElement,
        existing: Chart | null,
        rawResults: SimulationResults | undefined,
        showDecisionBoundaries: boolean,
        showDistances: boolean,
    ): Chart {
        existing?.destroy();

        const raw = rawResults;
        const idealPts = raw?.constellation?.ideal ?? [];
        const rcvdPts = raw?.constellation?.received ?? [];

        const toXY = (pts: { real: number; imag: number }[]) =>
            pts.map(p => ({ x: p.real, y: p.imag }));

        const idealXY = toXY(idealPts);
        const rcvdXY = toXY(rcvdPts);

        const findNearest = (
            pt: { x: number; y: number },
            ideals: { x: number; y: number }[],
        ) => {
            let best = ideals[0];
            let bestDist = Infinity;
            for (const ip of ideals) {
                const d = Math.hypot(pt.x - ip.x, pt.y - ip.y);
                if (d < bestDist) { bestDist = d; best = ip; }
            }
            return best;
        };

        const overlayPlugin = {
            id: 'constellationOverlay',
            afterDatasetsDraw: (chart: any) => {
                const ctx = chart.ctx as CanvasRenderingContext2D;
                const xScale = chart.scales['x'];
                const yScale = chart.scales['y'];

                // Distance lines from received → nearest ideal
                if (showDistances && idealXY.length > 0 && rcvdXY.length > 0) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(251,191,36,0.4)';
                    ctx.lineWidth = 1;
                    for (const rpt of rcvdXY) {
                        const nearest = findNearest(rpt, idealXY);
                        ctx.beginPath();
                        ctx.moveTo(xScale.getPixelForValue(rpt.x), yScale.getPixelForValue(rpt.y));
                        ctx.lineTo(xScale.getPixelForValue(nearest.x), yScale.getPixelForValue(nearest.y));
                        ctx.stroke();
                    }
                    ctx.restore();
                }

                // Decision boundaries (I=0 vertical, Q=0 horizontal)
                if (showDecisionBoundaries) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(248,113,113,0.5)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([6, 4]);

                    const xMid = xScale.getPixelForValue(0);
                    ctx.beginPath();
                    ctx.moveTo(xMid, chart.chartArea.top);
                    ctx.lineTo(xMid, chart.chartArea.bottom);
                    ctx.stroke();

                    const yMid = yScale.getPixelForValue(0);
                    ctx.beginPath();
                    ctx.moveTo(chart.chartArea.left, yMid);
                    ctx.lineTo(chart.chartArea.right, yMid);
                    ctx.stroke();

                    ctx.setLineDash([]);
                    ctx.restore();
                }
            },
        };

        const datasets: any[] = [];

        if (rcvdXY.length > 0) {
            datasets.push({
                label: 'Received',
                data: rcvdXY,
                backgroundColor: 'rgba(34,211,238,0.6)',
                pointRadius: 4,
                pointHoverRadius: 6,
            });
        }
        if (idealXY.length > 0) {
            datasets.push({
                label: 'Ideal',
                data: idealXY,
                backgroundColor: 'rgba(248,113,113,0.9)',
                pointRadius: 7,
                pointHoverRadius: 9,
            });
        }

        return new Chart(canvas, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        title: { display: true, text: 'In-phase (I)', color: TICK_COLOR },
                        ticks: { color: TICK_COLOR },
                        grid: { color: GRID_COLOR },
                        min: -1.5, max: 1.5,
                    },
                    y: {
                        title: { display: true, text: 'Quadrature (Q)', color: TICK_COLOR },
                        ticks: { color: TICK_COLOR },
                        grid: { color: GRID_COLOR },
                        min: -1.5, max: 1.5,
                    },
                },
                plugins: { legend: { labels: { color: LABEL_COLOR } } },
            },
            plugins: [overlayPlugin],
        });
    }
}