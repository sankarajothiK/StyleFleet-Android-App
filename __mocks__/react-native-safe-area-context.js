const React = require('react');

module.exports = {
  SafeAreaView: ({ children, style }) => React.createElement('SafeAreaView', { style }, children),
  SafeAreaProvider: ({ children }) => React.createElement('SafeAreaProvider', null, children),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
};
