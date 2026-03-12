export interface SimConfig {
    _id?: string;
    config_id: string;
    workspace_id: string;
    owner_id: string;
    scheme_id: string;
    name: string;
    description?: string;
    parameters: Record<string, any>;

    is_adaptive: boolean;
    adaptive_settings: Record<string, any>;
    target_ber: number;

    parent_config_id: string | null;
    is_template: boolean;

    created_at: string | Date;
    last_modified: string | Date;
}

export interface PopulatedSimConfig {
    _id?: string;
    config_id: string,
    workspace_id: {
        _id: string;
        name: string;
    };
    owner_id: {
        _id: string;
        username?: string;
        email?: string;
    };
    scheme_id: {
        _id: string;
        name: string;
        family?: 'PSK' | 'QAM' | 'OFDM' | 'FSK';
        display_name?: string;
        base_parameters?: Record<string, any>;
    };
    name: string;
    description?: string;
    parameters: Record<string, any>;

    is_adaptive: boolean;
    adaptive_settings: Record<string, any>;
    target_ber: number;

    parent_config_id: string | null;
    is_template: boolean;

    created_at: string | Date;
    last_modified: string | Date;
}

export interface CreateSimConfigDto {
    workspace_id: string;
    scheme_id: string;
    name: string;
    description?: string;
    parameters: Record<string, any>;

    is_adaptive?: boolean;
    adaptive_settings?: Record<string, any>;
    target_ber?: number;

    is_template?: boolean;
}

export interface UpdateSimConfigDto {
name?: string;
parameters?: Record<string, any>;

is_adaptive?: boolean;
adaptive_settings?: Record<string, any>;
target_ber?: number;

parent_config_id?: string | null;
is_template?: boolean;
}