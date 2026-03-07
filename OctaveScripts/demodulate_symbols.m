function [detected_bits] = demodulate_symbols(rx_symbols, mod_type) %receives complex symbols and mod type, returns detected bits
  % rx_symbols: complex vector
  switch upper(mod_type)
    case 'BPSK'
      detected_bits = real(rx_symbols) > 0; %compares if real part of symbol is greater than 0, 1 (true) 0(false)

    case 'QPSK'
      I = real(rx_symbols) > 0; %demods real part
      Q = imag(rx_symbols) > 0; %demods imaginary part
      detected_bits = [I; Q]; 
      detected_bits = detected_bits(:)';

    case '16QAM'
      pkg load communications; %communications package in octave
      detected_bits = qamdemod(rx_symbols, 16, 'OutputType', 'bit', 'UnitAveragePower', true); %built in qamdemod fx, returns bits of integer symbols for output type and bits, assumes const has uap

    case '64QAM'
      pkg load communications;
      detected_bits = qamdemod(rx_symbols, 64, 'OutputType', 'bit', 'UnitAveragePower', true);

       case '256QAM'
      pkg load communications;
      detected_bits = qamdemod(rx_symbols, 256, 'OutputType', 'bit', 'UnitAveragePower', true);

    case '1024QAM'
      pkg load communications;
      detected_bits = qamdemod(rx_symbols, 1024, 'OutputType', 'bit', 'UnitAveragePower', true);

    otherwise
      error(['Unsupported demodulation: ' mod_type]);
  end
end