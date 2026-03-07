function [rx_symbols] = add_awgn(tx_symbols, ebn0_db)
  % tx_symbols: complex vector with unit avg power
  % ebn0_db: Eb/N0 in dB
  EbN0 = 10^(ebn0_db/10);
  sigma = sqrt(1/(2*EbN0));   % noise std dev per real/imag dimension
  noise = sigma * (randn(size(tx_symbols)) + 1j*randn(size(tx_symbols))); %Generage complex and imaginary noise by generating matrixes of random numbers, just for imaginary it's * 1j, sigma scales it by the standard deviation parameter
  rx_symbols = tx_symbols + noise; %add the noise to the signal
end