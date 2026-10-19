import type { ComponentProps, ReactNode } from "react";
import { useCallback, useState } from "react";
import { Icon } from "@/components/Icon";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API } from "@/api";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { Logo } from "@/components/Logo";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionTitle } from "@/components/SectionTitle";
import { SocialIcon, type SocialBrand } from "@/components/SocialIcon";
import { ActionRow, IconBox, RowBody, RowDivider } from "@/components/ListRow";
import { InfoRow, LinkRow } from "@/screens/Settings/rows";
import { useDict } from "@/hooks/useDict";
import type { Dict } from "@/i18n";
import { useStackedRows } from "@/hooks/useStackedRows";
import { useScrollEndPadding } from "@/hooks/useScrollEndPadding";
import type { RootStackParamList } from "@/routes/app.routes";
import { haptics } from "@/utils/haptics";
import { openExternal, openInAppBrowser } from "@/utils/browser";
import { THEME } from "@/theme";
import { layoutEase } from "@/utils/layout-animation";
import ccLicense from "@/assets/cc-by-nc-sa.webp";
import {
  DEVELOPERS,
  DONORS,
  FOUNDER,
  ILLUSTRATOR,
} from "@/screens/About/credits";
import { useAppInfo } from "@/screens/About/info";
import type { ReleaseChannel } from "@/utils/release-channel";
import { styles } from "@/screens/About/styles";

type Props = NativeStackScreenProps<RootStackParamList, "About">;

type IconName = ComponentProps<typeof Icon>["name"];

const APP_NAME = "Rádio Animu";
const MAINTAINER = "Ricardo Freitas (Ness)";

interface DetailRowProps {
  icon: IconName;
  label: string;
  value: string;
}

/** Read-only key/value row (no chevron, no press) — "Technical details". */
function DetailRow({ icon, label, value }: Readonly<DetailRowProps>) {
  const stacked = useStackedRows();

  const valueText = (stackedValue: boolean) => (
    <Text
      maxFontSizeMultiplier={THEME.FONT_SCALE.CONTENT}
      style={stackedValue ? styles.rowValueStacked : styles.rowValue}
    >
      {value}
    </Text>
  );

  return (
    // Screen readers read the pair as one item instead of label, value.
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${label}, ${value}`}
    >
      <IconBox>
        <Icon name={icon} size={THEME.ICON.MD} color={THEME.COLORS.TEXT} />
      </IconBox>
      {/* Large text: the value drops under the label so the label keeps
          the full row width. */}
      <RowBody label={label}>{stacked ? valueText(true) : undefined}</RowBody>
      {!stacked && valueText(false)}
    </View>
  );
}

interface SocialRowProps {
  brand: SocialBrand;
  label: string;
  /** Optional short supporting line under the label. */
  description?: string;
  /** Screen-reader hint, localized by the screen that renders the row. */
  hint: string;
  onPress: () => void;
}

/** Link row that leads with the network's real brand mark. */
function SocialRow({
  brand,
  label,
  description,
  hint,
  onPress,
}: Readonly<SocialRowProps>) {
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityHint={hint}
      activeOpacity={THEME.OPACITY.PRESSED}
      onPress={onPress}
      style={styles.row}
    >
      <IconBox>
        <SocialIcon
          brand={brand}
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT}
        />
      </IconBox>
      <RowBody label={label} description={description} />
      <Icon
        name="open-in-new"
        size={THEME.ICON.MD}
        color={THEME.COLORS.TEXT_DIM}
      />
    </TouchableOpacity>
  );
}

interface DisclosureProps {
  icon: IconName;
  label: string;
  /** Trailing value beside the chevron (e.g. the donor count). */
  value?: string;
  children: ReactNode;
}

/**
 * Settings-style dropdown row, mirroring the Select rows: tap to unfold the
 * children in place — no modal, no portal.
 */
function Disclosure({ icon, label, value, children }: Readonly<DisclosureProps>) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    haptics.select();
    layoutEase();
    setExpanded((current) => !current);
  };

  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}, ${value}` : label}
        accessibilityState={{ expanded }}
        activeOpacity={THEME.OPACITY.PRESSED}
        onPress={toggle}
        style={styles.row}
      >
        <IconBox>
          <Icon name={icon} size={THEME.ICON.MD} color={THEME.COLORS.TEXT} />
        </IconBox>
        <RowBody label={label} />
        {value != null && (
          <Text
            maxFontSizeMultiplier={THEME.FONT_SCALE.CONTENT}
            style={styles.rowValue}
          >
            {value}
          </Text>
        )}
        <Icon
          name={expanded ? "expand-less" : "expand-more"}
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT_DIM}
        />
      </TouchableOpacity>

      {expanded && <View>{children}</View>}
    </View>
  );
}

