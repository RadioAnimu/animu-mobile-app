import { Image } from "expo-image";
import { Text, View } from "react-native";
import { THEME } from "../../theme";
import { User } from "../../core/domain/user";

interface ProfileProps {
  user: User;
}

export function DiscordProfile({ user }: ProfileProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        width: "90%",
        alignSelf: "center",
        gap: 10,
      }}
    >
      <Image
        source={{
          uri: user.avatarUrl,
        }}
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          borderWidth: 2,
          borderColor: THEME.COLORS.SHAPE,
        }}
      />
      <View style={{ flexDirection: "column", gap: 5 }}>
        <Text
          style={{
            color: THEME.COLORS.WHITE_TEXT,
            fontFamily: THEME.FONT_FAMILY.BOLD,
            fontSize: THEME.FONT_SIZE.MENU_ITEM,
          }}
        >
          {user.nickname || user.username}
        </Text>
        <Text
          style={{
            color: THEME.COLORS.WHITE_TEXT,
            fontFamily: THEME.FONT_FAMILY.REGULAR,
            fontSize: THEME.FONT_SIZE.SM,
            opacity: 0.8,
          }}
        >
          {549} minutos ouvidos
        </Text>
      </View>
    </View>
  );
}
