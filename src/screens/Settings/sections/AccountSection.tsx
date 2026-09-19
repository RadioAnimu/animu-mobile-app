import { View } from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import type { AuthProfile, User } from "@/core/domain/user";
import { useDict } from "@/hooks/useDict";
import { AccountRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";

interface Props {
  user: User | null;
  profile: AuthProfile | null;
  onPress: () => void;
}

/** Account entry point — the one setting tied to *who* is listening. */
export function AccountSection({ user, profile, onPress }: Props) {
  const dict = useDict();

  return (
    <>
      <SectionTitle title={dict.SETTINGS_ACCOUNT_TITLE} icon="person" />
      <View style={styles.group}>
        <AccountRow
          user={user}
          profile={profile}
          dict={dict}
          onPress={onPress}
        />
      </View>
    </>
  );
}
