
source("modFunctions.m");

arg_list = argv(); %command line arg
if length(arg_list) < 3
  printf('{"error":"Usage: monte_carlo_ber MOD_TYPE SNR_RANGE_STR NUM_BITS"}\n'); %if less than 3 args
  exit(1);
end

mod_type     = upper(arg_list{1}); %gets mode type then to uppercase
snr_range_str = arg_list{2}; %gets snr range string
num_bits     = str2num(arg_list{3}); %string to number

snr_range = str2num(strrep(strrep(snr_range_str, '[', ''), ']', '')); 

ber_sim = zeros(1, length(snr_range));   % simulated (Monte Carlo)
ber_theo = zeros(1, length(snr_range));  % theoretical

for i = 1:length(snr_range)
  ebn0_db = snr_range(i);
  ebn0_lin = 10^(ebn0_db/10);

  % Monte Carlo part
  bits = randi([0 1], 1, num_bits);
  tx_symbols = modulate_bits(bits, mod_type);
  rx_symbols = add_awgn(tx_symbols, ebn0_db);
  detected_bits = demodulate_symbols(rx_symbols, mod_type);
  ber_sim(i) = calculate_ber(bits, detected_bits);

  % Theoretical part
  switch mod_type
    case 'BPSK'
      ber_theo(i) = 0.5 * erfc(sqrt(ebn0_lin));
    case 'QPSK'
      ber_theo(i) = 0.5 * erfc(sqrt(ebn0_lin));   % very good approx for Gray QPSK
    case {'16QAM', '64QAM'}
      M = str2num(mod_type(1:end-3));   % 16 or 64
      k = log2(M);
      ber_theo(i) = (4/k) * (1 - 1/sqrt(M)) * 0.5 * erfc( sqrt( (3*k*ebn0_lin)/(M-1) ) );
    otherwise
      ber_theo(i) = NaN;  % not implemented
  end
end

% Output extended JSON
output_struct.mod_type   = mod_type;
output_struct.snr_db     = snr_range;
output_struct.ber_sim    = ber_sim;
output_struct.ber_theo   = ber_theo;
output_struct.num_bits   = num_bits;

printf('%s\n', jsonencode(output_struct));   % requires Octave 7+ or use custom json function