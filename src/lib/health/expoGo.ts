import Constants, { ExecutionEnvironment } from 'expo-constants';

/** Expo Go ships without the health libraries, so Bloom mustn't load them there. */
export function inExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}
