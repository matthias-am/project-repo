function [ber] = calculate_ber(bits_sent, bits_received)
  ber = sum(bits_sent ~= bits_received) / length(bits_sent);
end