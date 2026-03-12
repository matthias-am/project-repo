export enum AuditEntityType {
    CONFIG = 'config',
    RUN = 'run',
    WORKSPACE = 'workspace'
}

export enum AuditAction {
    CREATE = 'create',
    UPDATE = 'update',
    EXECUTE = 'execute',
    FAILED = 'failed',
    SHARE = 'share',
    DELETE = 'delete'
}

export interface AuditLog {
    _id?: string;
    logId: string;
    userId: string;
    workspaceId: string;
    configId?: string;
    entityType: AuditEntityType;
    entityId: String;
    action: AuditAction;
    details: Record<string, any>;
    timestamp: string | Date;
}

export interface PopulatedAuditLog {
    _id?: string;
    logId: string;
    userId: {
        _id: string;
        username: string;
        email?: string;
    };
    workspaceId: {
        _id: string;
        name: string;
    } | null;
    entityType: AuditEntityType;
    entityId: string;
    action: AuditAction;
    details: Record<string, any>;
    timestamp: string | Date;
}