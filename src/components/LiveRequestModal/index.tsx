import { useEffect, useRef, useState } from "react";
import { ValidationError } from "animu-api";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { THEME } from "@/theme";
import { styles } from "@/components/LiveRequestModal/styles";
import { useDict } from "@/hooks/useDict";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useLiveRequestForm } from "@/hooks/useLiveRequestForm";
import { liveRequestService } from "@/core/services/live-request.service";
import type { LiveRequest } from "@/core/domain/live-request";
import { Sheet } from "@/components/Sheet";

interface Props {
  visible: boolean;
  handleClose: () => void;
}

interface LabelProps {
  text: string;
  optional?: boolean;
}

function Label({ text, optional }: LabelProps) {
  const dict = useDict();

  return (
    <Text style={styles.label}>
      {text}
      {optional && ` (${dict.OPTIONAL_LABEL})`}:
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

interface FormField {
  label: string;
  optional?: boolean;
  name: keyof LiveRequest;
  input: {
    onChangeText: (text: string) => void;
    placeholder: string;
    multiline?: boolean;
    onEndEditing?: () => Promise<void>;
  };
}

export function LiveRequestModal({ visible, handleClose }: Props) {
  const { success, error: showError } = useAlert();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { formData, setters, reset, getFormData, isFormValid } =
    useLiveRequestForm({
      name: user?.nickname || user?.username || "",
    });

  const t = useDict();

  // The modal stays mounted with Home, so the hook's initial name is
  // captured before the session is restored — prefill from the current
  // user each time the sheet opens (and clear any previous session's form).
  const settersRef = useRef(setters);
  // Latest-ref pattern in an effect, never in render — a discarded
  // concurrent render must not leave a stale setter behind.
  useEffect(() => {
    settersRef.current = setters;
  });
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      const defaultName = user?.nickname || user?.username || "";
      if (defaultName) settersRef.current.setName(defaultName);
    }
    wasVisible.current = visible;
  }, [visible, user]);

  const closeAndReset = () => {
    reset();
    handleClose();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!isFormValid()) {
      showError(t.LOGIN_MISSING_FIELDS);
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await liveRequestService.submitRequest(getFormData());

      if (result.success) {
        success(t.REQUEST_SUCCESS);
        closeAndReset();
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

  const FORM_BUILDER_MAPPER: FormField[] = [
    {
      label: t.FORM_LABEL_NICK,
      name: "name",
      input: {
        onChangeText: setters.setName,
        placeholder: t.FORM_PLACEHOLDER_NICK,
      },
    },
    {
      label: t.FORM_LABEL_CITY,
      name: "city",
      input: {
        onChangeText: setters.setCity,
        placeholder: t.FORM_PLACEHOLDER_CITY,
      },
    },
    {
      label: t.FORM_LABEL_ARTIST,
      name: "artist",
      input: {
        onChangeText: setters.setArtist,
        placeholder: t.FORM_PLACEHOLDER_ARTIST,
      },
    },
    {
      label: t.FORM_LABEL_MUSIC,
      name: "music",
      input: {
        onChangeText: setters.setMusic,
        placeholder: t.FORM_PLACEHOLDER_MUSIC,
      },
    },
    {
      label: t.FORM_LABEL_ANIME,
      name: "anime",
      input: {
        onChangeText: setters.setAnime,
        placeholder: t.FORM_PLACEHOLDER_ANIME,
      },
    },
    {
      label: t.FORM_LABEL_REQUEST,
      optional: true,
      name: "request",
      input: {
        onChangeText: setters.setRequest,
        placeholder: t.FORM_PLACEHOLDER_REQUEST,
        multiline: true,
        onEndEditing: handleSubmit,
      },
    },
  ];

  return (
    <Sheet visible={visible} onClose={closeAndReset} withKeyboard>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t.LIVE_REQUEST_TITLE}</Text>
        {FORM_BUILDER_MAPPER.map((item) => (
          <View style={styles.field} key={item.name}>
            <Label text={item.label} optional={item.optional} />
            <Input
              value={formData[item.name]}
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
      </ScrollView>
    </Sheet>
  );
}
