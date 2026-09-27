/**
 * Web stand-in for react-native-safe-area-context used only by the preview
 * harness: static headless renders have no notch or home indicator, so the
 * insets are all zero. esbuild aliases the real package to this shim inside
 * the bundles; render.mjs imports the provider directly.
 */
import React from 'react';

const ZERO = { top: 0, bottom: 0, left: 0, right: 0 };
const Context = React.createContext(ZERO);

export function SafeAreaProvider({ children }) {
  return React.createElement(Context.Provider, { value: ZERO }, children);
}

export function useSafeAreaInsets() {
  return React.useContext(Context);
}

export function SafeAreaView({ style, children, ...rest }) {
  return React.createElement(
    // react-native-web resolves through the harness's normal alias path.
    require('react-native-web').View,
    { style, ...rest },
    children,
  );
}
