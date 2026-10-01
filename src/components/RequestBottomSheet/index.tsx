import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { MusicRequest } from "@/core/domain/music-request";
import { User } from "@/core/domain/user";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useChip } from "@/hooks/useChip";
import { useDict } from "@/hooks/useDict";
import { Cover } from "@/components/Cover";
import { styles } from "@/components/RequestBottomSheet/styles";
import { RequestSubmitButton } from "@/components/RequestSubmitButton";
import { Sheet } from "@/components/Sheet";
import { HarukaBubble } from "@/components/HarukaBubble";
import { ReplyBubble } from "@/components/ReplyBubble";
import { haptics } from "@/utils/haptics";
import { layoutEase } from "@/utils/layout-animation";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

interface Props {
  visible: boolean;
  track?: MusicRequest;
  user: User | null;
  onClose: () => void;
  onSubmit: (message: string) => Promise<{ success: boolean; message: string }>;
  onRequestSuccess: (trackId: string) => void;
}

function TrackCard({ track }: { track: MusicRequest }) {
  return (
    <View style={styles.trackRow}>
      <Cover cover={track.artwork} style={styles.cover} category="search" />
      <View style={styles.trackInfo}>
        <Text style={styles.songName} numberOfLines={2}>
          {track.song}
        </Text>
        <View style={styles.animeChip}>
          <Text style={styles.animeText} numberOfLines={1}>
            {track.anime}
          </Text>
        </View>
        <Text style={styles.artistText} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
    </View>
  );
}

export function RequestBottomSheet({
  visible,
  track,
  user,
  onClose,
  onSubmit,
  onRequestSuccess,
}: Props) {
  const dict = useDict();
  const { toast } = useAlert();
  const { chip, showChip, clearChip } = useChip();

  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");

  // Reset form when modal opens with a new track — "adjust state during
  // render" pattern (compiler-safe, no cascading effect render)
  const [prevOpenState, setPrevOpenState] = useState({
    visible,
    trackId: track?.id,
  });
  if (
    prevOpenState.visible !== visible ||
    prevOpenState.trackId !== track?.id
  ) {
    setPrevOpenState({ visible, trackId: track?.id });
    if (visible) {
      setMessage("");
      setStatus("idle");
    }
  }

  const fail = (text: string) => {
    haptics.error();
    layoutEase();
    setStatus("error");
    showChip(text, "error");
  };

  const handleSubmit = async () => {
    if (status === "submitting" || status === "success") return;
    layoutEase();
    setStatus("submitting");
    try {
      const result = await onSubmit(message);
      if (result.success) {
        haptics.success();
        layoutEase();
        setStatus("success");
        if (track) onRequestSuccess(track.id);
        toast(dict.REQUEST_SUCCESS, "success");
        onClose();
      } else {
        fail(result.message);
      }
    } catch (error) {
      console.warn("[RequestBottomSheet] submit failed:", error);
      fail(dict.REQUEST_ERROR);
    }
  };

  // The draft stays editable after a failure; typing again clears the retry
  // state so the button can't contradict what's on screen.
  const handleChangeMessage = (text: string) => {
    setMessage(text);
    if (status === "error") {
      layoutEase();
      setStatus("idle");
    }
  };

  const isSubmitting = status === "submitting";
  const isError = status === "error";

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
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
        {track && <TrackCard track={track} />}

        <HarukaBubble text={dict.INFO_REQUEST} />
        <ReplyBubble
          label={dict.FORM_LABEL_REQUEST}
          placeholder={dict.SEND_REQUEST_PLACEHOLDER}
          user={user}
          value={message}
          onChangeText={handleChangeMessage}
          editable={!isSubmitting}
          onSubmitEditing={handleSubmit}
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
