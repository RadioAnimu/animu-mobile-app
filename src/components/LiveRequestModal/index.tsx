import { useState } from "react";
import { ScrollView, TextInput } from "react-native";

import { FormField } from "@/components/FormField";
import { RequestSubmitButton } from "@/components/RequestSubmitButton";
import { Sheet } from "@/components/Sheet";
import { SheetBanner } from "@/components/SheetBanner";
import { styles } from "@/components/LiveRequestModal/styles";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import type { LiveRequest } from "@/core/domain/live-request";
import { liveRequestService } from "@/core/services/live-request.service";
import { useChip } from "@/hooks/useChip";
import { useDict } from "@/hooks/useDict";
import { useInputRegistry } from "@/hooks/useInputRegistry";
import {
  LIVE_FIELD_MAX,
  LIVE_MESSAGE_MAX,
  getMissingLiveFields,
  trimLiveRequest,
  useLiveRequestForm,
} from "@/hooks/useLiveRequestForm";
import { haptics } from "@/utils/haptics";
import { layoutEase } from "@/utils/layout-animation";

/** "Live!" — decorative katakana, like Haruka's section art. */
const LIVE_STICKER = "ライブ!";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

interface Props {
  visible: boolean;
  handleClose: () => void;
}

export function LiveRequestModal({ visible, handleClose }: Readonly<Props>) {
  const t = useDict();
  const { user } = useAuth();
  const { toast } = useAlert();
  const { chip, showChip, clearChip } = useChip();
  const defaultName = user?.nickname || user?.username || "";

  const { formData, setters, setField, reset } = useLiveRequestForm({
    name: defaultName,
  });

  const [status, setStatus] = useState<SubmitStatus>("idle");
  /** Field errors only appear after a first send attempt, then track edits. */
  const [attempted, setAttempted] = useState(false);
  /** Whose draft the form holds (a new session must not inherit it). */
  const [draftOwner, setDraftOwner] = useState(user?.id);

  const { register: registerInput, focus: focusInput } =
    useInputRegistry<keyof LiveRequest>();

  // The sheet stays mounted with Home. On each open the draft is kept (a
  // swipe-away must not cost the user their typing) unless it was already
  // sent or belongs to another session; the name re-prefills when empty.
  // "Adjust state during render" pattern: compiler-safe, no effect cascade.
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) {
      const fresh = status === "success" || draftOwner !== user?.id;
      if (fresh) {
        reset();
        setAttempted(false);
        setDraftOwner(user?.id);
      }
      if (fresh || !formData.name) setters.setName(defaultName);
      setStatus("idle");
    }
  }

  const missing = attempted ? getMissingLiveFields(formData) : [];
  const fieldError = (field: keyof LiveRequest) =>
    (missing as string[]).includes(field) ? t.FORM_ERROR_REQUIRED : undefined;

  const handleChange = (field: keyof LiveRequest, text: string) => {
    setField(field, text);
    // Editing after a failure clears the retry state.
    if (status === "error") {
      layoutEase();
      setStatus("idle");
    }
  };

  const fail = (text: string) => {
    haptics.error();
    layoutEase();
    setStatus("error");
    showChip(text, "error");
  };

  const handleSubmit = async () => {
    if (status === "submitting" || status === "success") return;

    const invalid = getMissingLiveFields(formData);
    setAttempted(true);
    if (invalid.length > 0) {
      haptics.error();
      layoutEase();
      focusInput(invalid[0]);
      return;
    }

    layoutEase();
    setStatus("submitting");

    const payload = trimLiveRequest(formData);

    try {
      const result = await liveRequestService.submitRequest(payload);
      if (result.success) {
        haptics.success();
        layoutEase();
        setStatus("success");
        toast(t.REQUEST_SUCCESS, "success");
        handleClose();
      } else if (result.error === "IN_PROGRESS") {
        // A duplicate tap — the first submit owns the outcome.
        return;
      } else {
        fail(t.REQUEST_ERROR);
      }
    } catch (error) {
      console.error("[LiveRequestModal] Submit failed:", error);
      fail(t.REQUEST_ERROR);
    }
  };

  const isSubmitting = status === "submitting";
  const isError = status === "error";

  const fieldProps = (field: keyof LiveRequest, next?: keyof LiveRequest) => ({
    value: formData[field],
    onChangeText: (text: string) => handleChange(field, text),
    error: fieldError(field),
    busy: isSubmitting,
    inputRef: (node: TextInput | null) => registerInput(field, node),
    maxLength: field === "request" ? LIVE_MESSAGE_MAX : LIVE_FIELD_MAX,
    ...(next && {
      returnKeyType: "next" as const,
      submitBehavior: "submit" as const,
      onSubmitEditing: () => focusInput(next),
    }),
  });

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      // Mid-submit dismissal is blocked like the music-request sheet: a
      // close while the POST is in flight would orphan the outcome.
      closable={!isSubmitting}
      withKeyboard
      chip={chip}
      onChipDone={clearChip}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scrollContent}
      >
        <SheetBanner live sticker={LIVE_STICKER} title={t.LIVE_REQUEST_TITLE} />

        <FormField
          label={t.FORM_LABEL_NICK}
          placeholder={t.FORM_PLACEHOLDER_NICK}
          {...fieldProps("name", "city")}
        />
        <FormField
          label={t.FORM_LABEL_CITY}
          placeholder={t.FORM_PLACEHOLDER_CITY}
          {...fieldProps("city", "music")}
        />
        <FormField
          label={t.FORM_LABEL_MUSIC}
          placeholder={t.FORM_PLACEHOLDER_MUSIC}
          {...fieldProps("music", "artist")}
        />
        <FormField
          label={t.FORM_LABEL_ARTIST}
          placeholder={t.FORM_PLACEHOLDER_ARTIST}
          {...fieldProps("artist", "anime")}
        />
        <FormField
          label={t.FORM_LABEL_ANIME}
          placeholder={t.FORM_PLACEHOLDER_ANIME}
          {...fieldProps("anime", "request")}
        />
        <FormField
          label={t.FORM_LABEL_REQUEST}
          optional
          multiline
          placeholder={t.FORM_PLACEHOLDER_REQUEST}
          {...fieldProps("request")}
        />

        <RequestSubmitButton
          submitting={isSubmitting}
          failed={isError}
          onPress={handleSubmit}
        />
      </ScrollView>
    </Sheet>
  );
}
