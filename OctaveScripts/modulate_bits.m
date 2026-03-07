function [tx_symbols] = modulate_bits(bits, mod_type)
  % bits: row vector of 0/1
  % mod_type: string 'BPSK', 'QPSK', '16QAM', '64QAM'
  % Returns complex symbols with ~unit average power

  switch upper(mod_type)
    case 'BPSK'
      tx_symbols = 2*bits - 1;                    % -1 / +1

    case 'QPSK'
      % Gray coded, starting at pi/4
      bits_reshaped = reshape(bits, 2, [])';      % [I Q] pairs
      I = 2*bits_reshaped(:,1) - 1;
      Q = 2*bits_reshaped(:,2) - 1;
      tx_symbols = (I + 1j*Q) / sqrt(2);

    case '16QAM'
      pkg load communications;
      tx_symbols = qammod(bits, 16, 'InputType', 'bit', 'UnitAveragePower', true);

    case '64QAM'
      pkg load communications;
      tx_symbols = qammod(bits, 64, 'InputType', 'bit', 'UnitAveragePower', true);

    case '256QAM'
      pkg load communications;
      tx_symbols = qammod(bits, 256, 'InputType', 'bit', 'UnitAveragePower', true);

    case '1024QAM'
      pkg load communications;
      tx_symbols = qammod(bits, 1024, 'InputType', 'bit', 'UnitAveragePower', true);

    otherwise
      error(['Unsupported modulation: ' mod_type]);
  end
end

