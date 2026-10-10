import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Modal as RNModal, ModalProps, Platform, TextInput, View } from 'react-native';

/**
 * Drop-in replacement for React Native's Modal. On Android a modal window is not moved for the
 * keyboard, so the field being typed in can end up underneath it. This finds the focused text field,
 * measures where it really is on screen and raises the whole sheet by exactly what is needed.
 * Nothing changes on iOS (the screens already use KeyboardAvoidingView there).
 */
const GAP = 64;

export const Modal = ({ children, visible, ...rest }: ModalProps) => {
  const [shift, setShift] = useState(0);
  const shiftRef = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = (value: number) => {
    shiftRef.current = value;
    setShift(value);
  };

  const adjust = useCallback(() => {
    if (Platform.OS !== 'android') return;
    // The keyboard can already be open when the sheet appears (e.g. the page's search box): no event fires then
    const top = keyboardTop.current ?? Keyboard.metrics()?.screenY ?? null;
    if (top == null) return;
    keyboardTop.current = top;
    const input = TextInput.State.currentlyFocusedInput?.();
    if (!input) return;
    input.measureInWindow((_x, y, _w, h) => {
      if (keyboardTop.current == null) return;
      const wanted = shiftRef.current + (y + h + GAP - top);
      const next = Math.max(0, Math.round(wanted));
      if (Math.abs(next - shiftRef.current) > 2) apply(next);
    });
  }, []);

  const scheduleAdjust = useCallback(
    (delay: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(adjust, delay);
    },
    [adjust]
  );

  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) return undefined;
    // A keyboard left open by the page behind belongs to a field that is now covered by this sheet
    if (Keyboard.isVisible()) Keyboard.dismiss();
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      scheduleAdjust(60);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      apply(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      if (timer.current) clearTimeout(timer.current);
      keyboardTop.current = null;
      apply(0);
    };
  }, [visible, scheduleAdjust]);

  // Moving from one field to another does not fire a keyboard event: re-check after every touch
  return (
    <RNModal visible={visible} {...rest}>
      <View
        style={{ flex: 1, transform: [{ translateY: -shift }] }}
        onTouchEnd={() => {
          if (Keyboard.isVisible()) scheduleAdjust(220);
        }}
      >
        {children}
      </View>
    </RNModal>
  );
};
