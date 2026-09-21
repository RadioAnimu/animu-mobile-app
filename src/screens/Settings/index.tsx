import { DrawerScreenProps } from "@react-navigation/drawer";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Background } from "@/components/Background";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useDict } from "@/hooks/useDict";
import { RootStackParamList } from "@/routes/app.routes";
import { styles } from "@/screens/Settings/styles";
import { AccountSection } from "@/screens/Settings/sections/AccountSection";
import { BehaviorSection } from "@/screens/Settings/sections/BehaviorSection";
import { CoverDataSection } from "@/screens/Settings/sections/CoverDataSection";
import { FooterSection } from "@/screens/Settings/sections/FooterSection";
import { LegalSection } from "@/screens/Settings/sections/LegalSection";
import { StorageSection } from "@/screens/Settings/sections/StorageSection";
import { UpdatesSection } from "@/screens/Settings/sections/UpdatesSection";

type Props = DrawerScreenProps<RootStackParamList, "Settings">;

export function Settings({ navigation }: Props) {
  const { user, profile } = useAuth();
  const dict = useDict();

  return (
    <Background>
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <ScreenHeader
          title={dict.SETTINGS_TITLE}
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={styles.appContainer}>
          {/* Account first — the one thing tied to *who* is listening. */}
          <AccountSection
            first
            user={user}
            profile={profile}
            onPress={() => {
              if (user) {
                navigation.navigate("Account");
              } else {
                navigation.navigate("Login");
              }
            }}
          />
          <CoverDataSection />
          <BehaviorSection />
          <UpdatesSection />
          <StorageSection
            onOpenStorage={() => navigation.navigate("Storage")}
          />
          <LegalSection />
          <FooterSection />
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}
