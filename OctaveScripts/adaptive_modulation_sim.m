function results = adaptive_modulation_sim(params) %takes param structure as input and returns results structure

pkg load communications; %Octave communications package

close all; %closes all open figures

% Force numeric types from possible JSON strings
params.snr_min          = double(params.snr_min);
params.snr_max          = double(params.snr_max);
params.num_points       = double(params.num_points);    
params.symbol_rate      = double(params.symbol_rate);

% For schemes array, loops through each mod scheme, converts to double
for k = 1:numel(params.schemes)
  params.schemes(k).snr_threshold_db = double(params.schemes(k).snr_threshold_db);
  params.schemes(k).base_parameters.bits_per_symbol = double( ...
    params.schemes(k).base_parameters.bits_per_symbol);
end

is_adaptive = params.is_adaptive;
target_ber  = params.target_ber;
snr_profile = params.snr_profile;

% Creates SNR values based on profile
if strcmp(snr_profile, 'linear')
  snr_db_vec = linspace(params.snr_min, params.snr_max, params.num_points);
elseif strcmp(snr_profile, 'sinusoidal')
  snr_db_vec = 15 + 10 * sin(2*pi*(1:params.num_points)/50);
else
  snr_db_vec = ones(1, params.num_points) * 15;
end

% Sort schemes by threshold (lowest to highest)
schemes = params.schemes;
[~, idx] = sort([schemes.snr_threshold_db]);
schemes = schemes(idx);

% Pre-allocate results
results = struct();
results.snr_db     = snr_db_vec;
results.used_mod   = cell(1, length(snr_db_vec));
results.ber        = zeros(1, length(snr_db_vec));
results.throughput = zeros(1, length(snr_db_vec));

total_bits   = 0;
total_errors = 0;

% Constellation capture — record points from the LAST SNR point only
% (using const_ebn0_db if provided, otherwise the midpoint SNR)
if isfield(params, 'const_ebn0_db')
  const_snr = double(params.const_ebn0_db);
else
  const_snr = snr_db_vec(max(1, floor(length(snr_db_vec)/2)));
end

const_num_symbols = 500; % enough points to show spread without being huge
constellation_ideal    = [];  % Nx2: [real, imag]
constellation_received = [];

