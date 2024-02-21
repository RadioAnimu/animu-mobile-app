import { FontAwesome } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { THEME } from "../../theme";
import { Image } from "expo-image";
import { DiscordUser } from "../../contexts/user.context";

interface ProfileProps {
  user: DiscordUser;
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
          uri: user.avatar_url,
        }}
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          borderWidth: 2,
          borderColor: THEME.COLORS.WHITE_TEXT,
        }}
      />
      <View>
        <Text
          style={{
            color: THEME.COLORS.WHITE_TEXT,
            textAlign: "center",
            fontFamily: THEME.FONT_FAMILY.BOLD,
            fontSize: THEME.FONT_SIZE.MENU_ITEM,
          }}
        >
          {user.nickname || user.username}
        </Text>
        {user.nickname && (
          <Text
            style={{
              color: THEME.COLORS.WHITE_TEXT,
              fontFamily: THEME.FONT_FAMILY.REGULAR,
              fontSize: THEME.FONT_SIZE.SM,
            }}
          >
            {user.username}
          </Text>
        )}
      </View>
    </View>
  );
}
