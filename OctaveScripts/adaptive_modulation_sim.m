function results = adaptive_modulation_sim(params) %takes param structure as input and returns results structure

pkg load communications; %Octave communications package

close all; %closes all open figures (done to prevent the 80 figures mishap from happening again)

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

is_adaptive = params.is_adaptive; %extracts adaptive flag
target_ber   = params.target_ber; 
snr_profile  = params.snr_profile; %Type of SNR variation (linear, sinusoidal)

% Creates SNR values based on profile
if strcmp(snr_profile, 'linear') %evenly spaced
  snr_db_vec = linspace(params.snr_min, params.snr_max, params.num_points);
elseif strcmp(snr_profile, 'sinusoidal')
  snr_db_vec = 15 + 10 * sin(2*pi*(1:params.num_points)/50); %varies sinusoidally around 15dB
else
  snr_db_vec = ones(1, params.num_points) * 15; % constant fallback
end

% Schemes from params (passed as array of structs)
schemes = params.schemes;  % assume array of {display_name, snr_threshold_db, bits_per_symbol}

% Sort schemes by threshold (lowest to highest)
[~, idx] = sort([schemes.snr_threshold_db]);
schemes = schemes(idx);

results = struct(); %results struct with empty fields
results.snr_db = snr_db_vec;
results.used_mod = cell(1, length(snr_db_vec));
results.ber = zeros(1, length(snr_db_vec));
results.throughput = zeros(1, length(snr_db_vec));
% ^pre-allocated arrays
total_bits = 0;
total_errors = 0;

plotted_mods = {}; %tracks which mods already plotted
for i = 1:length(snr_db_vec) %main loop over each SNR point
  current_snr = snr_db_vec(i);

  % Find highest modulation that satisfies target BER
  chosen = schemes(1);  % fallback = lowest
  for k = length(schemes):-1:1
    thresh = schemes(k).snr_threshold_db;
    if current_snr >= thresh
      chosen = schemes(k);
      break; %selects highest mod that meets thresholds, starts from highest
    end
  end

  M = 2 ^ chosen.base_parameters.bits_per_symbol;  % modulation order, 4 → QPSK, 16 → 16QAM etc
bps = int32(log2(M));
  % Simple Monte-Carlo per point 
  num_symbols = 1e5;  % adjust for accuracy vs speed
  bits = randi([0 1], 1, num_symbols * double(bps)); %generates random bits and modulates

if M <= 4
symbols = int32(bi2de(reshape(bits, double(bps), num_symbols)', 'left-msb'));
mod_sig = pskmod(symbols, M); %PSK for lower orders

else
symbols = int32(bi2de(reshape(bits, double(bps), num_symbols, )', 'left-msb'));
mod_sig = qammod(symbols, M); %QAM for higher orders
end


%plots constellation once per mod type
if ~any(strcmp(plotted_mods, chosen.display_name)) 
  plot_constellation(mod_sig, awgn(mod_sig, current_snr, 'measured'), chosen.display_name, current_snr);
  plotted_mods{end+1} = chosen.display_name;
end

noisy =awgn(mod_sig, current_snr, 'measured'); %adds noise to signal

%demodulate recieved signal
if M <= 4
rx_syms = int32(pskdemod(noisy, M));
else
rx_syms = int32(qamdemod(noisy, M));
end

rx_bits = de2bi(rx_syms, double(bps), 'left-msb')';
rx_bits = rx_bits(:)'; %symbols back to bits



  errors = sum(bits ~= rx_bits);
  ber = errors / length(bits); %Calc BER for this SNR point

  throughput = (1 - ber) * params.symbol_rate * log2(M);  % rough spectral efficiency * symbol rate

%stores results for this point
  results.used_mod{i} = chosen.display_name;
  results.ber(i) = ber;
  results.throughput(i) = throughput; 

  total_errors += errors;
  total_bits += length(bits); %overall stats
end

results.overall_ber = total_errors / total_bits; %BER across all points
results.avg_throughput = mean(results.throughput);

snr_linear = 10.^(results.snr_db/10); %SNR db to linear

figure;
hold on;

semilogy(results.snr_db, results.ber, 'k-o', 'LineWidth', 2, 'DisplayName', 'Simulated BER'); %plots sim BER on log (semilogy)

%theoretical BER
ber_bpsk = qfunc(sqrt(2*snr_linear));
semilogy(results.snr_db, ber_bpsk, 'b--', 'LineWidth', 1.5, 'DisplayName', 'BPSK Theoretical');

ber_qpsk = qfunc(sqrt(2*snr_linear));
semilogy(results.snr_db, ber_qpsk, 'r--', 'LineWidth', 1.5, 'DisplayName', 'QPSK Theoretical');

ber_16qam = (3/8)*erfc(sqrt(snr_linear/10));
semilogy(results.snr_db, ber_16qam, 'g--', 'LineWidth', 1.5, 'DisplayName', '16QAM Theoretical');

ber_64qam = (7/24)* erfc(sqrt(snr_linear/42));
semilogy(results.snr_db, ber_64qam, 'm--', 'LineWidth', 1.5, 'DisplayName', '64QAM Theoretical');

ber_256qam = (15/64) * erfc(sqrt(snr_linear/170));
semilogy(results.snr_db, ber_256qam, 'c--', 'LineWidth', 1.5, 'DisplayName', '256QAM Theoretical');

ber_1024qam = (31/160) * erfc(sqrt(snr_linear/682));
semilogy(results.snr_db, ber_1024qam, 'y--', 'LineWidth', 1.5, 'DisplayName', '1024QAM Theoretical');

%BER plot formatting
xlabel('SNR(dB)');
ylabel('Bit Error Rate(BER)');
title('Simulated vs Theoretical BER');
legend('Location', 'southwest');
grid on;
ylim([1e-6 1]);
hold off;

%throughput plot
figure;
plot(results.snr_db, results.throughput, 'm-s', 'LineWidth', 2);
xlabel('SNR (dB)');
ylabel('Throughput (bps)');
title('Throughput vs SNR');
grid on;

endfunction

%function for constellation plotting
function plot_constellation(mod_sig, noisy, mod_name, snr)
figure;

%clean const plot
subplot(1, 2, 1);
plot(real(mod_sig), imag(mod_sig), 'b.', 'MarkerSize', 10);
title(sprintf('%s - Clean', mod_name));
xlabel('In-Phase');
ylabel('Quadrature');
grid on;
axis equal;

%noisy const plot
subplot(1, 2, 2);
plot(real(noisy), imag(noisy), 'r.', 'MarkerSize', 4);
title(sprintf('%s - Noisy (SNR = %.1f dB)', mod_name, snr));
xlabel('In-Phase');
ylabel('Quadrature');
grid on;
axis equal;

%plot title
axes('Position', [0 0.95 1 0.05], 'Visible', 'off');
text(0.5, 0.5, sprintf('Constellation Diagram - %s', mod_name), ... 
'HorizontalAlignment', 'center', ... 
'FontSize', 12, ... 
'FontWeight', 'bold');
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
%! % Test 5: Low SNR selects lowest modulation scheme
%! pkg load communications;
%! params = struct();
%! params.snr_min      = 0;
%! params.snr_max      = 4;
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
%! assert(strcmp(r.used_mod{1}, 'QPSK'));

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

