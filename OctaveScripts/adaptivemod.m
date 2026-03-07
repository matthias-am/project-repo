%adaptive mod scripts, call from Octaveservice
function results = adaptivemod(snr_min, snr_max, num_symbols, block_size, symbol_rate)

pkg load communications;

mod_schemes = struct(...
'QPSK', struct('order', 4, 'threshold', 6), ...
'QAM16', struct('order', 16, 'threshold', 12), ...
'QAM64', struct('order', 64, 'threshold', 18), ...
'QAM256', struct('order', 256, 'threshold', 24)...
%'QAM1024', struct('order', 1024, 'threshold', 30)...
);

snr_vec = linspace(snr_min, snr_max, num_symbols);

total_bits = 0;
total_errors = 0;

for i = 1:block_size:num_symbols
block_snr = snr_vec(i);

chosen_mod = 'QPSK';
for mod_name = fieldnames(mod_schemes)'
if block_snr >= mod_schemes.(mod_name{1}).threshold
chosen_mod = mod_name{1};
end
end

M = mod_schemes.(chosen_mod).order;

bps = int32(log2(M));
num_symbols_per_block = block_size;
bits = randi([0 1], 1, num_symbols_per_block * double(bps));
symbols = int32(bi2de(reshape(bits, double(bps), num_symbols_per_block )', 'left-msb'));


%mod_sig = pskmod(bits, M, pi/M);
if M <= 4
mod_sig = pskmod(symbols, M);
else
mod_sig = qammod(symbols, M);
end

noisy = awgn(mod_sig, block_snr, 'measured');
%rx_bits = pskdemod(noisy, M, pi/M);
if M <= 4
rx_syms = int32(pskdemod(noisy, M));
else
rx_syms = int32(qamdemod(noisy, M));
end
rx_bits = de2bi(rx_syms, double(bps), 'left-msb')';
rx_bits = rx_bits(:)';

errors = sum(bits ~= rx_bits);
total_errors += errors;
total_bits += length(bits);
end

ber = total_errors / total_bits;
throughput = (total_bits - total_errors) / (num_symbols/symbol_rate);

results = struct('ber', ber, 'throughput', throughput, 'mod_scheme', chosen_mod);

%json_str = jsonencode(results);
%disp(json_str);
endfunction


%!test
%! % Test 1: High SNR → highest modulation selected, low BER
%! pkg load communications;

%! r = adaptivemod(26, 28, 100, 10, 1e6);
%! assert(strcmp(r.mod_scheme, 'QAM256'));
%! assert(r.ber < 0.2);

%!test
%! % Test 2: Low SNR → QPSK selected
%! pkg load communications;
%! r = adaptivemod(0, 4, 100, 10, 1e6);
%! assert(strcmp(r.mod_scheme, 'QPSK'));

%!test
%! % Test 3: Output fields exist
%! pkg load communications;
%! r = adaptivemod(10, 20, 50, 10, 1e6);
%! assert(isfield(r, 'ber'));
%! assert(isfield(r, 'throughput'));
%! assert(isfield(r, 'mod_scheme'));

%!test
%! % Test 4: BER is between 0 and 1
%! pkg load communications;

%! r = adaptivemod(5, 25, 100, 10, 1e6);
%! assert(r.ber >= 0 && r.ber <= 1);

%!test
%! % Test 5: Throughput is positive
%! pkg load communications;
%! r = adaptivemod(10, 25, 100, 10, 1e6);
%! assert(r.throughput > 0);