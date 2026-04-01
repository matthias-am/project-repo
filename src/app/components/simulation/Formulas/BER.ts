
// Pure-function helpers for theoretical BER curves.
//theoretical overlay curves
// Formulas assume gray, only awgn, snr linear
// References:
//   Proakis, John G., and Masoud Salehi. Fundamentals of Communication Systems. 2nd ed. Pearson. 2013.

//   Abramowitz, Milton, and Irene A. Stegun, “ Handbook of Mathematical Functions with Formulas, Graphs, and Mathematical Tables.” Applied Mathematics Series 55. Washington, DC: National Bureau of Standards, 1972.

// ───────────────────────────────────────────────────────────────

/**
 * Complementary error function approximation 
 * Max absolute error < 1.5 × 10⁻⁷.
 */
export function erfc(x: number): number {
    const t = 1 / (1 + 0.3275911 * x);
    return (
        t *
        Math.exp(-x * x) *
        (0.254829592 +
            t * (-0.284496736 +
                t * (1.421413741 +
                    t * (-1.453152027 +
                        t * 1.061405429))))
    );
} //mad but it finally works sooo 

/** Q-function: Q(x) = (1/2) erfc(x / √2) */
export function qfunc(x: number): number {
    return 0.5 * erfc(x / Math.SQRT2);
}

/**
 * Returns theoretical average BER for the given scheme at Eb/N0 = snrDb (dB).
*/
export function theoreticalBer(scheme: string, snrDb: number): number {
    const snr = Math.pow(10, snrDb / 10); // convert dB → linear Eb/N0

    switch (scheme) {
        case 'bpsk':
            return qfunc(Math.sqrt(2 * snr));

        case 'qpsk':
            // Same BER per bit as BPSK under Gray coding
            return qfunc(Math.sqrt(2 * snr));
        //equations from background theory
        case '16qam':
            return (3 / 8) * erfc(Math.sqrt(snr / 10));

        case '64qam':
            return (7 / 24) * erfc(Math.sqrt(snr / 42));

        case '256qam':
            return (15 / 64) * erfc(Math.sqrt(snr / 170));

        case '1024qam':
            return (31 / 160) * erfc(Math.sqrt(snr / 68.2));

        default:
            return 0.5; // worst-case fallback
    }
}