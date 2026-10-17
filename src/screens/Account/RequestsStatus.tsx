import { Linking, View } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import {
  ActionRow,
  IconBox,
  RowBody,
  RowDivider,
} from "@/components/ListRow";
import { SectionTitle } from "@/components/SectionTitle";
import { isProviderLinkable } from "@/constants/auth";
import type { AuthProfile } from "@/core/domain/user";
import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";
import { styles } from "@/screens/Account/styles";

/** Discord's own walkthrough for turning on two-factor authentication. */
const DISCORD_2FA_HELP_URL =
  "https://support.discord.com/hc/en-us/articles/219576828";

interface Props {
  /** `null` until the profile loads — nothing is shown rather than guessed. */
  profile: AuthProfile | null;
  /** The in-flight action key, or null. */
  busy: string | null;
  onLinkDiscord: () => void;
  onRefresh: () => void;
}

interface StepProps {
  label: string;
  status: string;
  done?: boolean;
  /** A step that can't be started yet (it needs the one above first). */
  dimmed?: boolean;
}

/** One checklist step: a check (or empty circle), its label and its state. */
function Step({ label, status, done, dimmed }: Readonly<StepProps>) {
  const icon: IconName = done ? "check-circle" : "radio-button-unchecked";

  return (
    <View style={[styles.row, dimmed && styles.rowDimmed]}>
      <IconBox>
        <Icon
          name={icon}
          size={THEME.ICON.MD}
          color={done ? THEME.COLORS.BRAND : THEME.COLORS.TEXT_DIM}
        />
      </IconBox>
      <RowBody label={label} description={status} />
    </View>
  );
}

interface ChecklistProps {
  discordLinked: boolean;
  busy: string | null;
  onLinkDiscord: () => void;
  onRefresh: () => void;
}

/** The two steps to verification and what to do next about the open one. */
function Checklist({
  discordLinked,
  busy,
  onLinkDiscord,
  onRefresh,
}: Readonly<ChecklistProps>) {
  const dict = useDict();
  // Hidden, not disabled, where Discord can't be linked from this build.
  const canLink = !discordLinked && isProviderLinkable("discord");

  return (
    <>
      <Step
        done={discordLinked}
        label={dict.ACCOUNT_REQUESTS_DISCORD}
        status={discordLinked ? dict.ACCOUNT_LINKED : dict.ACCOUNT_NOT_LINKED}
      />
      <RowDivider />
      <Step
        dimmed={!discordLinked}
        label={dict.ACCOUNT_REQUESTS_2FA}
        status={
          discordLinked
            ? dict.ACCOUNT_REQUESTS_2FA_OFF
            : dict.ACCOUNT_REQUESTS_LINK_FIRST
        }
      />
      {canLink && (
        <>
          <RowDivider />
          <ActionRow
            icon="add-link"
            label={dict.ACCOUNT_REQUESTS_LINK_DISCORD}
            busy={busy === "link-discord"}
            disabled={busy !== null}
            onPress={onLinkDiscord}
          />
        </>
      )}
      {discordLinked && (
        <>
          <RowDivider />
          <ActionRow
            icon="help-outline"
            label={dict.ACCOUNT_REQUESTS_2FA_HELP}
            description={dict.ACCOUNT_REQUESTS_2FA_HELP_DESC}
            onPress={() => {
              void Linking.openURL(DISCORD_2FA_HELP_URL).catch((error) =>
                console.warn(
                  "[Account] failed to open Discord's 2FA help:",
                  error,
                ),
              );
            }}
          />
          <RowDivider />
          <ActionRow
            icon="refresh"
            label={dict.ACCOUNT_REQUESTS_REFRESH}
            description={dict.ACCOUNT_REQUESTS_REFRESH_DESC}
            busy={busy === "requests-refresh"}
            disabled={busy !== null}
            onPress={onRefresh}
          />
        </>
      )}
    </>
  );
}

/**
 * "Song requests": the account's verification, spelled out. The server only
 * says whether the account is `verified` (Discord linked AND Discord 2FA on) —
 * never Discord's 2FA flag itself — so a linked-but-unverified account is
 * read as "2FA was off at the last check", which the refresh row re-runs.
 */
export function RequestsStatus({
  profile,
  busy,
  onLinkDiscord,
  onRefresh,
}: Readonly<Props>) {
  const dict = useDict();
  if (!profile) return null;

  return (
    <>
      <SectionTitle title={dict.ACCOUNT_REQUESTS_TITLE} icon="verified-user" />
      <View style={styles.group}>
        {profile.user.verified ? (
          <Step
            done
            label={dict.ACCOUNT_REQUESTS_READY}
            status={dict.ACCOUNT_REQUESTS_READY_DESC}
          />
        ) : (
          <Checklist
            discordLinked={profile.linkedProviders.some(
              (entry) => entry.provider === "discord",
            )}
            busy={busy}
            onLinkDiscord={onLinkDiscord}
            onRefresh={onRefresh}
          />
        )}
      </View>
    </>
  );
}
