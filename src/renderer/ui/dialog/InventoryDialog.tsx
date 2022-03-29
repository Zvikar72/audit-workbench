/* eslint-disable import/no-cycle */
/* eslint-disable jsx-a11y/label-has-associated-control */

import {
  Dialog,
  Paper,
  DialogActions,
  Button,
  makeStyles,
  InputBase,
  Select,
  MenuItem,
  TextareaAutosize,
  TextField,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import AddIcon from '@material-ui/icons/Add';
import React, { useEffect, useState, useContext } from 'react';
import { Alert, Autocomplete } from '@material-ui/lab';
import { Inventory } from '../../../api/types';
import { InventoryForm } from '../../context/types';
import { componentService } from '../../../api/component-service';
import { licenseService } from '../../../api/license-service';
import { DialogContext } from '../../context/DialogProvider';
import { ResponseStatus } from '../../../main/Response';

const useStyles = makeStyles((theme) => ({
  size: {
    '& .MuiDialog-paperWidthMd': {
      width: '700px',
    },
  },
  usageNotes: {
    display: 'grid',
    gridTemplateColumns: '0.75fr 1fr',
    gridGap: '20px',
  },
  componentVersion: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 0.75fr',
    gridGap: '20px',
  },
  search: {
    padding: '10px 0px 10px 10px',
  },
  option: {
    display: 'flex',
    flexDirection: 'column',
    '& span.middle': {
      fontSize: '0.8rem',
      color: '#6c6c6e',
    },
  },
}));

interface InventoryDialogProps {
  open: boolean;
  inventory: Partial<InventoryForm>;
  recentUsedComponents: Array<string>;
  showInfoFilter: boolean;
  onClose: (inventory: Inventory) => void;
  onCancel: () => void;
}

