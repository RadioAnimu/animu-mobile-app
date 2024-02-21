import React, { useContext, useState } from "react";
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
import { UserSettingsContext } from "../../contexts/user.settings.context";
import { DICT } from "../../languages";
import { THEME } from "../../theme";
import { styles } from "./styles";
import CloseIcon from "../../assets/icons/ArrastarParaBaixo.png";
import { ScrollView } from "react-native-gesture-handler";
import { API } from "../../api";
import { UserContext } from "../../contexts/user.context";
import { SuccessContext } from "../../contexts/success.context";
import { ErrorContext } from "../../contexts/error.context";

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
  const [status, setStatus] = useState<Status>("idle");
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

  const { userSettings } = useContext(UserSettingsContext);

  const handleRequestMusic: () => Promise<void> = async () => {
    setStatus("requesting");
    const url = API.LIVE_REQUEST_URL;
    let res: boolean = false;
    const form = new FormData();
    for (const item of FORM_BUILDER_MAPPER) {
      if (!item.optional && !formData[item.name as keyof typeof formData]) {
        setErrorMessage(
          "O campo " + item.label + " é obrigatório para fazer o pedido"
        );
        setStatus("idle");
        return;
      }
      form.append(item.name, formData[item.name as keyof typeof formData]);
    }
    const method: "POST" = "POST";
    const headers = {};
    const body = form;
    try {
      await fetch(url, { method, headers, body });
      res = true;
    } catch (error) {
      res = false;
    }
    setFormData({
      name: userContext?.user?.nickname || userContext?.user?.username || "",
      city: "",
      artist: "",
      music: "",
      anime: "",
      request: "",
    });
    if (res) {
      setSuccessMessage("Pedido feito com sucesso!");
    } else {
      setErrorMessage("Erro ao fazer o pedido, tente novamente mais tarde");
    }
    setStatus("idle");
  };

  const FORM_BUILDER_MAPPER = [
    {
      label: "Nick",
      name: "name",
      input: {
        value: "",
        onChangeText: (text: string) =>
          setFormData({ ...formData, name: text }),
        placeholder: "Digite seu nome ou nick",
      },
    },
    {
      label: "Cidade",
      name: "city",
      input: {
        value: "",
        onChangeText: (text: string) =>
          setFormData({ ...formData, city: text }),
        placeholder: "Digite sua cidade/estado",
      },
    },
    {
      label: "Artista",
      name: "artist",
      input: {
        value: "",
        onChangeText: (text: string) =>
          setFormData({ ...formData, artist: text }),
        placeholder: "Digite o nome do artista",
      },
    },
    {
      label: "Música",
      name: "music",
      input: {
        value: "",
        onChangeText: (text: string) =>
          setFormData({ ...formData, music: text }),
        placeholder: "Digite o nome da música",
      },
    },
    {
      label: "Anime/VN/Jogo",
      name: "anime",
      input: {
        value: "",
        onChangeText: (text: string) =>
          setFormData({ ...formData, anime: text }),
        placeholder: "Digite o nome do anime, visual novel ou jogo",
      },
    },
    {
      label: "Recado",
      optional: true,
      name: "request",
      input: {
        value: "",
        onChangeText: (text: string) =>
          setFormData({ ...formData, request: text }),
        placeholder: "Digite um recado para o locutor",
        multiline: true,
        onEndEditing: handleRequestMusic,
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
                  disabled={status === "requesting"}
                />
              </View>
            ))}
            {status === "requesting" ? (
              <ActivityIndicator color={THEME.COLORS.WHITE_TEXT} />
            ) : (
              <TouchableOpacity
                onPress={handleRequestMusic}
                style={styles.okButton}
              >
                <Text style={styles.okText}>
                  {DICT[userSettings.selectedLanguage].SEND_REQUEST_BUTTON_TEXT}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
