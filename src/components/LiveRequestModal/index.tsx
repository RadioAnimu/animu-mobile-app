import React, { useState } from "react";
import { ValidationError } from "animu-api";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { DICT } from "../../i18n";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { ScrollView as GestureScrollView } from "react-native-gesture-handler";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { useAlert } from "../../contexts/alert/AlertProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { useLiveRequestForm } from "../../hooks/useLiveRequestForm";
import { liveRequestService } from "../../core/services/live-request.service";
import { Sheet } from "../Sheet";

interface Props {
  visible: boolean;
  handleClose: () => void;
}

interface LabelProps {
  text: string;
  optional?: boolean;
}

function Label({ text, optional }: LabelProps) {
  const { settings } = useUserSettings();

  return (
    <Text style={styles.label}>
      {text}
      {optional && ` (${DICT[settings.selectedLanguage].OPTIONAL_LABEL})`}:
    </Text>
  );
}

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  disabled?: boolean;
  multiline?: boolean;
  placeholder?: string;
  onEndEditing?: () => Promise<void>;
}

function Input({
  value,
  onChangeText,
  disabled,
  placeholder,
  multiline,
  onEndEditing,
}: InputProps) {
  return (
    <TextInput
      style={[styles.input, disabled && styles.inputDisabled]}
      value={value}
      onChangeText={onChangeText}
      editable={!disabled}
      placeholder={placeholder}
      onEndEditing={onEndEditing}
    />
  );
}

export function LiveRequestModal({ visible, handleClose }: Props) {
  const { success, error: showError } = useAlert();
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { formData, setters, reset, getFormData, isFormValid } =
    useLiveRequestForm({
      name: user?.nickname || user?.username || "",
    });

  const t = DICT[settings.selectedLanguage];

  const handleSubmit = async () => {
    if (isSubmitting) return;

    try {
      if (!isFormValid()) return;

      setIsSubmitting(true);
      const result = await liveRequestService.submitRequest(getFormData());

      if (result.success) {
        success(t.REQUEST_SUCCESS);
        handleClose();
        reset();
      } else {
        showError(`${t.REQUEST_ERROR}${result.error}`);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        showError(error.message);
      } else {
        showError(t.REQUEST_ERROR);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const FORM_BUILDER_MAPPER = [
    {
      label: t.FORM_LABEL_NICK,
      name: "name",
      input: {
        value: formData.name,
        onChangeText: setters.setName,
        placeholder: t.FORM_PLACEHOLDER_NICK,
      },
    },
    {
      label: t.FORM_LABEL_CITY,
      name: "city",
      input: {
        value: formData.city,
        onChangeText: setters.setCity,
        placeholder: t.FORM_PLACEHOLDER_CITY,
      },
    },
    {
      label: t.FORM_LABEL_ARTIST,
      name: "artist",
      input: {
        value: formData.artist,
        onChangeText: setters.setArtist,
        placeholder: t.FORM_PLACEHOLDER_ARTIST,
      },
    },
    {
      label: t.FORM_LABEL_MUSIC,
      name: "music",
      input: {
        value: formData.music,
        onChangeText: setters.setMusic,
        placeholder: t.FORM_PLACEHOLDER_MUSIC,
      },
    },
    {
      label: t.FORM_LABEL_ANIME,
      name: "anime",
      input: {
        value: formData.anime,
        onChangeText: setters.setAnime,
        placeholder: t.FORM_PLACEHOLDER_ANIME,
      },
    },
    {
      label: t.FORM_LABEL_REQUEST,
      optional: true,
      name: "request",
      input: {
        value: formData.request,
        onChangeText: setters.setRequest,
        placeholder: t.FORM_PLACEHOLDER_REQUEST,
        multiline: true,
        onEndEditing: handleSubmit,
      },
    },
  ];

  return (
    <Sheet visible={visible} onClose={handleClose} withKeyboard>
      <GestureScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t.LIVE_REQUEST_TITLE}</Text>
        {FORM_BUILDER_MAPPER.map((item, index) => (
          <View style={styles.field} key={index}>
            <Label text={item.label} optional={item.optional} />
            <Input
              value={formData[item.name as keyof typeof formData]}
              onChangeText={item.input.onChangeText}
              placeholder={item.input.placeholder}
              multiline={item.input.multiline}
              onEndEditing={item.input.onEndEditing}
              disabled={isSubmitting}
            />
          </View>
        ))}
        {isSubmitting ? (
          <ActivityIndicator color={THEME.COLORS.TEXT} />
        ) : (
          <TouchableOpacity onPress={handleSubmit} style={styles.okButton}>
            <Text style={styles.okText}>{t.SEND_REQUEST_BUTTON_TEXT}</Text>
          </TouchableOpacity>
        )}
      </GestureScrollView>
    </Sheet>
  );
}