for i = 1:length(snr_db_vec)
  current_snr = snr_db_vec(i);

  % Find highest modulation scheme whose threshold the current SNR meets
  chosen = schemes(1);
  for k = length(schemes):-1:1
    if current_snr >= schemes(k).snr_threshold_db
      chosen = schemes(k);
      break;
    end
  end

  M   = 2 ^ chosen.base_parameters.bits_per_symbol;
  bps = int32(log2(M));

  num_symbols = 1e5;
  bits = randi([0 1], 1, num_symbols * double(bps));

  if M <= 4
    symbols = int32(bi2de(reshape(bits, double(bps), num_symbols)', 'left-msb'));
    mod_sig = pskmod(symbols, M);
  else
    symbols = int32(bi2de(reshape(bits, double(bps), num_symbols)', 'left-msb'));
    mod_sig = qammod(symbols, M);
  end

  noisy = awgn(mod_sig, current_snr, 'measured');

  if M <= 4
    rx_syms = int32(pskdemod(noisy, M));
  else
    rx_syms = int32(qamdemod(noisy, M));
  end

  rx_bits = de2bi(rx_syms, double(bps), 'left-msb')';
  rx_bits = rx_bits(:)';

  errors = sum(bits ~= rx_bits);
  ber    = errors / length(bits);

  throughput = (1 - ber) * params.symbol_rate * log2(M);

  results.used_mod{i}   = chosen.display_name;
  results.ber(i)        = ber;
  results.throughput(i) = throughput;

  total_errors += errors;
  total_bits   += length(bits);

  % Capture constellation points at the target SNR point
  if abs(current_snr - const_snr) < 0.01 || ...
     (isempty(constellation_ideal) && i == length(snr_db_vec))

    % Use a small dedicated batch for clean constellation points
    bits_c = randi([0 1], 1, const_num_symbols * double(bps));

    if M <= 4
      syms_c   = int32(bi2de(reshape(bits_c, double(bps), const_num_symbols)', 'left-msb'));
      ideal_c  = pskmod(syms_c, M);
    else
      syms_c   = int32(bi2de(reshape(bits_c, double(bps), const_num_symbols)', 'left-msb'));
      ideal_c  = qammod(syms_c, M);
    end

    noisy_c = awgn(ideal_c, const_snr, 'measured');

    constellation_ideal    = [real(ideal_c(:)), imag(ideal_c(:))];
    constellation_received = [real(noisy_c(:)), imag(noisy_c(:))];
  end
end

results.overall_ber    = total_errors / total_bits;
results.avg_throughput = mean(results.throughput);

% Spectral efficiency: bits/symbol of the last chosen scheme
last_chosen_bps = chosen.base_parameters.bits_per_symbol;
results.spectral_efficiency = last_chosen_bps; % bps/Hz

% Constellation as struct arrays for jsonencode compatibility
n_ideal = size(constellation_ideal, 1);
n_recv  = size(constellation_received, 1);

ideal_structs    = struct('real', num2cell(constellation_ideal(:,1)), ...
                          'imag', num2cell(constellation_ideal(:,2)));
received_structs = struct('real', num2cell(constellation_received(:,1)), ...
                          'imag', num2cell(constellation_received(:,2)));

results.constellation = struct( ...
  'ideal',    ideal_structs, ...
  'received', received_structs ...
);

endfunction


%!test
%! % Test 1: Basic execution and output fields exist
%! pkg load communications;
%! params = struct();
%! params.snr_min      = 0;
%! params.snr_max      = 30;
%! params.num_points   = 10;
%! params.symbol_rate  = 1e6;
%! params.is_adaptive  = true;
%! params.target_ber   = 1e-3;
%! params.snr_profile  = 'linear';
%! params.schemes = struct( ...
%!   'display_name',        {'QPSK',  '16QAM', '64QAM'}, ...
%!   'snr_threshold_db',    {6,       12,      18},      ...
%!   'base_parameters',     {struct('bits_per_symbol', 2), ...
%!                           struct('bits_per_symbol', 4), ...
%!                           struct('bits_per_symbol', 6)} ...
%! );
%! r = adaptive_modulation_sim(params);
%! assert(isfield(r, 'ber'));
%! assert(isfield(r, 'throughput'));
%! assert(isfield(r, 'overall_ber'));
%! assert(isfield(r, 'avg_throughput'));
%! assert(isfield(r, 'used_mod'));
%! assert(isfield(r, 'snr_db'));
%! assert(isfield(r, 'constellation'));
%! assert(isfield(r, 'spectral_efficiency'));

%!test
%! % Test 2: SNR vector length matches num_points
%! pkg load communications;
%! params = struct();
%! params.snr_min      = 0;
%! params.snr_max      = 20;
%! params.num_points   = 8;
%! params.symbol_rate  = 1e6;
%! params.is_adaptive  = true;
%! params.target_ber   = 1e-3;
%! params.snr_profile  = 'linear';
%! params.schemes = struct( ...
%!   'display_name',     {'QPSK'}, ...
%!   'snr_threshold_db', {6},      ...
%!   'base_parameters',  {struct('bits_per_symbol', 2)} ...
%! );
%! r = adaptive_modulation_sim(params);
%! assert(length(r.snr_db), 8);
%! assert(length(r.ber),    8);

%!test
%! % Test 3: BER is between 0 and 1
%! pkg load communications;
%! params = struct();
%! params.snr_min      = 5;
%! params.snr_max      = 25;
%! params.num_points   = 5;
%! params.symbol_rate  = 1e6;
%! params.is_adaptive  = true;
%! params.target_ber   = 1e-3;
%! params.snr_profile  = 'linear';
%! params.schemes = struct( ...
%!   'display_name',     {'QPSK',  '16QAM'}, ...
%!   'snr_threshold_db', {6,       12},      ...
%!   'base_parameters',  {struct('bits_per_symbol', 2), ...
%!                        struct('bits_per_symbol', 4)} ...
%! );
%! r = adaptive_modulation_sim(params);
%! assert(all(r.ber >= 0 & r.ber <= 1));
%! assert(r.overall_ber >= 0 && r.overall_ber <= 1);

%!test
%! % Test 4: High SNR selects highest modulation scheme
%! pkg load communications;
%! params = struct();
%! params.snr_min      = 25;
%! params.snr_max      = 30;
%! params.num_points   = 5;
%! params.symbol_rate  = 1e6;
%! params.is_adaptive  = true;
%! params.target_ber   = 1e-3;
%! params.snr_profile  = 'linear';
%! params.schemes = struct( ...
%!   'display_name',     {'QPSK',  '16QAM', '64QAM'}, ...
%!   'snr_threshold_db', {6,       12,      18},       ...
%!   'base_parameters',  {struct('bits_per_symbol', 2), ...
%!                        struct('bits_per_symbol', 4), ...
%!                        struct('bits_per_symbol', 6)} ...
%! );
%! r = adaptive_modulation_sim(params);
%! assert(strcmp(r.used_mod{end}, '64QAM'));

%!test
%! % Test 5: Constellation field contains ideal and received
%! pkg load communications;
%! params = struct();
%! params.snr_min      = 10;
%! params.snr_max      = 10;
%! params.num_points   = 1;
%! params.symbol_rate  = 1e6;
%! params.is_adaptive  = true;
%! params.target_ber   = 1e-3;
%! params.snr_profile  = 'linear';
%! params.const_ebn0_db = 10;
%! params.schemes = struct( ...
%!   'display_name',     {'QPSK'}, ...
%!   'snr_threshold_db', {6},      ...
%!   'base_parameters',  {struct('bits_per_symbol', 2)} ...
%! );
%! r = adaptive_modulation_sim(params);
%! assert(isfield(r.constellation, 'ideal'));
%! assert(isfield(r.constellation, 'received'));
%! assert(length(r.constellation.ideal) > 0);

%!test
%! % Test 6: Throughput is positive
%! pkg load communications;
%! params = struct();
%! params.snr_min      = 10;
%! params.snr_max      = 25;
%! params.num_points   = 5;
%! params.symbol_rate  = 1e6;
%! params.is_adaptive  = true;
%! params.target_ber   = 1e-3;
%! params.snr_profile  = 'linear';
%! params.schemes = struct( ...
%!   'display_name',     {'QPSK'}, ...
%!   'snr_threshold_db', {6},      ...
%!   'base_parameters',  {struct('bits_per_symbol', 2)} ...
%! );
%! r = adaptive_modulation_sim(params);
%! assert(all(r.throughput > 0));
%! assert(r.avg_throughput > 0);

%!test
%! % Test 7: Sinusoidal SNR profile runs without error
%! pkg load communications;
%! params = struct();
%! params.snr_min      = 0;
%! params.snr_max      = 30;
%! params.num_points   = 10;
%! params.symbol_rate  = 1e6;
%! params.is_adaptive  = true;
%! params.target_ber   = 1e-3;
%! params.snr_profile  = 'sinusoidal';
%! params.schemes = struct( ...
%!   'display_name',     {'QPSK',  '16QAM'}, ...
%!   'snr_threshold_db', {6,       12},      ...
%!   'base_parameters',  {struct('bits_per_symbol', 2), ...
%!                        struct('bits_per_symbol', 4)} ...
%! );
%! r = adaptive_modulation_sim(params);
%! assert(length(r.snr_db), 10);

%!test
%! % Test 8: Unknown SNR profile falls back to constant SNR of 15
%! pkg load communications;
%! params = struct();
%! params.snr_min      = 0;
%! params.snr_max      = 30;
%! params.num_points   = 5;
%! params.symbol_rate  = 1e6;
%! params.is_adaptive  = true;
%! params.target_ber   = 1e-3;
%! params.snr_profile  = 'unknown_profile';
%! params.schemes = struct( ...
%!   'display_name',     {'QPSK'}, ...
%!   'snr_threshold_db', {6},      ...
%!   'base_parameters',  {struct('bits_per_symbol', 2)} ...
%! );
%! r = adaptive_modulation_sim(params);
%! assert(all(r.snr_db == 15));