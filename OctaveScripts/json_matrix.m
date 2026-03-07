function s = json_matrix(mat)
    if isempty(mat)
        s = '[]';
        return;
    end

    rows = size(mat,1);
    s = '[';

    for k = 1:rows
        row_str = sprintf('%.10g,', mat(k,:));
        row_str(end) = [];
        s = [s '[' row_str ']'];

        if k < rows
            s = [s ','];
        end
    end

    s = [s ']'];
end
