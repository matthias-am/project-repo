

export interface SimulationConfig {
    modulationScheme: string;
    snr: number;           // const Eb/N0 used for constellation capture
    awgn: number;          // noise variance passed to Octave
    interference: number;  // additive interference power passed to Octave
    method: string;
    snr_min: number;
    snr_max: number;
    snr_step: number;
    num_bits: number;
    num_symbols: number;
    is_adaptive?: boolean;
    snr_profile?: string;
    compare_schemes?: string[];
}

export interface DisplayResults {
    requiredSnr: number;
    spectralEfficiency: number;
    errorRate: number;
    processingTime: number;
}

export interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'success' | 'error';
}

export interface AccumulatedRun {
    label: string;
    color: string;
    ber: number[];
    snr_db: number[];
}

export interface BerScheme {
    key: string;
    label: string;
    color: string;
    visible: boolean;
    dashed: boolean;
}

export interface CompareScheme {
    key: string;
    label: string;
    selected: boolean;
}

// ── Maps & constants

/** Maps UI display names -> backend schemeId strings */
export const SCHEME_MAP: Record<string, string> = {
    'BPSK': 'bpsk',
    'QPSK': 'qpsk',
    '16-QAM': '16qam',
    '64-QAM': '64qam',
    '256-QAM': '256qam',
    '1024-QAM': '1024qam',
};

/** Bits transmitted per symbol for each scheme */
export const BITS_PER_SYMBOL: Record<string, number> = {
    'BPSK': 1, 'QPSK': 2, '16-QAM': 4, '64-QAM': 6, '256-QAM': 8, '1024-QAM': 10,
};

/** Colour assigned to each scheme badge / overlay */
export const SCHEME_COLORS: Record<string, string> = {
    bpsk: '#22d3ee', 
    qpsk: '#818cf8',
    '16qam': '#34d399',
    '64qam': '#f59e0b',
    '256qam': '#f87171',
    '1024qam': '#349'
};

/** Rotating palette for accumulated simulation runs */
export const RUN_COLORS = [
    '#22d3ee', '#34d399', '#f59e0b', '#f87171',
    '#818cf8', '#fb923c', '#c084fc',
];
//default configs for BER comparison curves
export const DEFAULT_BER_SCHEMES: BerScheme[] = [
    { key: 'simulated', label: 'Simulated', color: '#22d3ee', visible: true, dashed: false },
    { key: 'bpsk', label: 'BPSK', color: '#34d399', visible: false, dashed: true },
    { key: 'qpsk', label: 'QPSK', color: '#818cf8', visible: false, dashed: true },
    { key: '16qam', label: '16-QAM', color: '#f472b6', visible: false, dashed: true },
    { key: '64qam', label: '64-QAM', color: '#fb923c', visible: false, dashed: true },
    { key: '256qam', label: '256-QAM', color: '#facc15', visible: false, dashed: true },
    { key: '1024qam', label: '1024-QAM', color: 'rgba(255, 170, 170, 0.33)', visible: false, dashed: true },

];
//schemes avail for side by side
export const DEFAULT_COMPARE_SCHEMES: CompareScheme[] = [
    { key: 'bpsk', label: 'BPSK', selected: false },
    { key: 'qpsk', label: 'QPSK', selected: false },
    { key: '16qam', label: '16-QAM', selected: false },
    { key: '64qam', label: '64-QAM', selected: false },
    { key: '256qam', label: '256-QAM', selected: false },
    { key: '1024qam', label: '1024-QAM', selected: false },

];