
source("modFunctions.m");


arg_list = argv(); %gets command line arguments
if length(arg_list) < 3 %atleast 3 args
  printf('{"error":"Usage: constellation_diagram MOD_TYPE EBN0_DB NUM_SYMBOLS"}\n');
  exit(1);
end

mod_type     = upper(arg_list{1});
ebn0_db      = str2double(arg_list{2});
num_symbols  = str2num(arg_list{3});

% Generate ideal constellation (one symbol per possible combination)
switch mod_type
  case 'BPSK'     M = 2;
  case 'QPSK'     M = 4;
  case '16QAM'    M = 16;
  case '64QAM'    M = 64;
  otherwise       error('Unsupported');
end

ideal_indices = 0:(M-1); %creates array of symbol indices
ideal_bits = de2bi(ideal_indices, log2(M), 'left-msb')(:)';  % flattened bit vector, each index to binary bits
ideal_symbols = modulate_bits(ideal_bits, mod_type); %modulates bits to create ideal const points

% Simulate noisy symbols
bits = randi([0 1], 1, num_symbols * log2(M)); %generates random bits for num of symbols
tx_symbols = modulate_bits(bits, mod_type); %modulates the random bits into symbols
rx_symbols = add_awgn(tx_symbols, ebn0_db); %Adds AWGN noise to simulate channel affects

% Limit noisy points for output size
max_points = 3000;
if num_symbols > max_points
  rx_symbols = rx_symbols(1:max_points); %if too many sybols requested, then first 3000 points so no huge JSON
end

% Build JSON output
ideal_pts = arrayfun(@(s) sprintf('{"r":%.4f,"i":%.4f}', real(s), imag(s)), ideal_symbols, 'UniformOutput', false); %array of JSON objects for each ideal const
noisy_pts = arrayfun(@(s) sprintf('{"r":%.4f,"i":%.4f}', real(s), imag(s)), rx_symbols,   'UniformOutput', false); %same array for noise received symbols

%print JSON string
printf('{"mod_type":"%s","ebn0_db":%.1f,"num_symbols":%d,"ideal":[%s],"received":[%s]}\n', ...
       mod_type, ebn0_db, num_symbols, strjoin(ideal_pts, ','), strjoin(noisy_pts, ',')); %joins with commas to form a JSON array