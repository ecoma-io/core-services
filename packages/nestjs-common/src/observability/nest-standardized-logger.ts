import {
  StandardizedLoggerConfig,
  StandardizedLogger,
} from '@ecoma-io/node-observability';
import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class NestStandardizedLogger
  extends StandardizedLogger
  implements LoggerService
{
  /**
   * Initialize the logger with config, including redact keys.
   * @param config - Logger config
   */
  public static initialize(config: StandardizedLoggerConfig) {
    StandardizedLogger.initialize(config);
  }

  public static shutdown() {
    return StandardizedLogger.shutdown();
  }
}
