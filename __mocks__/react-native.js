module.exports = {
  Platform: {
    OS: 'android',
    select: (objs) => (objs.android !== undefined ? objs.android : objs.default),
  },
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => (Array.isArray(style) ? Object.assign({}, ...style) : style || {}),
  },
  Text: {
    defaultProps: {},
  },
  TextInput: {
    defaultProps: {},
  },
  View: 'View',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
  Linking: {
    openURL: jest.fn(() => Promise.resolve()),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
    getInitialURL: jest.fn(() => Promise.resolve(null)),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
};