/** The donor thanks, folded into a single dropdown row. */
function DonorDisclosure({ dict }: Readonly<{ dict: Dict }>) {
  return (
    <Disclosure
      icon="favorite"
      label={dict.ABOUT_DONORS_TITLE}
      value={`${DONORS.length}`}
    >
      <Text style={styles.paragraph}>{dict.ABOUT_DONORS_INTRO}</Text>
      {DONORS.map((donor) => (
        <View key={donor.name} style={styles.donor}>
          <Text style={styles.donorName}>{donor.name}</Text>
          {donor.note && <Text style={styles.donorNote}>{donor.note}</Text>}
        </View>
      ))}
    </Disclosure>
  );
}

interface TechnicalDisclosureProps {
  dict: Dict;
  versionLabel: string;
  releaseLabel: string | null;
  applicationId: string | null;
  onCopy: () => void;
}

/** Version/distribution facts, folded to stay out of the way. */
function TechnicalDisclosure({
  dict,
  versionLabel,
  releaseLabel,
  applicationId,
  onCopy,
}: Readonly<TechnicalDisclosureProps>) {
  return (
    <Disclosure icon="info" label={dict.ABOUT_APP_INFO_TITLE}>
      <DetailRow
        icon="numbers"
        label={dict.ABOUT_VERSION_ROW}
        value={versionLabel}
      />
      {/* Only once the channel is resolved — the row never shows a
          placeholder that would flash against the real value. */}
      {releaseLabel && (
        <>
          <RowDivider />
          <DetailRow
            icon="corporate-fare"
            label={dict.ABOUT_RELEASE_ROW}
            value={releaseLabel}
          />
        </>
      )}
      {applicationId && (
        <>
          <RowDivider />
          <DetailRow
            icon="apps"
            label={dict.ABOUT_PACKAGE_ROW}
            value={applicationId}
          />
        </>
      )}
      <RowDivider />
      <ActionRow
        icon="content-copy"
        label={dict.ABOUT_COPY_DETAILS}
        onPress={onCopy}
      />
    </Disclosure>
  );
}

