import log from "electron-log";
import { app } from 'electron';
import fs from 'fs';
import os from 'os';
import { IWorkspaceCfg } from '../../api/types';
import { wsUtils } from '../workspace/WsUtils/WsUtils';

import packageJson from '../../../release/app/package.json';
import AppConfig from '../../config/AppConfigModule';
import { AppI18n } from '../../shared/i18n';
import { WorkspaceMigration } from '../migration/WorkspaceMigration';

class UserSettingService {
  private myPath: string;

  private name: string;

  private store: IWorkspaceCfg;

  private defaultStore: IWorkspaceCfg = {
    TOKEN: null,
    DEFAULT_API_INDEX: 0,
    APIS: [
      {
        URL: `${AppConfig.API_URL}`,
        API_KEY: `${AppConfig.API_KEY}`,
        DESCRIPTION: null,
      },
    ],
    SCAN_MODE: 'FULL_SCAN',
    VERSION: app.isPackaged === true ? app.getVersion() : packageJson.version,
    LNG: 'en',
    PROXY: null,
    CA_CERT: null,
    IGNORE_CERT_ERRORS: null,
    PAC: null,
    SCANNER_CONCURRENCY_LIMIT: null,
    SCANNER_POST_SIZE: null,
    SCANNER_TIMEOUT: null,
  };

  constructor() {
    this.name = 'workspaceCfg.json';
    this.store = this.defaultStore;
  }

  public set(setting: Partial<IWorkspaceCfg>) {
    if (setting.LNG !== this.store.LNG)
      AppI18n.getI18n().changeLanguage(setting.LNG);

    this.store = { ...this.store, ...setting };

    return this.store;
  }

  public setSetting(key: string, value: any) {
    this.store[key] = value;
  }

  public get(): Partial<IWorkspaceCfg> {
    return JSON.parse(JSON.stringify(this.store));
  }

  public getSetting(key: string) {
    const setting = { key: this.store[key] } as Partial<IWorkspaceCfg>;
    return setting;
  }

  public getDefault(): IWorkspaceCfg {
    return this.defaultStore;
  }

  public async read(path: string) {
    try {
      this.setMyPath(path);
      if (!(await wsUtils.fileExist(`${this.myPath}/${this.name}`)))
        await this.save();
      const setting = await fs.promises.readFile(
        `${this.myPath}/${this.name}`,
        'utf8'
      );
      this.store =  {...this.store,...JSON.parse(setting)};

      const root = `${os.homedir()}/${AppConfig.DEFAULT_WORKSPACE_NAME}`;
      await new WorkspaceMigration(this.get().VERSION, root).up();
    } catch(error:any) {
      log.error("[ WORKSPACE CONFIG ]:", "Invalid workspace configuration");
      const ws =  await fs.promises.readFile(
        `${this.myPath}/${this.name}`,
        'utf8'
      );
      await fs.promises.writeFile(`${this.myPath}/workspaceCfg-invalid.json`,ws);
      this.store = this.defaultStore;
    }
  }

  public async update(): Promise<void> {
    this.store.APIS[0] = {
      URL: `${AppConfig.API_URL}`,
      API_KEY: `${AppConfig.API_KEY}`,
      DESCRIPTION: '',
    };
    await this.save();
  }

  public async save() {
    await fs.promises.writeFile(
      `${this.myPath}/${this.name}`,
      JSON.stringify(this.store, (key, value) => {
        if (value === null) return undefined;
        return value;
      }, 2),
      'utf8',
    );
  }

  public setMyPath(path: string) {
    this.myPath = path;
  }
}

export const userSettingService = new UserSettingService();
