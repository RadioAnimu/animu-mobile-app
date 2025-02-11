import React, { useContext, useEffect, useRef, useState } from "react";
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
import { API } from "../../api";
import { UserContext } from "../../contexts/user.context";
import { SuccessContext } from "../../contexts/success.context";
import { ErrorContext } from "../../contexts/error.context";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";

interface Props extends ModalProps {
  handleClose: () => void;
}

type Status = "idle" | "requesting";

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
  const { successMessage, setSuccessMessage } = useContext(SuccessContext);
  const { errorMessage, setErrorMessage } = useContext(ErrorContext);

  const userContext = useContext(UserContext);
  const [formData, setFormData] = useState<{
    name: string;
    city: string;
    artist: string;
    music: string;
    anime: string;
    request: string;
  }>({
    name: userContext?.user?.nickname || userContext?.user?.username || "",
    city: "",
    artist: "",
    music: "",
    anime: "",
    request: "",
  });

  const { settings } = useUserSettings();

  const handleRequestMusic = async () => {
    const url = API.LIVE_REQUEST_URL;
    const form = new FormData();
    for (const item of FORM_BUILDER_MAPPER) {
      if (!item.optional && !formData[item.name as keyof typeof formData]) {
        return false;
      }
      form.append(item.name, formData[item.name as keyof typeof formData]);
    }
    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      body: form,
    });
    const data = await response.text();
    console.log("Made request");
    if (data !== "1") {
      setErrorMessage(
        `${DICT[settings.selectedLanguage].REQUEST_ERROR}${data}`
      );
      return;
    }
    handleClose();
    setSuccessMessage(DICT[settings.selectedLanguage].REQUEST_SUCCESS);
  };

  const [tests, setTests] = useState(1);

  const _handleRequestMusic = async () => {
    setTests(0);
    await handleRequestMusic();
    setTests(1);
    setFormData({
      name: userContext?.user?.nickname || userContext?.user?.username || "",
      city: "",
      artist: "",
      music: "",
      anime: "",
      request: "",
    });
  };

  const FORM_BUILDER_MAPPER = [
    {
      label: DICT[settings.selectedLanguage].FORM_LABEL_NICK,
      name: "name",
      input: {
        value: "",
        onChangeText: (text: string) =>
          setFormData({ ...formData, name: text }),
        placeholder: "Digite seu nome ou nick",
      },
    },
    {
      label: DICT[settings.selectedLanguage].FORM_LABEL_CITY,
      name: "city",
      input: {
        value: "",
        onChangeText: (text: string) =>
          setFormData({ ...formData, city: text }),
        placeholder: "Digite sua cidade/estado",
      },
    },
    {
      label: DICT[settings.selectedLanguage].FORM_LABEL_ARTIST,
      name: "artist",
      input: {
        value: "",
        onChangeText: (text: string) =>
          setFormData({ ...formData, artist: text }),
        placeholder: "Digite o nome do artista",
      },
    },
    {
      label: DICT[settings.selectedLanguage].FORM_LABEL_MUSIC,
      name: "music",
      input: {
        value: "",
        onChangeText: (text: string) =>
          setFormData({ ...formData, music: text }),
        placeholder: "Digite o nome da música",
      },
    },
    {
      label: DICT[settings.selectedLanguage].FORM_LABEL_ANIME,
      name: "anime",
      input: {
        value: "",
        onChangeText: (text: string) =>
          setFormData({ ...formData, anime: text }),
        placeholder: "Digite o nome do anime, visual novel ou jogo",
      },
    },
    {
      label: DICT[settings.selectedLanguage].FORM_LABEL_REQUEST,
      optional: true,
      name: "request",
      input: {
        value: "",
        onChangeText: (text: string) =>
          setFormData({ ...formData, request: text }),
        placeholder: "Digite um recado para o locutor",
        multiline: true,
        onEndEditing: () => _handleRequestMusic(),
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
                  disabled={tests === 0}
                />
              </View>
            ))}
            {tests === 0 ? (
              <ActivityIndicator color={THEME.COLORS.WHITE_TEXT} />
            ) : (
              <TouchableOpacity
                onPress={() => _handleRequestMusic()}
                style={styles.okButton}
              >
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
