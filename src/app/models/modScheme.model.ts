export enum ModFamily {
    PSK = 'PSK',
    QAM = 'QAM',
    OFDM = 'OFDM',
    FSK = 'FSK'
}

export interface ModScheme {
    _id?: string;
    schemeId: string;
    name: string;
    family: ModFamily;
    displayName: string;
    baseParameters: Record<string, any>;
    requiredParamNames: string[];
    createdAt: string | Date;
}

export interface CreateModSchemeDto{
    schemeId: string;
    name: string;
    family: ModFamily;
    displayName: string;
    baseParameters?: Record<string, any>;
    requiredParamNames?: string[];
}

export interface UpdateModSchemeDto {
    name?: string;
    displayName?: string;
    baseParameters?: Record<string, any>;
    requiredParamNames?: string[];
}