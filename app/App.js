import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from './src/components/Toast.jsx';
import { AuthProvider } from './src/context/AuthContext.jsx';
import { RootNavigator } from './src/navigation/RootNavigator.jsx';

/**
 * Provider order matters:
 *   SafeAreaProvider — insets, needed by ScreenContainer and Toast
 *     ToastProvider  — AuthProvider raises "session expired" through it, so it
 *                      has to be mounted first
 *       AuthProvider — owns the launch restore
 *         RootNavigator
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
