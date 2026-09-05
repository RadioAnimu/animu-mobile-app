import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DICT, selectedLanguage } from "../../i18n";
import { THEME } from "../../theme";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Last-resort crash guard for the React tree. Without this, any uncaught
 * render error kills the app to a red screen (dev) or a blank screen
 * (production). Wire a crash reporter (e.g. Sentry.captureException)
 * into componentDidCatch when telemetry is added.
 *
 * Renders outside the providers, so it uses the i18n module default
 * language instead of the user setting.
 */
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const t = DICT[selectedLanguage];

    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t.ERROR_TITLE}</Text>
        <Text style={styles.message}>{t.ERROR_MESSAGE}</Text>
        <TouchableOpacity onPress={this.reset} style={styles.button}>
          <Text style={styles.buttonText}>{t.ERROR_RETRY}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.APP_BG,
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.MD,
    padding: THEME.SPACE.XXL,
  },
  title: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
  },
  message: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    textAlign: "center",
  },
  button: {
    backgroundColor: THEME.COLORS.SURFACE,
    paddingHorizontal: THEME.SPACE.XXL,
    paddingVertical: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.LG,
    marginTop: THEME.SPACE.SM,
  },
  buttonText: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
});

export default ErrorBoundary;
