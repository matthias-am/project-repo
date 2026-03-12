export interface SimRun {
    _id: string;
    configId: string;
    executor: string;
    status: SimRunStatus;
    results: Record<string, any>;
    errorLog?: string;
    startedAt?: string | Date;
    completedAt?: string | Date;
    createdAt: string | Date;
    workspaceId: string;
}

export enum SimRunStatus {
    PENDING =  'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export interface PopulatedSimRun {
    _id: string;
    configId: {
        _id: string;
        name?: string;
        scheme_id: string;
        parameters?: Record<string, any>;
    };
executor: {
    _id: string;
    username?: string;
    email?: string;
};
status: SimRunStatus;
results: Record<string, any>;
adaptive_summary: Record<string, any>;
errorLog?: string;
startedAt?: string | Date;
completedAt?: string | Date;
createdAt: string | Date;
workspaceId: {
    _id: string;
    name: string;
    owner?: string;
};
}