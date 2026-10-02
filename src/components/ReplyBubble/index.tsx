import { useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

import { Avatar } from "@/components/Avatar";
import { ChatBubble } from "@/components/ChatBubble";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { styles } from "@/components/ReplyBubble/styles";
import type { User } from "@/core/domain/user";
import { THEME } from "@/theme";

interface Props
  extends Pick<
    TextInputProps,
    "value" | "onChangeText" | "placeholder" | "onSubmitEditing"
  > {
  value: string;
  onChangeText: (text: string) => void;
  /** Spoken label of the input. */
  label: string;
  user: User | null;
  /** Submitting: dims and ignores typing, keeping focus and the keyboard. */
  busy?: boolean;
  maxLength?: number;
}

/**
 * The user's side of the chat: their name and avatar under Haruka's message,
 * and the text field as the DM bubble they're typing back, tail toward them.
 */
export function ReplyBubble({
  value,
  onChangeText,
  label,
  user,
  busy = false,
  maxLength,
  placeholder,
  onSubmitEditing,
}: Props) {
  const { profile } = useAuth();
  const [focused, setFocused] = useState(false);

  // The stored session can predate the provider handle; the profile is fresher.
  const name = profile?.user.username || user?.username;
  const handle = profile?.user.handle || user?.handle;

  return (
    <View style={styles.row}>
      <View style={styles.column}>
        {user && (
          <Text style={styles.name} numberOfLines={1}>
            {handle ? `${name} (@${handle})` : name}
          </Text>
        )}
        <ChatBubble
          side="right"
          color={THEME.COLORS.TEXT}
          style={[
            styles.bubble,
            focused && styles.bubbleFocused,
            busy && styles.disabled,
          ]}
        >
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={(text) => {
              if (!busy) onChangeText(text);
            }}
            multiline
            maxLength={maxLength}
            placeholder={placeholder}
            placeholderTextColor="rgba(0, 0, 0, 0.45)"
            accessibilityLabel={label}
            accessibilityState={{ busy }}
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={onSubmitEditing}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </ChatBubble>
      </View>
      {user && <Avatar uri={user.avatarUrl} style={styles.avatar} />}
    </View>
  );
}
