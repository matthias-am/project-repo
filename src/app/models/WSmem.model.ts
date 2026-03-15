export enum WorkspaceRole {
    OWNER = 'owner',
    EDITOR = 'editor',
    VIEWER = 'viewer'
}

export interface WorkspaceMember {
    _id?: string;
    workspace_id: string;
    user_Id: string;
    role: WorkspaceRole;
    joined_at: string | Date;
    createdAt?: string | Date;
    updatedAt?: string | Date;
}