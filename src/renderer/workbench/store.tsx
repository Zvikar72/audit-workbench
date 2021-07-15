import React, { useEffect, useState } from 'react';
import { workbenchController } from '../workbench-controller';
import { AppContext } from '../context/AppProvider';
import { Inventory } from '../../api/types';
import { inventoryService } from '../../api/inventory-service';
import * as scanUtil from '../../utils/scan-util';
import { componentService } from '../../api/component-service';
import reducer, { initialState, State } from './reducers';
import { loadScanSuccess, setComponent } from './actions';

export interface IWorkbenchContext {
  loadScan: (path: string) => Promise<boolean>;
  createInventory: (inventory: Inventory) => Promise<Inventory>;

  state: State;
  dispatch: any;
}

export const WorkbenchContext = React.createContext<IWorkbenchContext | null>(null);

export const WorkbenchProvider: React.FC = ({ children }) => {
  const { setScanBasePath } = React.useContext<any>(AppContext);
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const { scan, tree, file, component } = state;

  const loadScan = async (path: string) => {
    try {
      const { scan, fileTree, components, scanRoot } = await workbenchController.loadScan(path);
      dispatch(loadScanSuccess(scan, fileTree, components));
      setScanBasePath(scanRoot);

      // const { status, data } = await componentService.get({});
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const createInventory = async (inventory: Inventory): Promise<Inventory> => {
    const { status, data } = await inventoryService.create(inventory);
    const components = await workbenchController.getComponents();
    if (component) {
      const updateComponent = components.find((com) =>
        component.purl == com.purl && component.version == com.version
      );
      dispatch(setComponent(updateComponent));
    }

    dispatch(loadScanSuccess(scan, tree, components)); //TODO: Create action

    return data;
  };

  return (
    <WorkbenchContext.Provider
      value={{
        state,
        dispatch,

        loadScan,
        createInventory,
      }}
    >
      {children}
    </WorkbenchContext.Provider>
  );
};

export default WorkbenchProvider;
