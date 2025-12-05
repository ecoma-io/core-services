import { Readable } from 'stream';
import { ILogger } from './logger.interface';

export type FormatLogMessageFn = (
  streamType: 'stdout' | 'stderr',
  message: object
) => {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: object;
};

export class LogHandler {
  constructor(
    private readonly logger: ILogger | undefined,
    private readonly formatLogMessage: FormatLogMessageFn,
    private readonly testEnvId?: string
  ) {}

  createLogConsumer(containerName: string): (stream: Readable) => void {
    return (stream: Readable) => {
      stream.on('data', (line: Buffer) =>
        this.processLine(containerName, 'stdout', line.toString())
      );
      stream.on('err', (line: Buffer) =>
        this.processLine(containerName, 'stderr', line.toString())
      );
    };
  }

  private processLine(
    containerName: string,
    streamType: 'stdout' | 'stderr',
    message: string
  ): void {
    const parsed: Record<string, unknown> = (() => {
      try {
        const r = JSON.parse(message) as unknown;
        if (typeof r === 'object' && r !== null)
          return r as Record<string, unknown>;
        return { msg: String(r) };
      } catch {
        return { msg: message };
      }
    })();

    parsed.container = containerName;
    if (this.testEnvId) parsed.testEnvId = this.testEnvId;

    const entry = this.formatLogMessage(streamType, parsed);

    this.logger?.[entry.level](entry.message);
  }
}

export default LogHandler;
