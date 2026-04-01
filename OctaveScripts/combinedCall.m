function q = qfunc_approx(x)
  q = 0.5 * erfc(x / sqrt(2));
end % Approximates the Q-function using the complementary error function (erfc).

arg_list = argv(); % Get all command-line arguments passed to the script
if length(arg_list) < 1
  error("Missing parameter file argument"); % Stop if no JSON file was provided
end
param_file = arg_list{1}; % First argument is the path to the temporary JSON parameter file

pkg load communications; %Loads Octave communications package

% Read the JSON file sent from Node.js and decode it into a struct
params = jsondecode(fileread(param_file));

% Force numeric types
params.snr_min     = double(params.snr_min);
params.snr_max     = double(params.snr_max);
params.num_points  = double(params.num_points);
params.symbol_rate = double(params.symbol_rate);

% Default values if fields are missing from JSON
awgn_variance = 0;
interference_power = 0;

if isfield(params, 'awgn_variance')
  awgn_variance = double(params.awgn_variance);
end
if isfield(params, 'interference_power')
  interference_power = double(params.interference_power);
end

% Ensure all values inside the schemes array/struct are proper doubles
for k = 1:numel(params.schemes)
  params.schemes(k).snr_threshold_db = double(params.schemes(k).snr_threshold_db);
  params.schemes(k).base_parameters.bits_per_symbol = double( ...
    params.schemes(k).base_parameters.bits_per_symbol);
end

%Generate SNR Vector
snr_profile = params.snr_profile;


if strcmp(snr_profile, 'linear')
% Standard linear sweep from snr_min to snr_max
  snr_db_vec = linspace(params.snr_min, params.snr_max, params.num_points);

elseif strcmp(snr_profile, 'sinusoidal')
% Simulated time-varying SNR (for testing adaptive behavior)
  snr_db_vec = 15 + 10 * sin(2*pi*(1:params.num_points)/50);
else
% Fallback: constant SNR
  snr_db_vec = ones(1, params.num_points) * 15;
end

schemes = params.schemes;
% Ensure schemes is always a row vector of structs
if isstruct(schemes)
  % Already a struct or struct array — reshape to ensure it's a row array
  schemes = schemes(:)';
else
  error('schemes is not a struct — check JSON params from backend');
end

% Sort schemes by increasing SNR threshold for adaptive
[~, idx] = sort([schemes.snr_threshold_db]);
schemes  = schemes(idx);


%[~, idx] = sort([schemes.snr_threshold_db]);
%schemes  = schemes(idx);

results            = struct(); % Main output container
results.snr_db     = snr_db_vec; % SNR values used
results.used_mod   = cell(1, length(snr_db_vec)); % Which modulation was chosen at each SNR
results.ber        = zeros(1, length(snr_db_vec)); % Bit Error Rate at each SNR point
results.throughput = zeros(1, length(snr_db_vec)); % Throughput at each SNR point

total_bits   = 0;  % Accumulator for overall BER calculation
total_errors = 0;

% Choose a representative SNR for constellation diagram
if isfield(params, 'const_ebn0_db')
  const_snr = double(params.const_ebn0_db);
else
  const_snr = snr_db_vec(max(1, floor(length(snr_db_vec)/2)));
end

const_num_symbols      = 500; % Number of symbols to generate for constellation plot
constellation_ideal    = []; % Will store ideal constellation points
constellation_received = []; % Will store noisy received points

% ── Pre-compute effective SNR penalty from AWGN variance and interference 

% This is applied consistently in both the trial and main simulation loops
awgn_penalty_db         = 10 * log10(1 + awgn_variance);
interference_penalty_db = 10 * log10(1 + interference_power);

% This is the core Monte Carlo simulation loop
for i = 1:length(snr_db_vec)
current_snr = snr_db_vec(i);
% Simple threshold switching — thresholds calibrated to actual simulated BER

% Calculate effective SNR after subtracting noise and interference penalties
effective_snr = current_snr - awgn_penalty_db - interference_penalty_db;

%Choose the highest-order scheme whose SNR threshold is met
chosen = schemes(1); % Default to lowest scheme
for k = length(schemes):-1:1 % Start from highest scheme
  if current_snr >= schemes(k).snr_threshold_db
    chosen = schemes(k);
    break;
  end
