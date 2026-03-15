export interface Workspace  {
    _id: string;
    name: string;
    owner: string;
    createdAt: string | Date;
}

/*export interface PopulatedWorkspace extends Workspace {
    owner: {
        _id: string;
        username?: string;
        email?: string;
    }
} */