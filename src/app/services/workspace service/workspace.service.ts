import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

const API = 'http://localhost:5001/api';

export interface Workspace {
  _id: string;
  name: string;
  owner: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private _activeWorkspaceId: string | null = null;

  constructor(private http: HttpClient) {
    this._activeWorkspaceId = localStorage.getItem('workspaceId');
  }

  get activeWorkspaceId(): string | null {
    return this._activeWorkspaceId;
  }

  getMyWorkspaces(): Observable<Workspace[]> {
    return this.http.get<Workspace[]>(`${API}/workspaces/MyWS`);
  }

  createWorkspace(name: string): Observable<Workspace> {
    return this.http.post<Workspace>(`${API}/workspaces`, { name }).pipe(
      tap((ws: any) => this.setActive(ws._id))
    );
  }

  setActive(id: string): void {
    this._activeWorkspaceId = id;
    localStorage.setItem('workspaceId', id);
  }

  // Call on login — loads or creates a default workspace
  ensureWorkspace(): Observable<Workspace[]> {
    return this.getMyWorkspaces().pipe(
      tap((workspaces: Workspace[]) => {
        if (workspaces.length > 0) {
          this.setActive(workspaces[0]._id);
        }
      })
    );
  }
}