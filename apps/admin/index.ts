import { registerRootComponent } from 'expo';

import { App } from './src/App';

// Expo's entry point for the IT admin app. Session restore happens in the
// app shell before the first render (see src/lib/session.ts).
registerRootComponent(App);
