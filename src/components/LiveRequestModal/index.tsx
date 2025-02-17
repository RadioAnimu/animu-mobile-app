import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  ModalProps,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { DICT } from "../../languages";
import { THEME } from "../../theme";
import { styles } from "./styles";
import CloseIcon from "../../assets/icons/ArrastarParaBaixo.png";
import { ScrollView } from "react-native-gesture-handler";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { useAlert } from "../../contexts/alert/AlertProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { useLiveRequestForm } from "../../hooks/useLiveRequestForm";
import { liveRequestService } from "../../core/services/live-request.service";
import { HttpRequestError } from "../../core/errors/http.error";

interface Props extends ModalProps {
  handleClose: () => void;
}

interface LabelProps {
  text: string;
  optional?: boolean;
}

function Label({ text, optional }: LabelProps) {
  return (
    <Text style={styles.label}>
      {text}
      {optional && " (opcional)"}:
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

export function LiveRequestModal({ handleClose, ...rest }: Props) {
  const { success, error: showError } = useAlert();
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { formData, setters, reset, getFormData, isFormValid } =
    useLiveRequestForm({
      name: user?.nickname || user?.username || "",
    });

  const handleSubmit = async () => {
    if (isSubmitting) return;

    try {
      if (!isFormValid()) return;

      setIsSubmitting(true);
      const result = await liveRequestService.submitRequest(getFormData());

      if (result.success) {
        success(DICT[settings.selectedLanguage].REQUEST_SUCCESS);
        handleClose();
        reset();
      } else {
        showError(
          `${DICT[settings.selectedLanguage].REQUEST_ERROR}${result.error}`
        );
      }
    } catch (error) {
      if (error instanceof HttpRequestError) {
        showError(error.message);
      } else {
        showError(DICT[settings.selectedLanguage].REQUEST_ERROR);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const FORM_BUILDER_MAPPER = [
    {
      label: DICT[settings.selectedLanguage].FORM_LABEL_NICK,
      name: "name",
      input: {
        value: formData.name,
        onChangeText: setters.setName,
        placeholder: "Digite seu nome ou nick",
      },
    },
    {
      label: DICT[settings.selectedLanguage].FORM_LABEL_CITY,
      name: "city",
      input: {
        value: formData.city,
        onChangeText: setters.setCity,
        placeholder: "Digite sua cidade/estado",
      },
    },
    {
      label: DICT[settings.selectedLanguage].FORM_LABEL_ARTIST,
      name: "artist",
      input: {
        value: formData.artist,
        onChangeText: setters.setArtist,
        placeholder: "Digite o nome do artista",
      },
    },
    {
      label: DICT[settings.selectedLanguage].FORM_LABEL_MUSIC,
      name: "music",
      input: {
        value: formData.music,
        onChangeText: setters.setMusic,
        placeholder: "Digite o nome da música",
      },
    },
    {
      label: DICT[settings.selectedLanguage].FORM_LABEL_ANIME,
      name: "anime",
      input: {
        value: formData.anime,
        onChangeText: setters.setAnime,
        placeholder: "Digite o nome do anime, visual novel ou jogo",
      },
    },
    {
      label: DICT[settings.selectedLanguage].FORM_LABEL_REQUEST,
      optional: true,
      name: "request",
      input: {
        value: formData.request,
        onChangeText: setters.setRequest,
        placeholder: "Digite um recado para o locutor",
        multiline: true,
        onEndEditing: handleSubmit,
      },
    },
  ];

  return (
    <Modal animationType="slide" statusBarTranslucent transparent {...rest}>
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <TouchableOpacity
          style={{
            height: "100%",
          }}
          onPress={handleClose}
        />
        <View style={styles.content}>
          <ScrollView
            contentContainerStyle={{
              alignItems: "center",
            }}
          >
            <TouchableOpacity style={styles.closeArea} onPress={handleClose}>
              <Image style={styles.closeAreaIcon} source={CloseIcon} />
            </TouchableOpacity>
            <Text style={styles.title}>
              Faça seu pedido para o Locutor ao vivo!
            </Text>
            {FORM_BUILDER_MAPPER.map((item, index) => (
              <View
                style={{
                  width: "85%",
                }}
                key={index}
              >
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
              <ActivityIndicator color={THEME.COLORS.WHITE_TEXT} />
            ) : (
              <TouchableOpacity onPress={handleSubmit} style={styles.okButton}>
                <Text style={styles.okText}>
                  {DICT[settings.selectedLanguage].SEND_REQUEST_BUTTON_TEXT}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
