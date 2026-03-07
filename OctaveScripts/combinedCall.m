% Computes BER curve (sim + theo) + constellation at one SNR point
% Called from Node.js like:
% octave-cli --no-gui -q full_mod_analysis.m "QPSK" "[0 2 4 6 8 10 12]" 100000 8 4000

% to read functions in the samr folder like modulate_bits etc
current_file = mfilename("fullpath");
[current_dir, ~, ~] = fileparts(current_file);
addpath(current_dir);


arg_list = argv(); %gets command line argumentss passed to script
if length(arg_list) < 5 
  printf('{"error":"Usage: full_mod_analysis MOD_TYPE SNR_RANGE_STR NUM_BITS CONST_EBN0_DB NUM_SYMBOLS"}\n');
  exit(1); %prints this msg if less than 5 args provided
end

mod_type         = upper(arg_list{1}); %gets mod type and converts to uppercase
snr_range_str    = arg_list{2}; %gets snr range string
num_bits         = str2num(arg_list{3}); %convers num of bits from string to number
const_ebn0_db    = str2double(arg_list{4}); %converts constant eb/no for const plot
num_symbols      = str2num(arg_list{5}); %conv no of symbols for const

% Parse SNR range vector, remove brackets and convert to num array
snr_range = str2num(strrep(strrep(snr_range_str, '[', ''), ']', ''));

%  BER curve (Monte-Carlo + theoretical)
ber_sim  = zeros(1, length(snr_range));
ber_theo = zeros(1, length(snr_range));

for i = 1:length(snr_range)
  ebn0_db = snr_range(i);
  ebn0_lin = 10^(ebn0_db / 10); %db to linear scale

  % Monte-Carlo simulation
  bits = randi([0 1], 1, num_bits); %generates random bits
  tx_symbols = modulate_bits(bits, mod_type); %modulates bits to symbols
  rx_symbols = add_awgn(tx_symbols, ebn0_db); %adds awgn noise
  detected_bits = demodulate_symbols(rx_symbols, mod_type); %demods received smbyols
  ber_sim(i) = calculate_ber(bits, detected_bits); %sim BER calc

  % Theoretical BER 
  switch mod_type
    case 'BPSK'
      ber_theo(i) = 0.5 * erfc(sqrt(ebn0_lin));
    case 'QPSK'
      ber_theo(i) = 0.5 * erfc(sqrt(ebn0_lin));  % good approximation for Gray-coded QPSK
    case {'16QAM', '64QAM'}
      M = str2num(mod_type(1:end-3));  % extract 16 or 64
      k = log2(M);
      ber_theo(i) = (4 / k) * (1 - 1/sqrt(M)) * 0.5 * erfc(sqrt((3 * k * ebn0_lin) / (M - 1)));
    otherwise
      ber_theo(i) = NaN;  % fallback
  end
end

% Determine constellation order M
switch mod_type
  case 'BPSK'    M = 2;
  case 'QPSK'    M = 4;
  case '16QAM'   M = 16;
  case '64QAM'   M = 64;
  otherwise      error('Unsupported modulation for constellation');
end

% Generate ideal constellation points (one per symbol)
ideal_indices = 0:(M-1);
% Create bit vectors for each symbol (log2(M) bits each)
bits_per_sym = log2(M);
ideal_bits_matrix = zeros(length(ideal_indices), bits_per_sym);

for k = 1:bits_per_sym
    ideal_bits_matrix(:, k) = bitget(ideal_indices, bits_per_sym - k + 1);
end

ideal_bits = reshape(ideal_bits_matrix', 1, []);  % flattened row vector
ideal_symbols = modulate_bits(ideal_bits, mod_type);

% Simulate noisy received symbols at the chosen SNR
bits_total = num_symbols * bits_per_sym;
bits = randi([0 1], 1, bits_total);
tx_symbols = modulate_bits(bits, mod_type);
rx_symbols = add_awgn(tx_symbols, const_ebn0_db);

% Limit output size to avoid huge JSON
max_plot_points = 3000;
if num_symbols > max_plot_points
  rx_symbols = rx_symbols(1:max_plot_points);
end

% Convert to simple arrays of structs for JSON
ideal_mat = [real(ideal_symbols(:)) imag(ideal_symbols(:))];
noisy_mat = [real(rx_symbols(:)) imag(rx_symbols(:))];

ideal_mat = [real(ideal_symbols(:)) imag(ideal_symbols(:))];
noisy_mat = [real(rx_symbols(:)) imag(rx_symbols(:))];


%boy oh boy (JSON output), builds JSON string with all results
json_str = sprintf('{"mod_type":"%s","snr_db":%s,"ber_sim":%s,"ber_theo":%s,"num_bits":%d,"constellation":{"ebn0_db":%.1f,"num_symbols":%d,"ideal":%s,"received":%s}}', ...
    mod_type, ...
    json_array(snr_range), ...
    json_array(ber_sim), ...
    json_array(ber_theo), ...
    num_bits, ...
    const_ebn0_db, ...
    num_symbols, ...
    json_array(ideal_mat(:)), ...
    json_array(noisy_mat(:))
);

printf('%s\n', json_str);