export function About({ navigation }: Readonly<Props>) {
  const dict = useDict();
  const endPadding = useScrollEndPadding();
  const info = useAppInfo();
  const { toast } = useAlert();

  /** Same as the module helpers but user-visible: a toast on failure,
      whichever route the link takes — in-app or the system browser. */
  const openLink = useCallback(
    (opener: (url: string) => Promise<void>, url: string) => {
      void opener(url).catch((error) => {
        console.warn("[About] openURL failed:", error);
        toast(dict.ABOUT_OPEN_ERROR, "error");
      });
    },
    [toast, dict],
  );

  const releaseLabel: string | null = info.release
    ? (
        {
          "app-store": dict.ABOUT_RELEASE_APP_STORE,
          "ad-hoc": dict.ABOUT_RELEASE_ADHOC,
          development: dict.ABOUT_RELEASE_DEVELOPMENT,
          simulator: dict.ABOUT_RELEASE_SIMULATOR,
          enterprise: dict.ABOUT_RELEASE_ENTERPRISE,
          play: dict.ABOUT_RELEASE_PLAY,
          unknown: dict.ABOUT_RELEASE_UNKNOWN,
        } as Record<ReleaseChannel, string>
      )[info.release]
    : null;

  const buildSuffix = info.buildVersion ? ` (${info.buildVersion})` : "";
  const versionLabel = info.appVersion
    ? `v${info.appVersion}${buildSuffix}`
    : dict.ABOUT_VERSION_UNAVAILABLE;

  const details: string = [
    `${APP_NAME} ${versionLabel}`,
    releaseLabel,
    info.applicationId,
    `${Platform.OS === "ios" ? "iOS" : "Android"} ${Platform.Version}`,
  ]
    .filter(Boolean)
    .join(" · ");

  // "Copied" only once the clipboard actually took it.
  const copyDetails = () => {
    haptics.select();
    Clipboard.setStringAsync(details)
      .then(() => toast(dict.ABOUT_COPIED))
      .catch((error) => {
        console.warn("[About] copy failed:", error);
        toast(dict.ABOUT_COPY_FAILED, "error");
      });
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScreenHeader
        title={dict.ABOUT_TITLE}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={[
          styles.appContainer,
          { paddingBottom: endPadding },
        ]}
      >
        <View style={styles.header}>
          <Logo size={THEME.LAYOUT.LOGO_HEIGHT} />
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.headerVersion}>{versionLabel}</Text>
        </View>

        {/* Help and community, the links a listener most likely needs. */}
        <SectionTitle title={dict.ABOUT_HELP_TITLE} icon="link" first />
        <View style={styles.group}>
          <SocialRow
            brand="discord"
            label={dict.ABOUT_DISCORD_HELP}
            description={dict.ABOUT_DISCORD_DESC}
            hint={dict.ABOUT_OPENS_BROWSER}
            onPress={() => openLink(openExternal, API.DISCORD_URL)}
          />
          <RowDivider />
          <LinkRow
            icon="public"
            label={dict.LINKS_WEBSITE}
            description="www.animu.moe"
            onPress={() => openLink(openInAppBrowser, API.WEB_URL)}
          />
          <RowDivider />
          <SocialRow
            brand="github"
            label={dict.SETTINGS_FOOTER_SOURCE}
            hint={dict.ABOUT_OPENS_BROWSER}
            onPress={() => openLink(openExternal, API.GITHUB_URL)}
          />
        </View>

        {/* The app's maintainer and founder; the wider team signs the footer. */}
        <SectionTitle title={dict.ABOUT_CREDITS_TITLE} icon="groups" />
        <View style={styles.group}>
          <LinkRow
            icon="code"
            label={dict.ABOUT_ROLE_MAINTAINER}
            description={MAINTAINER}
            onPress={() => openLink(openInAppBrowser, API.MAINTAINER_URL)}
          />
          <RowDivider />
          <InfoRow
            icon="palette"
            label={dict.ABOUT_ROLE_FOUNDER}
            description={FOUNDER}
          />
          <RowDivider />
          <DonorDisclosure dict={dict} />
        </View>

        <SectionTitle title={dict.SETTINGS_LEGAL_TITLE} icon="gavel" />
        <View style={styles.group}>
          <LinkRow
            icon="privacy-tip"
            label={dict.SETTINGS_PRIVACY_POLICY}
            onPress={() => openLink(openInAppBrowser, API.PRIVACY_URL)}
          />
          <RowDivider />
          <LinkRow
            icon="copyright"
            label={dict.SETTINGS_CONTENT_LICENSE}
            description={dict.SETTINGS_CONTENT_LICENSE_DESC}
            onPress={() =>
              openLink(openInAppBrowser, API.CONTENT_LICENSE_URL)
            }
          />
        </View>

        <SectionTitle title={dict.SETTINGS_FOOTER_SOCIAL} icon="share" />
        <View style={styles.group}>
          <SocialRow
            brand="facebook"
            label={dict.LINKS_FACEBOOK}
            hint={dict.ABOUT_OPENS_BROWSER}
            onPress={() => openLink(openExternal, API.FACEBOOK_URL)}
          />
          <RowDivider />
          <SocialRow
            brand="x"
            label={dict.LINKS_X}
            hint={dict.ABOUT_OPENS_BROWSER}
            onPress={() => openLink(openExternal, API.X_URL)}
          />
          <RowDivider />
          <SocialRow
            brand="bluesky"
            label={dict.LINKS_BLUESKY}
            hint={dict.ABOUT_OPENS_BROWSER}
            onPress={() => openLink(openExternal, API.BLUESKY_URL)}
          />
        </View>

        {/* Its own card, spaced like a section: collapsed, it is one row. */}
        <View style={styles.groupSpaced}>
          <TechnicalDisclosure
            dict={dict}
            versionLabel={versionLabel}
            releaseLabel={releaseLabel}
            applicationId={info.applicationId}
            onCopy={copyDetails}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLine}>{dict.SETTINGS_FOOTER_TEAM}</Text>
          <Text style={styles.footerLine}>
            {dict.ABOUT_ROLE_FOUNDER}: {FOUNDER}
          </Text>
          <Text style={styles.footerLine}>
            {dict.ABOUT_ROLE_DEV}: {DEVELOPERS.join(", ")}
          </Text>
          {/* Its own touchable (not a nested Text link) so screen readers
              reach it, with slop for a full-size tap target. */}
          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel={`${dict.ABOUT_ROLE_CHIHAYA}: ${ILLUSTRATOR}`}
            accessibilityHint={dict.ABOUT_OPENS_IN_APP}
            hitSlop={THEME.HIT_SLOP.MD}
            activeOpacity={THEME.OPACITY.PRESSED}
            onPress={() => openLink(openInAppBrowser, API.PIXIV_URL)}
          >
            <Text style={styles.footerLine}>
              {dict.ABOUT_ROLE_CHIHAYA}:{" "}
              <Text style={styles.footerLink}>{ILLUSTRATOR}</Text>
            </Text>
          </TouchableOpacity>
          <Text style={styles.footerLine}>
            {dict.SETTINGS_COPYRIGHT_NOTICE} · {dict.SETTINGS_FOOTER_LOCATION}
          </Text>
          <Text style={styles.footerLine}>{dict.SETTINGS_FOOTER_SYSTEM}</Text>
          <Text style={styles.footerLine}>{dict.SETTINGS_IMAGE_RIGHTS}</Text>
          <Text style={styles.footerLine}>
            {dict.SETTINGS_FOOTER_NONPROFIT}
          </Text>
          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel={dict.SETTINGS_FOOTER_LICENSE}
            accessibilityHint={dict.ABOUT_OPENS_IN_APP}
            hitSlop={THEME.HIT_SLOP.MD}
            activeOpacity={THEME.OPACITY.PRESSED}
            onPress={() =>
              openLink(openInAppBrowser, API.CONTENT_LICENSE_URL)
            }
          >
            <Image
              source={ccLicense}
              contentFit="contain"
              style={styles.badge}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
