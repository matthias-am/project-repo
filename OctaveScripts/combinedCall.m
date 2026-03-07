
%  arg_list = argv();
% param_file = arg_list{1};

% pkg load communications;

% % Read params
% params = jsondecode(fileread(param_file));

% is_adaptive = params.is_adaptive;
% target_ber   = params.target_ber;
% snr_profile  = params.snr_profile;

% % Example: generate SNR vector
% if strcmp(snr_profile, 'linear')
%   snr_db_vec = linspace(params.snr_min, params.snr_max, params.num_points);
% elseif strcmp(snr_profile, 'sinusoidal')
%   snr_db_vec = 15 + 10 * sin(2*pi*(1:params.num_points)/50);
% else
%   snr_db_vec = ones(1, params.num_points) * 15; % constant fallback
% end

% % Schemes from params (passed as array of structs)
% schemes = params.schemes;  % assume array of {display_name, snr_threshold_db, bits_per_symbol}

% % Sort schemes by threshold (lowest to highest)
% [~, idx] = sort([schemes.snr_threshold_db]);
% schemes = schemes(idx);

% results = struct();
% results.snr_db = snr_db_vec;
% results.used_mod = cell(1, length(snr_db_vec));
% results.ber = zeros(1, length(snr_db_vec));
% results.throughput = zeros(1, length(snr_db_vec));

% total_bits = 0;
% total_errors = 0;

% for i = 1:length(snr_db_vec)
%   current_snr = snr_db_vec(i);

%   % Find highest modulation that satisfies target BER
%   chosen = schemes(1);  % fallback = lowest
%   for k = length(schemes):-1:1
%     thresh = schemes(k).snr_threshold_db;
%     if current_snr >= thresh
%       chosen = schemes(k);
%       break;
%     end
%   end

%   M = 2 ^ chosen.base_parameters.bits_per_symbol;  % e.g. 4 → QPSK, 16 → 16QAM

%   % Simple Monte-Carlo per point (you can increase iterations)
%   num_symbols = 1e5;  % adjust for accuracy vs speed
%   bits = randi([0 1], 1, num_symbols * log2(M));
%   mod_sig = qammod(bits, M, 'InputType', 'bit', 'UnitAveragePower', true);

%   noisy = awgn(mod_sig, current_snr, 'measured');

%   rx_bits = qamdemod(noisy, M, 'OutputType', 'bit', 'UnitAveragePower', true);

%   errors = sum(bits ~= rx_bits);
%   ber = errors / length(bits);

%   throughput = (1 - ber) * params.symbol_rate * log2(M);  % rough spectral efficiency * symbol rate

%   results.used_mod{i} = chosen.display_name;
%   results.ber(i) = ber;
%   results.throughput(i) = throughput;

%   total_errors += errors;
%   total_bits += length(bits);
% end

% results.overall_ber = total_errors / total_bits;
% results.avg_throughput = mean(results.throughput);

% disp(jsonencode(results));

arg_list = argv();
if length(arg_list) < 1
  error("Missing parameter file argument");
end
param_file = arg_list{1};

params_str = fileread(param_file);
params = jsondecode(params_str);

results = adaptive_modulation_sim(params);

disp(jsonencode(results));
