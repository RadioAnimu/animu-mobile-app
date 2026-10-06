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
import { AboutSection } from "@/screens/Settings/sections/AboutSection";
import { AccountSection } from "@/screens/Settings/sections/AccountSection";
import { BehaviorSection } from "@/screens/Settings/sections/BehaviorSection";
import { CoverDataSection } from "@/screens/Settings/sections/CoverDataSection";
import { ListenStatsSection } from "@/screens/Settings/sections/ListenStatsSection";
import { ResetSection } from "@/screens/Settings/sections/ResetSection";
import { StorageSection } from "@/screens/Settings/sections/StorageSection";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function Settings({ navigation }: Readonly<Props>) {
  const { user, profile } = useAuth();
  const dict = useDict();
  const endPadding = useScrollEndPadding();

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
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

        <BehaviorSection />

        {/* Covers and their on-disk cache are one topic: one card. */}
        <SectionTitle title={dict.SETTINGS_SAVE_DATA_TITLE} icon="image" />
        <View style={styles.group}>
          <CoverDataSection />
          <RowDivider />
          <StorageSection
            onOpenStorage={() => navigation.navigate("Storage")}
          />
        </View>

        <View style={styles.groupSpaced}>
          <AboutSection onPress={() => navigation.navigate("About")} />
        </View>

        {/* Resetting the settings closes the page. */}
        <ResetSection />
      </ScrollView>
    </SafeAreaView>
  );
}
