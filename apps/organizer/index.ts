import { registerRootComponent } from 'expo';

import { App } from './src/App';

// Expo's entry point: registers the root component with the native shell and
// wires Fast Refresh in development. The session store restores any persisted
// login before the first render (see src/lib/session.ts).
registerRootComponent(App);
