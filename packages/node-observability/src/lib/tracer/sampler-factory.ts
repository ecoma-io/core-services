import {
  AlwaysOnSampler,
  AlwaysOffSampler,
  TraceIdRatioBasedSampler,
  ParentBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { Sampler } from '@opentelemetry/sdk-trace-base';

export type SamplerConfig =
  | { type: 'always_on' }
  | { type: 'always_off' }
  | { type: 'traceidratio'; ratio: number }
  | {
      type: 'parentbased';
      root?: {
        type: 'always_on' | 'always_off' | 'traceidratio';
        ratio?: number;
      };
    };

/**
 * Create a Sampler instance from our configuration object.
 * Returns undefined when no config is provided.
 */
export function createSamplerFromConfig(
  config?: SamplerConfig
): Sampler | undefined {
  if (!config) return undefined;

  switch (config.type) {
    case 'always_on':
      return new AlwaysOnSampler();
    case 'always_off':
      return new AlwaysOffSampler();
    case 'traceidratio':
      return new TraceIdRatioBasedSampler(Number(config.ratio) || 0);
    case 'parentbased': {
      const root = config.root;
      let rootSampler: Sampler = new AlwaysOnSampler();
      if (root) {
        if (root.type === 'always_off') rootSampler = new AlwaysOffSampler();
        else if (root.type === 'traceidratio')
          rootSampler = new TraceIdRatioBasedSampler(Number(root.ratio) || 0);
        else rootSampler = new AlwaysOnSampler();
      }
      return new ParentBasedSampler({ root: rootSampler });
    }
    default:
      return undefined;
  }
}

export default { createSamplerFromConfig };
