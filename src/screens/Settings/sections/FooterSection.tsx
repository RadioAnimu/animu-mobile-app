import * as Linking from "expo-linking";
import { Image } from "expo-image";
import { Text, TouchableOpacity, View } from "react-native";

import { version } from "@app/package.json";
import { API } from "@/api";
import { Logo } from "@/components/Logo";
import { SocialIcon, type SocialBrand } from "@/components/SocialIcon";
import { useDict } from "@/hooks/useDict";
import { styles } from "@/screens/Settings/styles";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import ccLicense from "@/assets/cc-by-nc-sa.webp";

/** Dev portfolio — the credits hyperlink target. */
const PORTFOLIO_URL = "https://rmotafreitas.dev";

/** Lead mobile-app maintainer, credited above the whole team. */
const AUTHOR_NAME = "Ricardo Freitas (Ness)";

/** Footer wordmark height — same asset as the player and drawer. */
const LOGO_HEIGHT = scale(56);

const open = (url: string) => {
  void Linking.openURL(url).catch((error) =>
    console.warn("[Links] openURL failed:", error),
  );
};

interface FooterLinkProps {
  label: string;
  url: string;
}

/** Inline hyperlink — no pill, no icon: the same quiet type as its line. */
function FooterLink({ label, url }: FooterLinkProps) {
  return (
    <Text
      accessibilityRole="link"
      style={styles.footerLink}
      onPress={() => open(url)}
    >
      {label}
    </Text>
  );
}

interface SocialLinkProps {
  brand: SocialBrand;
  label: string;
  url: string;
}

/**
 * Icon + label link in the social row. Icon-only reads as decoration, so
 * every entry keeps its word next to the brand mark.
 */
function SocialLink({ brand, label, url }: SocialLinkProps) {
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={label}
      activeOpacity={0.7}
      onPress={() => open(url)}
      style={styles.footerSocial}
    >
      <SocialIcon brand={brand} size={scale(18)} color={THEME.COLORS.BRAND} />
      <Text style={styles.footerSocialLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Page footer modeled on animu.moe: the app author first, then the Animu
 * team (founder + devs), the copyright/legal notices, the Creative Commons
 * badge and the radio's social profiles — all in one quiet, centered block.
 */
export function FooterSection() {
  const dict = useDict();

  return (
    <View style={styles.footer}>
      <Logo size={LOGO_HEIGHT} />
      <Text style={styles.footerVersion}>{`v${version}`}</Text>

      <View style={styles.footerBlock}>
        <Text style={styles.footerLead}>
          {dict.SETTINGS_FOOTER_APP_CREDIT}{" "}
          <FooterLink label={AUTHOR_NAME} url={PORTFOLIO_URL} />
        </Text>
        <Text style={styles.footerTeam}>{dict.SETTINGS_FOOTER_TEAM}</Text>
      </View>

      <View style={styles.footerBlock}>
        <Text style={styles.footerLegal}>{dict.SETTINGS_FOOTER_FOUNDER}</Text>
        <Text style={styles.footerLegal}>{dict.SETTINGS_FOOTER_DEV}</Text>
      </View>

      <View style={styles.footerBlock}>
        <Text style={styles.footerLegal}>{dict.SETTINGS_COPYRIGHT_NOTICE}</Text>
        <Text style={styles.footerLegal}>{dict.SETTINGS_FOOTER_LOCATION}</Text>
        <Text style={styles.footerLegal}>{dict.SETTINGS_FOOTER_SYSTEM}</Text>
        <Text style={styles.footerLegal}>{dict.SETTINGS_IMAGE_RIGHTS}</Text>
        <Text style={styles.footerLegal}>
          {dict.SETTINGS_FOOTER_CHIHAYA}{" "}
          <FooterLink label={dict.SETTINGS_FOOTER_NPC} url={API.PIXIV_URL} />
        </Text>
      </View>

      <View style={styles.footerBlock}>
        <Text style={styles.footerLegal}>{dict.SETTINGS_FOOTER_NONPROFIT}</Text>
        <TouchableOpacity
          accessibilityRole="link"
          accessibilityLabel={dict.SETTINGS_FOOTER_LICENSE}
          activeOpacity={0.7}
          onPress={() => open(API.LICENSE_URL)}
        >
          <Image
            source={ccLicense}
            contentFit="contain"
            style={styles.footerBadge}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.footerBlock}>
        <Text style={styles.footerLegal}>{dict.SETTINGS_FOOTER_SOCIAL}</Text>
        <View style={styles.footerSocials}>
          <SocialLink
            brand="facebook"
            label="Facebook"
            url={API.FACEBOOK_URL}
          />
          <SocialLink brand="x" label="X" url={API.X_URL} />
          <SocialLink brand="bluesky" label="Bluesky" url={API.BLUESKY_URL} />
        </View>
      </View>

      <View style={styles.footerBlock}>
        <Text style={styles.footerLegal}>{dict.SETTINGS_FOOTER_SOURCE}</Text>
        <View style={styles.footerSocials}>
          <SocialLink brand="github" label="GitHub" url={API.GITHUB_URL} />
        </View>
      </View>
    </View>
  );
}
