const React = require('react');

const SvgMock = (props) => React.createElement('Svg', props, props.children);
SvgMock.Svg = SvgMock;
SvgMock.Path = (props) => React.createElement('Path', props, props.children);
SvgMock.Circle = (props) => React.createElement('Circle', props, props.children);
SvgMock.Rect = (props) => React.createElement('Rect', props, props.children);
SvgMock.Line = (props) => React.createElement('Line', props, props.children);
SvgMock.default = SvgMock;

module.exports = SvgMock;
