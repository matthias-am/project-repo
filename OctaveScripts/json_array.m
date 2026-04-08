function s = json_array(arr)
    arr = arr(:).';  % force row
    s = sprintf('%.10g,', arr);
    s(end) = [];     % remove trailing comma
    s = ['[' s ']'];
end