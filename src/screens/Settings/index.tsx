import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RowDivider } from "@/components/ListRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionTitle } from "@/components/SectionTitle";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useDict } from "@/hooks/useDict";
import { useScrollEndPadding } from "@/hooks/useScrollEndPadding";
import type { RootStackParamList } from "@/routes/app.routes";
import { styles } from "@/screens/Settings/styles";
import { AccountSection } from "@/screens/Settings/sections/AccountSection";
import { CoverDataSection } from "@/screens/Settings/sections/CoverDataSection";
import { ExperimentalSection } from "@/screens/Settings/sections/ExperimentalSection";
import { HelpSection } from "@/screens/Settings/sections/HelpSection";
import { ListenStatsSection } from "@/screens/Settings/sections/ListenStatsSection";
import { PreferencesSection } from "@/screens/Settings/sections/PreferencesSection";
import { ResetSection } from "@/screens/Settings/sections/ResetSection";
import { StorageSection } from "@/screens/Settings/sections/StorageSection";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function Settings({ navigation }: Readonly<Props>) {
  const { user, profile } = useAuth();
  const dict = useDict();
  const endPadding = useScrollEndPadding();

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title={dict.SETTINGS_TITLE}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={[
          styles.appContainer,
          { paddingBottom: endPadding },
        ]}
      >
        {/* Identity and the on-device listening card open the page as one
            card; a heading over a single row would only repeat its label. */}
        <View style={styles.group}>
          <AccountSection
            user={user}
            profile={profile}
            onPress={() => navigation.navigate(user ? "Account" : "Login")}
          />
          <RowDivider />
          <ListenStatsSection onPress={() => navigation.navigate("Stats")} />
        </View>

        <PreferencesSection />

        {/* Covers and their on-disk cache are one topic: one card. */}
        <SectionTitle title={dict.SETTINGS_SAVE_DATA_TITLE} icon="image" />
        <View style={styles.group}>
          <CoverDataSection />
          <RowDivider />
          <StorageSection
            onOpenStorage={() => navigation.navigate("Storage")}
          />
        </View>

        <ExperimentalSection />

        <HelpSection onOpenAbout={() => navigation.navigate("About")} />

        <ResetSection />
      </ScrollView>
    </SafeAreaView>
  );
}
