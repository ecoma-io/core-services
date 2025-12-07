import {
  BaseConfigService,
  BaseProcessEnvironment,
} from '@ecoma-io/nestjs-common';

class ProcessEnvironmentValidator extends BaseProcessEnvironment {}

export class AppConfigService extends BaseConfigService<ProcessEnvironmentValidator> {
  constructor() {
    super(ProcessEnvironmentValidator);
  }
}
