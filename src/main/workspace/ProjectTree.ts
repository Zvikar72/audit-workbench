/* eslint-disable max-classes-per-file */
import { EventEmitter } from 'events';
import * as os from 'os';
import { Inventory, Project } from '../../api/types';
// import * as fs from 'fs';
// import * as Filtering from './filtering';
// import { eventNames } from 'process';
/* const aFilter=require('./salida')
 const blist =require('./salida') */
// import * as Emmiter from 'events';

import * as Filtering from './filtering';
import { ScanDb } from '../db/scan_db';

const fs = require('fs');
const path = require('path');

// const { EventEmitter } = require('events');

const cont = 0;

let defaultProject: ProjectTree;

export { defaultProject };

export class ProjectTree extends EventEmitter {
  work_root: string;

  scan_root: string;

  project_name: string;

  banned_list: Filtering.BannedList;

  logical_tree: any;

  results: any;

  scans_db: ScanDb;

  constructor(name: string) {
    super();
    this.work_root = '';
    this.scan_root = '';
    this.project_name = name;
    this.banned_list = new Filtering.BannedList('NoFilter');
    // forces a singleton instance, will be killed in a multiproject domain
    defaultProject = this;
  }

  set_scan_root(root: string) {
    this.scan_root = root;
  }

  set_work_root(root: string) {
    this.work_root = root;
  }

  getScanRoot(): string {
    return this.scan_root;
  }

  getWorkRoot(): string {
    return this.work_root;
  }

  build_tree() {
    this.logical_tree = dirTree(this.scan_root, this.scan_root);
    this.emit('treeBuilt', this.logical_tree);
  }

  loadScanProject(rootOfProject: string) {
    const file = fs.readFileSync(`${rootOfProject}/tree.json`, 'utf8');
    const a = JSON.parse(file);
    this.logical_tree = a.logical_tree;
    this.work_root = a.work_root;
    this.results = a.results;
    this.scan_root = a.scan_root;
    this.scans_db = new ScanDb(rootOfProject);
    this.scans_db.init();
  }

  saveScanProject() {
    const file = fs.writeFileSync(
      `${this.work_root}/tree.json`,
      JSON.stringify(this).toString()
    );
  }

  createScanProject(scanPath: string) {
    const p: Project = {
      work_root: `${getUserHome()}/scanoss-workspace/${path.basename(
        scanPath
      )}`,
      scan_root: scanPath,
      default_components: '',
      default_licenses: '',
    };
    if (!fs.existsSync(`${getUserHome()}/scanoss-workspace`)) {
      fs.mkdirSync(`${getUserHome()}/scanoss-workspace/`);
    }
    if (!fs.existsSync(p.work_root)) {
      fs.mkdirSync(p.work_root);
    }

    this.set_work_root(p.work_root);
    this.set_scan_root(p.scan_root);
    this.scans_db = new ScanDb(p.work_root);
    this.scans_db.init();
  }

  prepare_scan() {
    // const i = 0;
    this.build_tree();
    // apply filters.
  }

  getLogicalTree() {
    return this.logical_tree;
  }

  attachInventory(inv: Inventory) {
    let i: number;
    let files: string[];
    files = inv.files;
    for (i = 0; i < inv.files.length; i += 1) {
      insertInventory(this.logical_tree, files[i], inv);
      insertComponent(this.logical_tree, files[i], inv);
    }
  }

  set_filter_file(pathToFilter: string): boolean {
    this.banned_list.load(pathToFilter);
    return true;
  }

  get_proxy_leaf(leaf: any): any {
    if (leaf.type === 'file') return leaf;

    let j = 0;
    const ret = {
      type: 'folder',
      label: leaf.label,
      inv_count: leaf.inv_count,
      include: leaf.include,
      children: [],
      action: leaf.action,
    };
    ret.children = [];
    const children = [];
    for (j = 0; leaf.children && j < leaf.children.length; j += 1) {
      if (leaf.children[j].type === 'folder') {
        const info = {
          type: 'folder',
          label: leaf.children[j].label,
          inv_count: leaf.children[j].inv_count,
          include: leaf.children[j].include,
          action: leaf.children[j].action,
        };
        children.push(info);
      } else if (leaf.children[j].type === 'file') {
        const info = {
          type: 'file',
          label: leaf.children[j].label,
          inventories: leaf.children[j].inventories,
          include: leaf.children[j].include,
          action: leaf.children[j].action,
        };
        children.push(info);
      }
    }
    Object.assign(ret.children, children);
    return ret;
  }

  exclude_file(pathToExclude: string, recursive: boolean) {
    const a = getLeaf(this.logical_tree, pathToExclude);
    setUseFile(a, false, recursive);
  }

  include_file(pathToInclude: string, recursive: boolean) {
    const a = getLeaf(this.logical_tree, pathToInclude);
    setUseFile(a, true, recursive);
  }
}

