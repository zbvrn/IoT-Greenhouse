export type ModalName =
  | 'greenhouse-create'
  | 'greenhouse-edit'
  | 'greenhouse-delete'
  | 'device-create'
  | 'device-add-menu'
  | null;

export type DeviceKind = 'soil_irrigation' | 'climate_control' | 'other';
export type DeviceComponentRole = 'sensor' | 'actuator' | 'control' | 'standalone';
export type DeviceKindFilter = DeviceKind | 'all';
export type DeviceCommand = 'open' | 'close' | 'stop' | 'off';

export type DeviceUpdatePayload = {
  name: string;
  kind: DeviceKind;
  greenhouseId?: number;
  strokeLength?: number;
  strokeSpeed?: number;
  valveOpenPercent?: number;
  componentRole?: DeviceComponentRole;
  systemId?: string;
  systemName?: string;
};

export type FieldErrors = {
  name?: string;
  serialNumber?: string;
};

export type SelectOption = {
  value: string;
  label: string;
};
