import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { CASHFREE_ENV } from '../../repositories/subscriptionRepository';

interface CashfreeCheckoutModalProps {
  visible: boolean;
  onClose: () => void;
  paymentSessionId: string;
  orderId: string;
  planName: string;
  amount: number;
  onPaymentFinished: (orderId: string) => void;
}

export const CashfreeCheckoutModal: React.FC<CashfreeCheckoutModalProps> = ({
  visible,
  onClose,
  paymentSessionId,
  orderId,
  planName,
  amount,
  onPaymentFinished,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleCloseAttempt = () => {
    Alert.alert(
      'Cancel Payment?',
      'Are you sure you want to cancel? If you exit now, your subscription payment will not be completed.',
      [
        { text: 'Continue Payment', style: 'cancel' },
        {
          text: 'Cancel & Exit',
          style: 'destructive',
          onPress: () => {
            onClose();
            onPaymentFinished(orderId);
          },
        },
      ]
    );
  };

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    const url = navState.url || '';

    // Check for callback or return URL redirect
    if (url.includes('payment-callback') || url.includes('stylefleet://') || url.includes('payment_completed')) {
      onClose();
      onPaymentFinished(orderId);
    }
  };

  const handleShouldStartLoad = (request: { url: string }): boolean => {
    const url = request.url;

    // Handle deep links for UPI apps (Google Pay, PhonePe, Paytm, BHIM, Cred, etc.)
    if (
      url.startsWith('upi:') ||
      url.startsWith('phonepe:') ||
      url.startsWith('gpay:') ||
      url.startsWith('paytmmp:') ||
      url.startsWith('credpay:') ||
      url.startsWith('bhim:') ||
      url.startsWith('tez:') ||
      url.startsWith('intent:')
    ) {
      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(url).catch(() => {
            Alert.alert('App Not Found', 'Could not open the selected UPI app. Please use another UPI app or Card payment.');
          });
        }
      });
      return false; // Prevent WebView from attempting to render custom intent URL
    }

    // Intercept return deep link
    if (url.startsWith('stylefleet://') || url.includes('payment-callback')) {
      onClose();
      onPaymentFinished(orderId);
      return false;
    }

    return true;
  };

  const cashfreeMode = CASHFREE_ENV === 'SANDBOX' ? 'sandbox' : 'production';

  // Cashfree SDK V3 checkout HTML
  const checkoutHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Cashfree Secure Checkout</title>
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0F172A;
      color: #F8FAFC;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow-x: hidden;
    }
    #loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 70vh;
      text-align: center;
      padding: 24px;
    }
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.1);
      width: 46px;
      height: 46px;
      border-radius: 50%;
      border-left-color: #D9A441;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .loading-title {
      font-size: 17px;
      font-weight: 600;
      color: #F8FAFC;
      margin-bottom: 6px;
    }
    .loading-sub {
      font-size: 13px;
      color: #94A3B8;
    }
    #error-container {
      display: none;
      padding: 24px;
      text-align: center;
      color: #EF4444;
    }
  </style>
</head>
<body>
  <div id="loading-container">
    <div class="spinner"></div>
    <div class="loading-title">Loading Secure Payment Gateway...</div>
    <div class="loading-sub">Connecting to Cashfree Payments (${cashfreeMode.toUpperCase()})</div>
  </div>
  <div id="error-container"></div>
  <script>
    try {
      const cashfree = Cashfree({ mode: "${cashfreeMode}" });
      cashfree.checkout({
        paymentSessionId: "${paymentSessionId}",
        redirectTarget: "_self"
      }).then(function(result) {
        if (result && result.error) {
          document.getElementById('loading-container').style.display = 'none';
          document.getElementById('error-container').style.display = 'block';
          document.getElementById('error-container').innerText = result.error.message || 'Payment initialization error';
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: result.error.message }));
          }
        }
      });
    } catch (e) {
      document.getElementById('loading-container').style.display = 'none';
      document.getElementById('error-container').style.display = 'block';
      document.getElementById('error-container').innerText = e.message || 'Payment error';
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.message }));
      }
    }
  </script>
</body>
</html>
`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCloseAttempt}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.lockBadge}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.secureText}>256-Bit SSL</Text>
            </View>
            <View>
              <Text style={styles.planTitle}>{planName} Plan</Text>
              <Text style={styles.amountText}>₹{amount.toLocaleString('en-IN')}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleCloseAttempt}
            accessibilityLabel="Close payment"
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* WebView */}
        <View style={styles.webContainer}>
          {paymentSessionId ? (
            <WebView
              ref={webViewRef}
              source={{ html: checkoutHtml }}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              originWhitelist={['*']}
              userAgent={
                Platform.OS === 'android'
                  ? 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
                  : undefined
              }
              onNavigationStateChange={handleNavigationStateChange}
              onShouldStartLoadWithRequest={handleShouldStartLoad}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={(e) => {
                setLoading(false);
                setLoadError(e.nativeEvent.description || 'Failed to load payment gateway');
              }}
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#D9A441" />
                  <Text style={styles.loadingText}>Initializing Cashfree Gateway...</Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Missing payment session ID.</Text>
            </View>
          )}

          {loadError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{loadError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setLoadError(null);
                  webViewRef.current?.reload();
                }}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  headerLeft: {
    flexDirection: 'column',
    gap: 2,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  lockIcon: {
    fontSize: 11,
  },
  secureText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  planTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
  },
  amountText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '700',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#D9A441',
    borderRadius: 8,
  },
  retryText: {
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 14,
  },
});
