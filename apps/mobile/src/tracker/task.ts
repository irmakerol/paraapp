// Registered at app start (imported from index.ts): iOS can wake the app in the background
// with new locations, before any screen is mounted.
import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { LOCATION_TASK, onLocations } from './recorder';

TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  await onLocations(data.locations);
});
