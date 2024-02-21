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

const PedidosAoVivoAtivados = (props: SvgProps) => {
  return (
    <Svg width="79" height="23" viewBox="0 0 79 23" fill="none">
      <Rect width="73" height="23" rx="4" fill="#6BDB00" />
      <Path d="M79 11.5L73 16L73 7L79 11.5Z" fill="#6BDB00" />
      <Path
        d="M14.994 16H8.858V7.329H14.994V8.954H10.704V10.787H14.903V12.412H10.704V14.375H14.994V16ZM24.1981 16H22.4171L18.2831 10.345V16H16.4371V7.329H18.3351L22.3521 12.776V7.329H24.1981V16ZM33.9938 16H31.8878L31.3548 14.531H27.6368L27.0908 16H24.9848L28.3388 7.329H30.6528L33.9938 16ZM30.8478 12.906L29.4958 9.175L28.1438 12.906H30.8478ZM39.5005 16H34.7945V7.329H39.3575C40.1462 7.329 40.7572 7.54567 41.1905 7.979C41.6325 8.40367 41.8535 8.92367 41.8535 9.539C41.8535 10.0677 41.7105 10.5097 41.4245 10.865C41.1385 11.2203 40.7832 11.4413 40.3585 11.528C40.8265 11.5973 41.2209 11.8357 41.5415 12.243C41.8622 12.6503 42.0225 13.1227 42.0225 13.66C42.0225 14.336 41.8015 14.895 41.3595 15.337C40.9175 15.779 40.2979 16 39.5005 16ZM38.9545 10.8C39.2665 10.8 39.5135 10.7133 39.6955 10.54C39.8775 10.3667 39.9685 10.1413 39.9685 9.864C39.9685 9.58667 39.8732 9.36133 39.6825 9.188C39.5005 9.006 39.2579 8.915 38.9545 8.915H36.6405V10.8H38.9545ZM39.0195 14.401C39.3662 14.401 39.6392 14.3143 39.8385 14.141C40.0379 13.959 40.1375 13.712 40.1375 13.4C40.1375 13.114 40.0379 12.8757 39.8385 12.685C39.6392 12.4857 39.3662 12.386 39.0195 12.386H36.6405V14.401H39.0195ZM48.9266 16H43.4146V7.329H45.2606V14.375H48.9266V16ZM56.3553 16H50.2193V7.329H56.3553V8.954H52.0653V10.787H56.2643V12.412H52.0653V14.375H56.3553V16ZM61.2174 16H57.7984V7.329H61.2174C62.5781 7.329 63.6831 7.72767 64.5324 8.525C65.3904 9.32233 65.8194 10.371 65.8194 11.671C65.8194 12.971 65.3948 14.0197 64.5454 14.817C63.6961 15.6057 62.5868 16 61.2174 16ZM61.2174 14.375C62.0494 14.375 62.7081 14.115 63.1934 13.595C63.6874 13.075 63.9344 12.4337 63.9344 11.671C63.9344 10.8737 63.6961 10.2237 63.2194 9.721C62.7428 9.20967 62.0754 8.954 61.2174 8.954H59.6444V14.375H61.2174Z"
        fill="#270052"
      />
    </Svg>
  );
};

