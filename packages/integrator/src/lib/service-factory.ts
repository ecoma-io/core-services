import { StartedToxiProxyContainer } from '@testcontainers/toxiproxy';
import { IProxiedService, IService } from './service.interface';

export class ServiceFactory {
  constructor(
    private readonly internalHost: string,
    private readonly enableProxy: boolean,
    private readonly proxy?: StartedToxiProxyContainer
  ) {}

  async createService(
    name: string,
    port: string | number
  ): Promise<IService | IProxiedService> {
    const upstreamPort =
      typeof port === 'number' ? port : parseInt(String(port), 10);

    if (
      !Number.isFinite(upstreamPort) ||
      Number.isNaN(upstreamPort) ||
      upstreamPort <= 0
    ) {
      throw new Error(`Invalid port value: ${String(port)}`);
    }

    if (this.enableProxy && this.proxy) {
      const proxy = await this.proxy.createProxy({
        name,
        upstream: `${this.internalHost}:${upstreamPort}`,
      });
      return {
        host: this.internalHost,
        port: proxy.port,
        addToxic: proxy.instance.addToxic.bind(proxy.instance),
        setEnabled: proxy.setEnabled,
      } as IProxiedService;
    }

    return {
      host: this.internalHost,
      port: upstreamPort,
    } as IService;
  }
}

export default ServiceFactory;
