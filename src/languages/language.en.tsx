import Svg, { SvgProps, Rect, Path } from "react-native-svg";
import logo from "../assets/logo_EN.png";
import { Program } from "../utils/player.config";
import { version } from "../../package.json";
import ultimas_pedidas from "../assets/ultimos_pedidas-haru_en.png";
import ultimas_tocadas from "../assets/ultimas_tocadas-haru_en.png";
import fazer_pedido from "../assets/pedidos_harukinha_en.png";

const LANG = {
  key: "EN",
  value: "English",
};

const PROGRAMS: Program[] = [
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Jiyuu-Jikan-Logo.webp",
    name: "Jiyuu Jikan",
    dj: "Anyone who's part of the broadcasting team",
    theme: "Anyone (being otaku is what matters!)",
    dayAndTime: "Anytime",
    information:
      "The program where we invade DJ Haruka's schedule and make her have that little coffee break. And it can happen anytime, anywhere, on the most moe radio in Brazil!",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/AnimuSong-Logo.webp",
    name: "AnimuSong",
    dj: "LL!",
    theme: "TOP 10 most requested",
    dayAndTime: "Every Tuesday from 08:00 pm to 09:20 pm (BRT)",
    information:
      "The TOP 10 of the most moe in Brazil! Based on the most requested songs by listeners in the last week.",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/08/Logo-Natsukashii.webp",
    name: "Natsukashii",
    dj: "Dolode",
    theme: "Nostalgia",
    dayAndTime: "Thursday from 08:00 pm to 9:00 pm (BRT)",
    information:
      "The program that will take you back in time, bringing the best of animusongs that marked generations, including the captivating and contagious rhythm of City Pop!",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Expresso-Otaku-Logo.webp",
    name: "Otaku Express",
    dj: "LL!",
    theme: "Quiz",
    dayAndTime: "Saturday from 08:00 pm to 11:00 pm (BRT)",
    information:
      "Get on board with me on this express full of otaku-ness! Otaku Express is a program where you, the listener, test your otaku level live with me, DJ LL! And if you win, you become the otaku of the week on our Discord 🏆",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Animu-Plus-logo-final.webp",
    name: "Animu+",
    dj: "Anyone who is part of the broadcasting team along with listeners",
    theme: "Anyone (Being otaku is what matters²)",
    dayAndTime: "Sunday from 06:00 pm to 9:00 pm (BRT)",
    information:
      "Animu Plus is a program where listeners participate live, being part of and interacting with the announcers. We really like being close to our listeners, and this program was created especially for that!",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Logo-DollarRocks-1.webp",
    name: "DollarRocks!",
    dj: "Dollar$",
    theme: "J-rock",
    dayAndTime: "Sunday from 09:00 pm to 12:00 am (BRT)",
    information:
      "The Japanese rock god descended to earth and entrusted me with spreading the word to all his followers. The 3 most important rules are Rock today, Rock tomorrow, and Rock forever. 🤘😝",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Yoake-Logo.webp",
    name: "Yoake",
    dj: "Haruka Yuki",
    theme: "Music Block",
    dayAndTime: "Every day from 05:00 am to 07:00 am (BRT)",
    information:
      "Our dawn! Yoake was made to cheer up the beginning of your day with lots of good music where you also command the sequence live! 🌄",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/04/Kohi-Logo.webp",
    name: "Kohi",
    dj: "Haruka Yuki",
    theme: "Music Block",
    dayAndTime: "Every day from 07:00 am to 09:00 am (BRT)",
    information:
      "The block that wakes you up in your otaku mornings! Prepare your coffee and make the sequence with our Haru-chan ☕",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Animu-Ohayou-Logo-maior.webp",
    name: "Animu Ohayou",
    dj: "Haruka Yuki",
    theme: "Music Block",
    dayAndTime: "Every day from 09:00 am to 12:00 pm (BRT)",
    information:
      "Our morning commanded by you! The best way to enjoy the best part of the day here in the most moe of Brazil! ☀️",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Gohan-Desu-Logo.webp",
    name: "Gohan desu!",
    dj: "Haruka Yuki",
    theme: "Music Block",
    dayAndTime: "Every day from 12:00 pm to 02:00 pm (BRT)",
    information:
      "Your liveliest lunchtime here at your Animu 😋🍴 Lunchtime is very sacred to us, so at this time, it owns its own music block!",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Oyatsu-Logo.webp",
    name: "Oyatsu",
    dj: "Haruka Yuki",
    theme: "Music Block",
    dayAndTime: "Every day from 04:00 pm to 06:00 pm (BRT)",
    information:
      "Your sweetest and most fun afternoon in the most moe of Brazil! 🍰 Your snack time where you make the sequence in the afternoons with our Haru-chan",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Nemukunai-logo.webp",
    name: "Nemukunai",
    dj: "Haruka Yuki",
    theme: "Music Block",
    dayAndTime: "Every day from 12:00 am to 05:00 am (BRT)",
    information:
      "Our sleepless night! 🌙 Nemukunai is the Animu block perfect for listeners who are awake and want to listen to their favorite songs live with Haru-chan on the most moe of Brazil 💜",
  },
];

