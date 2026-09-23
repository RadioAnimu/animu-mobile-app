import type { ComponentProps } from "react";
import { useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import * as Linking from "expo-linking";
import { DrawerScreenProps } from "@react-navigation/drawer";
import { Image } from "expo-image";
import {
  LayoutAnimation,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API } from "@/api";
import { Background } from "@/components/Background";
import { Logo } from "@/components/Logo";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionTitle } from "@/components/SectionTitle";
import { SocialIcon, type SocialBrand } from "@/components/SocialIcon";
import { useOtaUpdate } from "@/hooks/useOtaUpdate";
import { useDict } from "@/hooks/useDict";
import { RootStackParamList } from "@/routes/app.routes";
import { haptics } from "@/utils/haptics";
import { Divider, InfoRow, LinkRow, ValueRow } from "@/screens/Settings/rows";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import ccLicense from "@/assets/cc-by-nc-sa.webp";
import { DONORS } from "@/screens/About/credits";
import { useAppInfo } from "@/screens/About/info";
import { styles } from "@/screens/About/styles";

type Props = DrawerScreenProps<RootStackParamList, "About">;

type IconName = ComponentProps<typeof MaterialIcons>["name"];

const APP_NAME = "Rádio Animu";
const MAINTAINER = "Ricardo Freitas (Ness)";

const open = (url: string) => {
  void Linking.openURL(url).catch((error) =>
    console.warn("[About] openURL failed:", error),
  );
};

interface DetailRowProps {
  icon: IconName;
  label: string;
  value: string;
}

/** Read-only key/value row (no chevron, no press) — the "Device details" row. */
function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <MaterialIcons
          name={icon}
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT}
        />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

interface SocialRowProps {
  brand: SocialBrand;
  label: string;
  url: string;
}

/** Link row that leads with the network's real brand mark. */
function SocialRow({ brand, label, url }: SocialRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={label}
      activeOpacity={0.7}
      onPress={() => open(url)}
      style={styles.row}
    >
      <View style={styles.rowIcon}>
        <SocialIcon
          brand={brand}
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT}
        />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <MaterialIcons
        name="open-in-new"
        size={THEME.ICON.MD}
        color={THEME.COLORS.TEXT_DIM}
      />
    </TouchableOpacity>
  );
}

/**
 * Donor list folded into a single settings-style dropdown row, mirroring
 * the Select rows: tap to unfold the thank-you note and every donor in
 * place — no modal, no portal.
 */
