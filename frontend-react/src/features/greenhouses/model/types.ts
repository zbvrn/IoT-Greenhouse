export type ModalName =
  | 'greenhouse-create'
  | 'greenhouse-edit'
  | 'greenhouse-delete'
  | 'device-create'
  | 'device-add-menu'
  | null;

export type DeviceKind = 'sensor' | 'soil_sensor' | 'actuator' | 'valve' | 'other';
export type DeviceKindFilter = DeviceKind | 'all';
export type DeviceCommand = 'open' | 'close' | 'stop';

export type DeviceUpdatePayload = {
  name: string;
  kind: DeviceKind;
  greenhouseId?: number;
};

export type FieldErrors = {
  name?: string;
  serialNumber?: string;
};

export type SelectOption = {
  value: string;
  label: string;
};
