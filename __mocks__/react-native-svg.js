const React = require('react');

const make = (name) => (props) => React.createElement(name, props, props.children);

const SvgMock = make('Svg');
SvgMock.Svg = SvgMock;
SvgMock.Path = make('Path');
SvgMock.Circle = make('Circle');
SvgMock.Rect = make('Rect');
SvgMock.Line = make('Line');
SvgMock.Ellipse = make('Ellipse');
SvgMock.G = make('G');
SvgMock.Defs = make('Defs');
SvgMock.Stop = make('Stop');
SvgMock.LinearGradient = make('LinearGradient');
SvgMock.RadialGradient = make('RadialGradient');
SvgMock.default = SvgMock;

module.exports = SvgMock;
