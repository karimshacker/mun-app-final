// esbuild `inject` shim: screens are compiled with the classic jsx runtime,
// which references a free `React` identifier. Provide it from the one copy of
// React the server renderer uses, so hooks see a single dispatcher.
import React from 'react';
export { React };
