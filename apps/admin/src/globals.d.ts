// React Native runtime globals. Declared locally rather than pulling in all
// of @types/node, which would conflict with the Hermes/Expo typings.
declare const process: {
  env: Record<string, string | undefined>;
};
