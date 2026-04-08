function [ber] = calculate_ber(bits_sent, bits_received)
  ber = sum(bits_sent ~= bits_received) / length(bits_sent);
end

%!test
%! % Test 1: perfect match
%! bits_sent    = [0 1 0 1 1 0 1 0];
%! bits_received = [0 1 0 1 1 0 1 0];

%! ber = calculate_ber(bits_sent, bits_received);
%1 fprintf('Test 1 - perfect: BER = %.6f  (expected 0)\n', ber);

%!test
%! % Test 2: everything flipped
%! bits_sent    = [0 0 0 0 1 1 1 1];
%! bits_received = [1 1 1 1 0 0 0 0];

%! ber = calculate_ber(bits_sent, bits_received);
%! fprintf('Test 2 - all wrong: BER = %.6f  (expected 1)\n', ber);

%!test
%! % Test 3: realistic small error rate
%! bits_sent =     [0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1];
%! bits_received = [0 1 0 1 1 1 0 0 0 1 0 1 1 1 0 1];   % 4 errors

%! ber = calculate_ber(bits_sent, bits_received);
%! fprintf('Test 3 - partial: BER = %.6f  (expected 0.25)\n', ber);


%!test
%! % Test 4: empty vectors
%! try
    %! ber = calculate_ber([], []);
    %! fprintf('Test 5a - empty: BER = %.6f\n', ber);
%! catch ME
    %! fprintf('Test 5a - empty → error: %s\n', ME.message);
%! end

%! try
    %! ber = calculate_ber([0 1 0], []);
    %! fprintf('Test 5b - length mismatch → ');
%! catch ME
    %!fprintf('caught: %s\n', ME.message);
%! end