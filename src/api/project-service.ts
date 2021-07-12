import { IpcEvents } from '../ipc-events';
import { Project } from './types';

const { ipcRenderer } = require('electron');

class ProjectService {
  public async get(args: Partial<Project>): Promise<any> {
    const response = await ipcRenderer.invoke(IpcEvents.INVENTORY_GET, args);
    return response;
  }

  public async create(project: Project): Promise<any> {
    const response = await ipcRenderer.invoke(
      IpcEvents.PROJECT_CREATE_SCAN,
      project
    );
    return response;
  }

  public async load(path: string): Promise<any> {
    const response = await ipcRenderer.invoke(
      IpcEvents.PROJECT_LOAD_SCAN,
      path
    );
    return response;
  }
}

export const projectService = new ProjectService();
