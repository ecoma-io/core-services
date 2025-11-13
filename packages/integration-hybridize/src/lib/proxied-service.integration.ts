export interface Service {
  host: string;
  port: number;
}

export interface ProxiedService extends Service {
  addToxic: (
    name: string,
    type: string,
    attributes: Record<string, unknown>,
    stream?: 'upstream' | 'downstream'
  ) => Promise<unknown>;
  setEnabled: (enabled: boolean) => Promise<unknown>;
}