end


  % ── Main simulation for chosen scheme 
  % Convert bits_per_symbol to M-ary
  M   = 2 ^ chosen.base_parameters.bits_per_symbol;
  bps = int32(log2(M)); % Bits per symbol

  num_syms = 1e5; % Number of symbols to simulate

  % Generate random bits
  bits     = randi([0 1], 1, num_syms * double(bps));

  % Convert bits to symbol indices
  symbols  = int32(bi2de(reshape(bits, double(bps), num_syms)', 'left-msb'));

  if M <= 4
    mod_sig = pskmod(symbols, M); % BPSK or QPSK
  else
    mod_sig = qammod(symbols, M);
    mod_sig = mod_sig / sqrt(mean(abs(mod_sig).^2)); % Normalize to unit average power
  end

  % Add AWGN at effective SNR
  noisy = awgn(mod_sig, effective_snr, 'measured');

  % Add narrowband CW interferer if interference_power > 0
  if interference_power > 0
    amp          = sqrt(interference_power);
    phase_offset = 2 * pi * rand();
     freq_offset   = rand();  % normalized frequency 0–1
    n  = (0:num_syms-1);  % proper index vector
    interferer   = amp * exp(1j * (phase_offset + 2*pi * rand() * (1:num_syms)));
    noisy        = noisy + interferer(:)';
  end

  % Demodulate
  if M <= 4
    rx_syms = int32(pskdemod(noisy, M));
  else
    scale   = sqrt(mean(abs(qammod((0:M-1)', M)).^2));
    rx_syms = int32(qamdemod(noisy * scale, M));
  end

% Convert received symbols back to bits
  rx_bits = de2bi(rx_syms, double(bps), 'left-msb')';
  rx_bits = rx_bits(:)';

%performance metrics
  errors     = sum(bits ~= rx_bits);
  ber        = errors / length(bits);
  throughput = (1 - ber) * params.symbol_rate * log2(M);

%store results for this SNR point
  results.used_mod{i}   = chosen.display_name;
  results.ber(i)        = ber;
  results.throughput(i) = throughput;

%Accumulate for overall BER
  total_errors += errors;
  total_bits   += length(bits);

  % ── Constellation capture at const_snr 
  %Capture constellation only near the target SNR or last point
  if abs(current_snr - const_snr) < 0.01 || ...
     (isempty(constellation_ideal) && i == length(snr_db_vec))

%Generate all possible ideal symbols
 all_syms = int32((0:M-1)');
  if M <= 4
    ideal_all = pskmod(all_syms, M);
  else
    ideal_all = qammod(all_syms, M);
    ideal_all = ideal_all / sqrt(mean(abs(ideal_all).^2));
  end

   %Generate random symbols for noisy constellation
    bits_c = randi([0 1], 1, const_num_symbols * double(bps));
    syms_c = int32(bi2de(reshape(bits_c, double(bps), const_num_symbols)', 'left-msb'));


    if M <= 4
      ideal_c = pskmod(syms_c, M);
    else
      ideal_c = qammod(syms_c, M);
      ideal_c = ideal_c / sqrt(mean(abs(ideal_c).^2));
    end

    noisy_c = awgn(ideal_c, effective_snr, 'measured');

%store as matrices
    constellation_ideal    = [real(ideal_c(:)), imag(ideal_c(:))];
    constellation_received = [real(noisy_c(:)), imag(noisy_c(:))];
  end
end

% ── Aggregate results ──────────────────────────────────────────────────────────
results.overall_ber         = total_errors / total_bits;
results.avg_throughput      = mean(results.throughput);
results.spectral_efficiency = chosen.base_parameters.bits_per_symbol; %last chosen scheme

%Convert constellation points to JSON-friendly struct format
ideal_structs    = struct('real', num2cell(constellation_ideal(:,1)), ...
                          'imag', num2cell(constellation_ideal(:,2)));
received_structs = struct('real', num2cell(constellation_received(:,1)), ...
                          'imag', num2cell(constellation_received(:,2)));

results.constellation = struct('ideal', ideal_structs, 'received', received_structs);


%Print entire results struct as JSON so Node.js can parse it from stdout
disp(jsonencode(results));