function DonorDisclosure({ label, intro }: { label: string; intro: string }) {
  const [open, setOpen] = useState(false);

  const animate = () =>
    LayoutAnimation.configureNext({
      duration: 180,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });

  const toggle = () => {
    haptics.select();
    animate();
    setOpen((current) => !current);
  };

  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        activeOpacity={0.7}
        onPress={toggle}
      >
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <MaterialIcons
              name="favorite"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT}
            />
          </View>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowValue} numberOfLines={1}>
            {DONORS.length}
          </Text>
          <MaterialIcons
            name={open ? "expand-less" : "expand-more"}
            size={THEME.ICON.MD}
            color={THEME.COLORS.TEXT_DIM}
          />
        </View>
      </TouchableOpacity>

      {open && (
        <View>
          <Text style={styles.paragraph}>{intro}</Text>
          {DONORS.map((donor) => (
            <View key={donor.name} style={styles.donor}>
              <Text style={styles.donorName}>{donor.name}</Text>
              {donor.note && (
                <Text style={styles.donorNote} numberOfLines={1}>
                  {donor.note}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function About({ navigation }: Props) {
  const dict = useDict();
  const info = useAppInfo();
  const { value: otaStatusValue, check } = useOtaUpdate();

  const releaseLabel: string = {
    "app-store": dict.ABOUT_RELEASE_APP_STORE,
    "ad-hoc": dict.ABOUT_RELEASE_ADHOC,
    development: dict.ABOUT_RELEASE_DEVELOPMENT,
    simulator: dict.ABOUT_RELEASE_SIMULATOR,
    enterprise: dict.ABOUT_RELEASE_ENTERPRISE,
    play: dict.ABOUT_RELEASE_PLAY,
    apk: dict.ABOUT_RELEASE_APK,
    unknown: dict.ABOUT_RELEASE_UNKNOWN,
  }[info.release];

  const otaVersionLabel =
    info.otaVersion == null
      ? dict.ABOUT_OTA_LOADING
      : info.otaVersion === 0
        ? dict.ABOUT_OTA_BUILTIN
        : String(info.otaVersion);

  const versionLabel = info.appVersion
    ? `v${info.appVersion}${info.buildVersion ? ` (${info.buildVersion})` : ""}`
    : dict.ABOUT_OTA_LOADING;

  return (
    <Background>
      <SafeAreaView
        style={styles.container}
        edges={["left", "right", "bottom"]}
      >
        <ScreenHeader
          title={dict.ABOUT_TITLE}
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={styles.appContainer}>
          <View style={styles.header}>
            <Logo size={scale(96)} />
            <Text style={styles.appName}>{APP_NAME}</Text>
            <Text style={styles.headerVersion}>{versionLabel}</Text>
          </View>

          {/* App facts, Android "about phone" style — identity + update check
              in one card. */}
          <SectionTitle title={dict.ABOUT_APP_INFO_TITLE} icon="info" first />
          <View style={styles.group}>
            {info.otaSupported && (
              <>
                <ValueRow
                  icon="system-update"
                  label={dict.SETTINGS_UPDATES_ROW}
                  value={otaStatusValue()}
                  onPress={() => void check()}
                />
                <Divider />
              </>
            )}
            <DetailRow
              icon="numbers"
              label={dict.ABOUT_VERSION_ROW}
              value={versionLabel}
            />
            <Divider />
            <DetailRow
              icon="corporate-fare"
              label={dict.ABOUT_RELEASE_ROW}
              value={releaseLabel}
            />
            {info.otaSupported && (
              <>
                <Divider />
                <DetailRow
                  icon="system-update"
                  label={dict.ABOUT_OTA_VERSION_ROW}
                  value={otaVersionLabel}
                />
              </>
            )}
            {info.applicationId && (
              <>
                <Divider />
                <DetailRow
                  icon="apps"
                  label={dict.ABOUT_PACKAGE_ROW}
                  value={info.applicationId}
                />
              </>
            )}
          </View>

          <SectionTitle title={dict.LINKS} icon="link" />
          <View style={styles.group}>
            <LinkRow
              icon="public"
              label={dict.LINKS_WEBSITE}
              onPress={() => open(API.WEB_URL)}
            />
            <Divider />
            <SocialRow
              brand="discord"
              label={dict.LINKS_DISCORD}
              url={API.DISCORD_URL}
            />
            <Divider />
            <SocialRow
              brand="github"
              label={dict.SETTINGS_FOOTER_SOURCE}
              url={API.GITHUB_URL}
            />
          </View>

          <SectionTitle title={dict.SETTINGS_FOOTER_SOCIAL} icon="share" />
          <View style={styles.group}>
            <SocialRow
              brand="facebook"
              label="Facebook"
              url={API.FACEBOOK_URL}
            />
            <Divider />
            <SocialRow brand="x" label="X" url={API.X_URL} />
            <Divider />
            <SocialRow brand="bluesky" label="Bluesky" url={API.BLUESKY_URL} />
          </View>

          <SectionTitle title={dict.ABOUT_CREDITS_TITLE} icon="groups" />
          <View style={styles.group}>
            <InfoRow
              icon="code"
              label={dict.ABOUT_ROLE_MAINTAINER}
              description={MAINTAINER}
            />
            <Divider />
            <DonorDisclosure
              label={dict.ABOUT_DONORS_TITLE}
              intro={dict.ABOUT_DONORS_INTRO}
            />
          </View>

          <SectionTitle title={dict.SETTINGS_LEGAL_TITLE} icon="gavel" />
          <View style={styles.group}>
            <LinkRow
              icon="privacy-tip"
              label={dict.SETTINGS_PRIVACY_POLICY}
              onPress={() => open(API.PRIVACY_URL)}
            />
            <Divider />
            <LinkRow
              icon="copyright"
              label={dict.SETTINGS_CONTENT_LICENSE}
              description={dict.SETTINGS_CONTENT_LICENSE_DESC}
              onPress={() => open(API.CONTENT_LICENSE_URL)}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerLine}>{dict.SETTINGS_FOOTER_TEAM}</Text>
            <Text style={styles.footerLine}>{dict.SETTINGS_FOOTER_FOUNDER}</Text>
            <Text style={styles.footerLine}>{dict.SETTINGS_FOOTER_DEV}</Text>
            <Text style={styles.footerLine}>
              {dict.SETTINGS_COPYRIGHT_NOTICE} · {dict.SETTINGS_FOOTER_LOCATION}
            </Text>
            <Text style={styles.footerLine}>{dict.SETTINGS_FOOTER_SYSTEM}</Text>
            <Text style={styles.footerLine}>{dict.SETTINGS_IMAGE_RIGHTS}</Text>
            <Text style={styles.footerLine}>
              {dict.SETTINGS_FOOTER_CHIHAYA}{" "}
              <Text
                style={styles.footerLink}
                onPress={() => open(API.PIXIV_URL)}
              >
                {dict.SETTINGS_FOOTER_NPC}
              </Text>
            </Text>
            <Text style={styles.footerLine}>
              {dict.SETTINGS_FOOTER_NONPROFIT}
            </Text>
            <TouchableOpacity
              accessibilityRole="link"
              accessibilityLabel={dict.SETTINGS_FOOTER_LICENSE}
              activeOpacity={0.7}
              onPress={() => open(API.CONTENT_LICENSE_URL)}
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
    </Background>
  );
}