const DICT = {
  PROGRAMS,
  TIME_REMAINING: "Time remaining",
  WITH_DJ: "WITH",
  MENU: "Menu",
  MENU_LAST_REQUESTED: "Last Requests",
  MENU_LAST_PLAYED: "Last Played",
  LINKS: "Links",
  LINKS_DISCORD: "Discord",
  LINKS_WEBSITE: "Website",
  VERSION_TEXT: `Version v${version} - Developed with lots of ❤️ by`,
  SETTINGS_TITLE: "Settings",
  SETTINGS_ACCOUNT_TITLE: "Account",
  SETTINGS_SAVE_DATA_TITLE: "Data Saving",
  SETTINGS_QUALITY_LIVE_LABEL: "Live cover quality:",
  SETTINGS_QUALITY_LIVE_LABEL_LOW: "Low",
  SETTINGS_QUALITY_LIVE_LABEL_MEDIUM: "Medium",
  SETTINGS_QUALITY_LIVE_LABEL_HIGH: "High",
  SETTINGS_COVER_LIVE_LABEL_SWITCH: "Live covers:",
  SETTINGS_COVER_LAST_REQUESTED_SWITCH: "Last requested covers:",
  SETTINGS_COVER_LAST_PLAYED_SWITCH: "Last played covers:",
  SETTINGS_COVER_REQUESTED_SWITCH: "Request with covers:",
  SETTINGS_LANGUAGE_SELECT_TITLE: "Language Selection",
  SETTINGS_LANGUAGE_SELECT_PLACEHOLDER: "Select a language",
  SETTINGS_MEMORY_TITLE: "Memory",
  SETTINGS_MEMORY_CLEAR_CACHE_SWITCH: "Cache cover images:",
  TRACK_REQUEST: "REQUESTED SONG",
  INFO_REQUEST: `Hi! I'm Haruka, the DJ of the most moe in Brazil!${"\n"}I see you've made your choice!${"\n"}But before that, would you like to leave a message for me or for our team? This message will be delivered in the main chat of our Discord server for everyone to see${"\n"}💜 You don't have to leave a message if you don't want to.`,
  SEND_REQUEST_BUTTON_TEXT: "Send",
  SEND_REQUEST_PLACEHOLDER: "Leave your message here",
  LOGIN_ERROR: "You need to be logged in to make a request",
  SELECT_ERROR: "Error selecting the song",
  REQUEST_ERROR: "Error making request: ",
  REQUEST_ERROR_ALREADY_REQUESTED: "Song has already been requested before",
  REQUEST_SUCCESS: "Request made successfully!",
  REQUEST_SEARCH_PLACEHOLDER: "Type here to search",
  REQUEST_SEARCH_BUTTON_TEXT: "Search",
  HARU_CHAN_TEXT: "HARU-CHAN",
  THEME_WORD: "Theme",
  LOGIN_WORD: "Login",
};

const NoArLabel = (props: SvgProps) => (
  <Svg width="41" height="92" viewBox="0 0 41 92" fill="none">
    <Rect width="41" height="92" fill="#FF0000" />
    <Path
      d="M29.288 77.5273C29.288 79.9433 28.512 81.9433 26.96 83.5273C25.392 85.0953 23.408 85.8793 21.008 85.8793C18.608 85.8793 16.632 85.0953 15.08 83.5273C13.512 81.9433 12.728 79.9433 12.728 77.5273C12.728 75.0953 13.504 73.0953 15.056 71.5273C16.608 69.9433 18.592 69.1513 21.008 69.1513C23.424 69.1513 25.408 69.9433 26.96 71.5273C28.512 73.0953 29.288 75.0953 29.288 77.5273ZM24.776 81.0553C25.768 80.1593 26.264 78.9833 26.264 77.5273C26.264 76.0713 25.768 74.8953 24.776 73.9993C23.784 73.1033 22.528 72.6553 21.008 72.6553C19.488 72.6553 18.232 73.1033 17.24 73.9993C16.248 74.8953 15.752 76.0713 15.752 77.5273C15.752 78.9833 16.248 80.1593 17.24 81.0553C18.232 81.9353 19.488 82.3753 21.008 82.3753C22.528 82.3753 23.784 81.9353 24.776 81.0553ZM29 52.4317L29 55.7197L18.56 63.3517L29 63.3517L29 66.7597L12.992 66.7597L12.992 63.2557L23.048 55.8397L12.992 55.8397L12.992 52.4317L29 52.4317ZM29 28.2067L29 32.0947L26.288 33.0787L26.288 39.9427L29 40.9507L29 44.8387L12.992 38.6467L12.992 34.3747L29 28.2067ZM23.288 34.0147L16.4 36.5107L23.288 39.0067L23.288 34.0147ZM29 23.3205L29 26.7285L12.992 26.7285L12.992 23.3205L29 23.3205ZM29 7.18256L29 11.0946L23.312 14.2386L23.312 16.7346L29 16.7346L29 20.1426L12.992 20.1426L12.992 12.6546C12.992 11.0066 13.472 9.70256 14.432 8.74256C15.392 7.76656 16.632 7.27856 18.152 7.27856C19.464 7.27856 20.528 7.62256 21.344 8.31056C22.16 8.98256 22.68 9.80656 22.904 10.7826L29 7.18256ZM20.312 13.1586C20.312 12.4546 20.12 11.8786 19.736 11.4306C19.336 10.9826 18.808 10.7586 18.152 10.7586C17.496 10.7586 16.976 10.9826 16.592 11.4306C16.192 11.8786 15.992 12.4546 15.992 13.1586L15.992 16.7346L20.312 16.7346L20.312 13.1586Z"
      fill="white"
    />
  </Svg>
);

const IMGS = {
  LIVE_LABEL: NoArLabel,
  LOGO: logo,
  LAST_REQUEST: ultimas_pedidas,
  LAST_PLAYED: ultimas_tocadas,
  MAKE_REQUEST: fazer_pedido,
};

export { DICT, IMGS, LANG };