export const InventoryDialog = (props: InventoryDialogProps) => {
  const classes = useStyles();
  const dialogCtrl = useContext<any>(DialogContext);
  const { open, inventory, onClose, onCancel, showInfoFilter, recentUsedComponents } = props;
  const [form, setForm] = useState<Partial<InventoryForm>>(inventory);
  const [components, setComponents] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [licensesAll, setLicensesAll] = useState<any[]>();

  const setDefaults = () => setForm(inventory);

  const init = async () => {
    const componentsResponse = await componentService.getAll({ unique: true });
    const licensesResponse = await licenseService.getAll();
    const compCatalogue = componentsResponse.map((component) => ({ ...component, type: 'Catalogued' }));
    setGlobalComponents(compCatalogue);
    const catalogue = licensesResponse.data.map((item) => ({
      spdxid: item.spdxid,
      name: item.name,
      type: 'Catalogued',
    }));
    setLicensesAll(catalogue);
    setLicenses(catalogue);

    setDefaults();
  };

  const openComponentDialog = async () => {
    const response = await dialogCtrl.openComponentDialog();
    if (response && response.action === ResponseStatus.OK) {
      addCustomComponent(response.data);
    }
  };

  const openComponentVersionDialog = async () => {
    // FIXME: This is a hack to get the component name, should be change component dialog to use spdxid.
    const license = licenses.find((item) => item.spdxid === form.spdxid);

    const response = await dialogCtrl.openComponentDialog(
      { name: form.component, purl: form.purl, url: form.url, license_name: license?.name },
      'Add Version'
    );
    if (response && response.action === ResponseStatus.OK) {
      addCustomComponentVersion(response.data);
    }
  };

  const addCustomComponent = async (component) => {
    const { name, version, licenses, purl, url } = component;
    const comp = await componentService.get({ purl }, { unique: true });
    setGlobalComponents([...components, comp]);

    setLicenses([
      ...licenses,
      { spdxid: component.licenses[0].spdxid, name: component.licenses[0].name, type: 'Catalogued' },
    ]);

    setForm({
      ...form,
      component: name,
      version,
      spdxid: licenses[0].spdxid,
      purl,
      url: url || '',
    });
  };

  const addCustomComponentVersion = async (component) => {
    const { name, version, licenses, purl, url } = component;
    const comp = await componentService.get({ purl: component.purl }, { unique: true });
    const nComponents = components.filter((item) => item.purl !== purl);
    setGlobalComponents([...nComponents, comp]);
    setVersions([version, ...versions]);
    // setLicenses(licenses);

    setForm({
      ...form,
      component: name,
      version,
      spdxid: licenses[0].spdxid,
      purl,
      url: url || '',
    });
  };

  const setGlobalComponents = (components) => {
    let recents = [];
    const nComponents = components.filter((comp) => comp.type !== 'Recents');
    if (recentUsedComponents && recentUsedComponents.length > 0) {
      for (const component of recentUsedComponents) {
        const recent = nComponents
          .filter((item) => item.purl === component)
          .map((comp) => ({ ...comp, type: 'Recents' }));
        recents = [...recents, ...recent];
      }
    }
    setComponents([...recents, ...nComponents]);
  };

  const openLicenseDialog = async () => {
    const response = await dialogCtrl.openLicenseCreate();
    if (response && response.action === ResponseStatus.OK) {
      setLicenses([...licenses, { spdxid: response.data.spdxid, name: response.data.name, type: 'Catalogued' }]);
      setForm({ ...form, spdxid: response.data.spdxid });
    }
  };

  const inputHandler = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const autocompleteHandler = (name, value) => {
    setForm({
      ...form,
      [name]: value,
    });
  };

  const isValid = () => {
    const { version, component, purl, spdxid, usage } = form;
    return spdxid && version && component && purl && usage;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const newInventory: any = form;
    onClose(newInventory);
  };

  useEffect(() => {
    if (open) {
      init();
    }
  }, [open]);

  useEffect(() => {
    const component = components.find((item) => item.purl === form.purl);
    if (component) {
      setVersions(component.versions.map((item) => item.version));
      setForm({ ...form, url: component.url || '', component: component.name, purl: component.purl });
    }
  }, [form.purl]);

  useEffect(() => {
    const lic = components
      .find((item) => item?.purl === form?.purl)
      ?.versions.find((item) => item.version === form.version)
      ?.licenses.map((item) => ({
        spdxid: item.spdxid,
        name: item.name,
        type: 'Matched',
      }));

    if (lic) {
      setLicenses([...lic, ...licensesAll]);
      setForm({ ...form, spdxid: lic[0]?.spdxid });
    }
  }, [form.version]);

  useEffect(() => {
    if (versions && versions[0]) setForm({ ...form, version: versions[0] });
  }, [versions]);

  return (
    <Dialog
      id="InventoryDialog"
      className={`${classes.size} dialog`}
      maxWidth="md"
      scroll="body"
      fullWidth
      open={open}
      onClose={onCancel}
    >
      <span className="dialog-title">{!form.id ? 'Identify Component' : 'Edit Identification'}</span>
      <form onSubmit={onSubmit}>
        <div className="dialog-content">
          {showInfoFilter && (
            <Alert className="" severity="info">
              This action will be applied based on your current filter criteria.
            </Alert>
          )}
          <div className={`${classes.componentVersion} dialog-row`}>
            <div className="dialog-form-field">
              <div className="dialog-form-field-label">
                <label>Component</label>
                <Tooltip title="Add new component">
                  <IconButton color="inherit" size="small" onClick={openComponentDialog}>
                    <AddIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </div>
              <Paper className="dialog-form-field-control">
                <SearchIcon className={classes.search} />
                <Autocomplete
                  fullWidth
                  options={components || []}
                  groupBy={(option) => option?.type}
                  value={{ name: form?.component, purl: form?.purl }}
                  getOptionSelected={(option, value) => option.purl === value.purl}
                  getOptionLabel={(option) => option.name}
                  renderOption={(option) => (
                    <div className={classes.option}>
                      <span>{option.name}</span>
                      <span className="middle">{option.purl}</span>
                    </div>
                  )}
                  disableClearable
                  onChange={(e, value) => autocompleteHandler('purl', value.purl)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      InputProps={{
                        ...params.InputProps,
                        disableUnderline: true,
                        className: 'autocomplete-option',
                      }}
                    />
                  )}
                />
              </Paper>
            </div>

            <div className="dialog-form-field">
              <div className="dialog-form-field-label">
                <label>Version</label>
                <Tooltip title="Add new version">
                  <IconButton color="inherit" size="small" onClick={openComponentVersionDialog}>
                    <AddIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </div>
              <Paper className="dialog-form-field-control">
                <SearchIcon className={classes.search} />
                <Autocomplete
                  fullWidth
                  options={versions || []}
                  value={form?.version || ''}
                  disableClearable
                  onChange={(e, value) => autocompleteHandler('version', value)}
                  renderInput={(params) => (
                    <TextField
                      required
                      {...params}
                      InputProps={{
                        ...params.InputProps,
                        disableUnderline: true,
                        className: 'autocomplete-option',
                      }}
                    />
                  )}
                />
              </Paper>
            </div>
          </div>

          <div className="dialog-row">
            <div className="dialog-form-field">
              <div className="dialog-form-field-label">
                <label>License</label>
                <Tooltip title="Add new license">
                  <IconButton color="inherit" size="small" onClick={openLicenseDialog}>
                    <AddIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </div>
              <Paper className="dialog-form-field-control">
                <SearchIcon className={classes.search} />
                <Autocomplete
                  fullWidth
                  options={licenses || []}
                  groupBy={(option) => option?.type}
                  value={
                    licenses && form.spdxid
                      ? { spdxid: form.spdxid, name: licenses.find((item) => item.spdxid === form.spdxid)?.name }
                      : ''
                  }
                  getOptionSelected={(option: any) => option.spdxid === form.spdxid}
                  getOptionLabel={(option: any) => option.name || option.spdxid}
                  renderOption={(option: any) => (
                    <div className={classes.option}>
                      <span>{option.name}</span>
                      <span className="middle">{option.spdxid}</span>
                    </div>
                  )}
                  filterOptions={(options, params) => {
                    return options.filter(
                      (option) =>
                        option.name.toLowerCase().includes(params.inputValue.toLowerCase()) ||
                        option.spdxid.toLowerCase().includes(params.inputValue.toLowerCase())
                    );
                  }}
                  disableClearable
                  renderInput={(params) => (
                    <TextField
                      required
                      {...params}
                      InputProps={{
                        ...params.InputProps,
                        disableUnderline: true,
                        className: 'autocomplete-option',
                      }}
                    />
                  )}
                  onChange={(e, value) => autocompleteHandler('spdxid', value.spdxid)}
                />
              </Paper>
            </div>
          </div>

          <div className="dialog-row">
            <div className="dialog-form-field">
              <label className="dialog-form-field-label">
                URL <span className="optional">- Optional</span>
              </label>
              <Paper className="dialog-form-field-control">
                <InputBase name="url" fullWidth readOnly value={form?.url} onChange={(e) => inputHandler(e)} />
              </Paper>
            </div>
          </div>

          <div className="dialog-row">
            <div className="dialog-form-field">
              <label className="dialog-form-field-label">PURL</label>
              <Paper className="dialog-form-field-control">
                <InputBase
                  name="purl"
                  fullWidth
                  readOnly
                  value={form?.purl || ''}
                  onChange={(e) => inputHandler(e)}
                  required
                />
              </Paper>
            </div>
          </div>

          <div className={`${classes.usageNotes} dialog-row`}>
            <div className="dialog-form-field">
              <label className="dialog-form-field-label">Usage</label>
              <Paper className="dialog-form-field-control">
                <Select
                  name="usage"
                  fullWidth
                  value={form?.usage || ''}
                  disableUnderline
                  onChange={(e) => inputHandler(e)}
                >
                  <MenuItem value="file">File</MenuItem>
                  <MenuItem value="snippet">Snippet</MenuItem>
                  <MenuItem value="pre-requisite">Pre-requisite</MenuItem>
                </Select>
              </Paper>
            </div>

            <div className="dialog-form-field">
              <label className="dialog-form-field-label">
                Notes <span className="optional">- Optional</span>
              </label>
              <Paper className="dialog-form-field-control">
                <TextareaAutosize
                  name="notes"
                  value={form?.notes || ''}
                  cols={30}
                  rows={8}
                  onChange={(e) => inputHandler(e)}
                />
              </Paper>
            </div>
          </div>
        </div>
        <DialogActions>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="contained" color="secondary" disabled={!isValid()}>
            Identify
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default InventoryDialog;
