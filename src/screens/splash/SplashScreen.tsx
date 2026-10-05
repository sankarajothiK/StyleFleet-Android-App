import React, { Component, ReactNode, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../../theme/ThemeContext';

interface SplashScreenProps {
  onFinish: () => void;
  isReady?: boolean;
}

// Error boundary to gracefully catch any native video module issue
class VideoErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Video playback unavailable, proceeding directly:', error);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

const IntroVideoPlayer: React.FC<{ onEnd: () => void }> = ({ onEnd }) => {
  const [hasEnded, setHasEnded] = useState(false);
  const endedRef = useRef(false);
  const videoSource = require('../../../assets/intro_video.mp4');

  const player = useVideoPlayer(videoSource, (p) => {
    try {
      p.loop = false;
      p.play();
    } catch {
      // player initialization error guard
    }
  });

  const triggerEnd = useRef(() => {
    if (!endedRef.current) {
      endedRef.current = true;
      setHasEnded(true);
      onEnd();
    }
  }).current;

  useEffect(() => {
    let subEnd: any;
    let subStatus: any;
    try {
      subEnd = player.addListener('playToEnd', () => {
        triggerEnd();
      });
      subStatus = player.addListener('statusChange', ({ status, error }) => {
        if (status === 'error' || error) {
          triggerEnd();
        }
      });
    } catch {
      triggerEnd();
    }

    return () => {
      try {
        subEnd?.remove();
        subStatus?.remove();
      } catch {
        // ignore cleanup error
      }
    };
  }, [player, triggerEnd]);

  if (hasEnded) {
    return null;
  }

  return (
    <VideoView
      style={StyleSheet.absoluteFill}
      player={player}
      nativeControls={false}
      contentFit="cover"
    />
  );
};

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, isReady = false }) => {
  const { colors } = useTheme();
  const [videoFinished, setVideoFinished] = useState(false);
  const finishedRef = useRef(false);

  const attemptFinish = () => {
    if (!finishedRef.current && isReady) {
      finishedRef.current = true;
      onFinish();
    }
  };

  const onVideoEnded = () => {
    setVideoFinished(true);
  };

  // When BOTH video has ended AND session determination is ready, proceed to destination
  useEffect(() => {
    if (videoFinished && isReady) {
      attemptFinish();
    }
  }, [videoFinished, isReady]);

  // Safety fallback timer: after 2.5s allow finish as soon as isReady is true
  useEffect(() => {
    const timeout = setTimeout(() => {
      setVideoFinished(true);
    }, 2500);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {!videoFinished && (
        <VideoErrorBoundary onError={() => setVideoFinished(true)}>
          <IntroVideoPlayer onEnd={onVideoEnded} />
        </VideoErrorBoundary>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