const PedidosAoVivoDesativados = (props: SvgProps) => {
  return (
    <Svg width="81" height="23" viewBox="0 0 81 23" fill="none">
      <Rect width="76.1881" height="23" rx="4" fill="#6BDB00" />
      <Path d="M81 11.5L76.1881 16L76.1881 7L81 11.5Z" fill="#6BDB00" />
      <Path
        d="M11.277 16H7.858V7.329H11.277C12.6377 7.329 13.7427 7.72767 14.592 8.525C15.45 9.32233 15.879 10.371 15.879 11.671C15.879 12.971 15.4543 14.0197 14.605 14.817C13.7557 15.6057 12.6463 16 11.277 16ZM11.277 14.375C12.109 14.375 12.7677 14.115 13.253 13.595C13.747 13.075 13.994 12.4337 13.994 11.671C13.994 10.8737 13.7557 10.2237 13.279 9.721C12.8023 9.20967 12.135 8.954 11.277 8.954H9.704V14.375H11.277ZM19.0351 16H17.1891V7.329H19.0351V16ZM23.8374 16.156C22.2948 16.156 21.0728 15.6967 20.1714 14.778L21.1724 13.374C21.9178 14.154 22.8364 14.544 23.9284 14.544C24.4051 14.544 24.7734 14.453 25.0334 14.271C25.3021 14.0803 25.4364 13.8507 25.4364 13.582C25.4364 13.348 25.3108 13.153 25.0594 12.997C24.8168 12.841 24.5091 12.7283 24.1364 12.659C23.7724 12.5897 23.3738 12.49 22.9404 12.36C22.5071 12.23 22.1041 12.0827 21.7314 11.918C21.3674 11.7533 21.0598 11.4933 20.8084 11.138C20.5658 10.7827 20.4444 10.3493 20.4444 9.838C20.4444 9.09267 20.7434 8.46867 21.3414 7.966C21.9394 7.45467 22.7368 7.199 23.7334 7.199C25.1114 7.199 26.2381 7.602 27.1134 8.408L26.0864 9.76C25.4018 9.12733 24.5611 8.811 23.5644 8.811C23.1744 8.811 22.8711 8.889 22.6544 9.045C22.4378 9.201 22.3294 9.41333 22.3294 9.682C22.3294 9.89 22.4508 10.0677 22.6934 10.215C22.9448 10.3537 23.2524 10.4577 23.6164 10.527C23.9891 10.5963 24.3878 10.7003 24.8124 10.839C25.2458 10.969 25.6444 11.1207 26.0084 11.294C26.3811 11.4587 26.6888 11.723 26.9314 12.087C27.1828 12.4423 27.3084 12.8713 27.3084 13.374C27.3084 14.206 27.0094 14.8777 26.4114 15.389C25.8221 15.9003 24.9641 16.156 23.8374 16.156ZM36.5104 16H34.4044L33.8714 14.531H30.1534L29.6074 16H27.5014L30.8554 7.329H33.1694L36.5104 16ZM33.3644 12.906L32.0124 9.175L30.6604 12.906H33.3644ZM42.0171 16H37.3111V7.329H41.8741C42.6628 7.329 43.2738 7.54567 43.7071 7.979C44.1491 8.40367 44.3701 8.92367 44.3701 9.539C44.3701 10.0677 44.2271 10.5097 43.9411 10.865C43.6551 11.2203 43.2998 11.4413 42.8751 11.528C43.3431 11.5973 43.7375 11.8357 44.0581 12.243C44.3788 12.6503 44.5391 13.1227 44.5391 13.66C44.5391 14.336 44.3181 14.895 43.8761 15.337C43.4341 15.779 42.8145 16 42.0171 16ZM41.4711 10.8C41.7831 10.8 42.0301 10.7133 42.2121 10.54C42.3941 10.3667 42.4851 10.1413 42.4851 9.864C42.4851 9.58667 42.3898 9.36133 42.1991 9.188C42.0171 9.006 41.7745 8.915 41.4711 8.915H39.1571V10.8H41.4711ZM41.5361 14.401C41.8828 14.401 42.1558 14.3143 42.3551 14.141C42.5545 13.959 42.6541 13.712 42.6541 13.4C42.6541 13.114 42.5545 12.8757 42.3551 12.685C42.1558 12.4857 41.8828 12.386 41.5361 12.386H39.1571V14.401H41.5361ZM51.4432 16H45.9312V7.329H47.7772V14.375H51.4432V16ZM58.8719 16H52.7359V7.329H58.8719V8.954H54.5819V10.787H58.7809V12.412H54.5819V14.375H58.8719V16ZM63.734 16H60.315V7.329H63.734C65.0947 7.329 66.1997 7.72767 67.049 8.525C67.907 9.32233 68.336 10.371 68.336 11.671C68.336 12.971 67.9114 14.0197 67.062 14.817C66.2127 15.6057 65.1034 16 63.734 16ZM63.734 14.375C64.566 14.375 65.2247 14.115 65.71 13.595C66.204 13.075 66.451 12.4337 66.451 11.671C66.451 10.8737 66.2127 10.2237 65.736 9.721C65.2594 9.20967 64.592 8.954 63.734 8.954H62.161V14.375H63.734Z"
        fill="#270052"
      />
    </Svg>
  );
};

const IMGS = {
  LIVE_LABEL: NoArLabel,
  LOGO: logo,
  LAST_REQUEST: ultimas_pedidas,
  LAST_PLAYED: ultimas_tocadas,
  MAKE_REQUEST: fazer_pedido,
  LIVE_REQUEST_ENABLED: PedidosAoVivoAtivados,
  LIVE_REQUEST_DISABLED: PedidosAoVivoDesativados,
};

export { DICT, IMGS, LANG };
