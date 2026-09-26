// The client is consumed by React Native (Hermes/JSC) and by tooling scripts.
// Declare the small slice of the Node global we read instead of pulling in all
// of @types/node.
declare const process: {
  env: Record<string, string | undefined>;
};
