import type { HealthSource } from './source.types';

/** The web build: no health store to read. iPhone and Android have their own files. */
export const healthSource: HealthSource = {
  name: 'Health data',
  offered: true,
  asksForHistory: false,
  status: async () => 'unsupported',
  request: async () => [],
  granted: async () => [],
  countSince: async () => 0,
};
