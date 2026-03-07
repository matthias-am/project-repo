function [ber] = simulate_ber_monte_carlo(mod_type, EbN0_dB_range, num_bits)
  % mod_type: 'BPSK', 'QPSK', '16QAM', etc.
  % EbN0_dB_range: vector e.g. [0:2:20]
  % num_bits: total bits to simulate per SNR point (e.g. 1e5 or 1e6)

  ber = zeros(1, length(EbN0_dB_range));

  for idx = 1:length(EbN0_dB_range)
    EbN0_dB = EbN0_dB_range(idx);
    EbN0 = 10^(EbN0_dB/10);
    sigma = sqrt(1/(2*EbN0));   % noise std dev (normalized signal energy =1)

    num_errors = 0;
    bits_sent = 0;

    while bits_sent < num_bits
      % Generate random bits
      bits = randi([0 1], 1, min(1e4, num_bits - bits_sent));  % batch size

      if strcmp(mod_type, 'BPSK')
        symbols = 2*bits - 1;                     % +1 / -1
        received = symbols + sigma * (randn(size(symbols)) + 1j*randn(size(symbols)));
        detected_bits = real(received) > 0;
      elseif strcmp(mod_type, 'QPSK')
        % Gray mapping: 00→(1+1j), 01→(-1+1j), 10→(-1-1j), 11→(1-1j) / sqrt(2)
        I = 2*bits(1:2:end) - 1;
        Q = 2*bits(2:2:end) - 1;
        symbols = (I + 1j*Q) / sqrt(2);
        noise = sigma * (randn(size(symbols)) + 1j*randn(size(symbols)));
        received = symbols + noise;
        detected_I = real(received) > 0;
        detected_Q = imag(received) > 0;
        detected_bits = [detected_I; detected_Q];
        detected_bits = detected_bits(:)';
      elseif strcmp(mod_type, '16QAM')
        % Simple Gray-coded 16QAM (normalized avg power ~1)
        % bits → symbols mapping (you can expand this)
        symbols = qammod(bits, 16, 'InputType', 'bit', 'UnitAveragePower', true);
        received = symbols + sigma * (randn(size(symbols)) + 1j*randn(size(symbols)));
        detected_bits = qamdemod(received, 16, 'OutputType', 'bit', 'UnitAveragePower', true);
      else
        error('Unsupported modulation');
      end

      num_errors += sum(bits != detected_bits);
      bits_sent += length(bits);
    end

    ber(idx) = num_errors / bits_sent;
  end
end