import { Image } from "expo-image";
import { Text, View } from "react-native";
import { User } from "../../core/domain/user";
import { styles } from "./styles";

interface ProfileProps {
  user: User;
}

export function DiscordProfile({ user }: ProfileProps) {
  return (
    <View style={styles.container}>
      <Image
        source={{
          uri: user.avatarUrl,
        }}
        style={styles.avatar}
      />
      <View style={styles.info}>
        <Text style={styles.username}>
          {user.nickname || user.username}
        </Text>
      </View>
    </View>
  );
}