/* AUXILIARY FUNCTIONS */
function getLeaf(arbol: any, mypath: string): any {
  let res: string[];
  // eslint-disable-next-line prefer-const
  res = mypath.split('/');
  if (res[0] === '') res.shift();
  if (res[res.length - 1] === '') res.pop();

  if (arbol.label === res[0] && res.length === 1) {
    return arbol;
  }
  const i = 0;
  let j = 0;
  if (arbol.type === 'folder') {
    for (j = 0; j < arbol.children.length; j += 1) {
      if (
        arbol.children[j].type === 'folder' &&
        arbol.children[j].label === res[1]
      ) {
        const newpath = mypath.replace(`${res[0]}/`, '');
        return getLeaf(arbol.children[j], newpath);
      }
      if (
        arbol.children[j].type === 'file' &&
        arbol.children[j].label === res[1]
      ) {
        return arbol.children[j];
      }
    }
  }
}

function setUseFile(tree: any, action: boolean, recursive: boolean) {
  if (tree.type === 'file') tree.include = action;
  else {
    let j = 0;
    tree.include = action;
    if (recursive)
      for (j = 0; j < tree.children.length; j += 1) {
        setUseFile(tree.children[j], action, recursive);
      }
  }
}

function insertInventory(tree: any, mypath: string, inv: Inventory): any {
  let myPathFolders: string[];
  // eslint-disable-next-line prefer-const
  let arbol = tree;
  myPathFolders = mypath.split('/');
  if (myPathFolders[0] === '') myPathFolders.shift();
  let i: number;
  i = 0;

  while (i < myPathFolders.length) {
    let j: number;
    if (!arbol.inventories.includes(inv.id)) arbol.inventories.push(inv.id);
    // console.log(`busco ${myPathFolders[i]}`);
    for (j = 0; j < arbol.children.length; j += 1) {
      if (arbol.children[j].label === myPathFolders[i]) {
        arbol = arbol.children[j];
        i += 1;
        break;
      }
    }
  }

  arbol.inventories.push(inv.id);
}
// 4= arr.some(e => e.name === obj.name);
function insertComponent(tree: any, mypath: string, inv: Inventory): any {
  let myPathFolders: string[];
  // eslint-disable-next-line prefer-const
  let arbol = tree;
  myPathFolders = mypath.split('/');
  if (myPathFolders[0] === '') myPathFolders.shift();
  let i: number;
  i = 0;
  const component = { purl: inv.purl, version: inv.version };
  while (i < myPathFolders.length) {
    let j: number;
    //  if (!arbol.components.includes(component)) arbol.components.push(component);
    if (
      !arbol.components.some(
        (e) => e.purl === component.purl && e.version === component.version
      )
    )
      arbol.components.push(component);

    // console.log(`busco ${myPathFolders[i]}`);
    for (j = 0; j < arbol.children.length; j += 1) {
      if (arbol.children[j].label === myPathFolders[i]) {
        arbol = arbol.children[j];
        i += 1;
        break;
      }
    }
  }

  arbol.components.push(component);
  // console.log(arbol);
}

function recurseJSON(jsonScan: any, banned_list: Filtering.BannedList): any {
  let i = 0;
  if (jsonScan.type === 'file') {
    if (banned_list.evaluate(jsonScan.path)) {
      jsonScan.action = 'scan';
    } else {
      jsonScan.action = 'filter';
    }
  } else if (jsonScan.type === 'folder') {
    for (i = 0; i < jsonScan.children.length; i += 1)
      recurseJSON(jsonScan.children[i], banned_list);
  }
}
function prepareScan(jsonScan: any, bannedList: Filtering.BannedList) {
  let i = 0;
  // console.log
  if (jsonScan.type === 'file') {
    if (bannedList.evaluate(jsonScan.path)) {
      jsonScan.action = 'scan';
      //  console.log("scan->"+jsonScan.path)
    } else {
      // console.log("filter->"+jsonScan.name)
      jsonScan.action = 'filter';
    }
  } else if (jsonScan.type === 'folder') {
    for (i = 0; i < jsonScan.children.length; i += 1)
      prepareScan(jsonScan.children[i], bannedList);
  }
}

function dirTree(root: string, filename: string) {
  // console.log(filename)
  const stats = fs.lstatSync(filename);
  let info;

  if (stats.isDirectory()) {
    info = {
      type: 'folder',
      value: filename.replace(root, ''),
      label: path.basename(filename),
      inventories: [],
      components: [],
      children: undefined,
      include: true,
      action: 'scan',
    };

    info.children = fs.readdirSync(filename).map(function (child: string) {
      return dirTree(root, `${filename}/${child}`);
    });
  } else {
    info = {
      type: 'file',
      inv_count: 0,
      value: filename.replace(root, ''),
      label: path.basename(filename),
      inventories: [],
      components: [],
      include: true,
      action: 'scan',
    };
  }
  return info;
}

function getUserHome() {
  // Return the value using process.env
  return os.homedir(); // process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'];
}
