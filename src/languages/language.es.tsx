import logo from "../assets/logo_ES.png";
import { Program } from "../utils/player.config";
import { version } from "../../package.json";
import ultimas_pedidas from "../assets/ultimos_pedidas-haru_es.png";
import ultimas_tocadas from "../assets/ultimas_tocadas-haru_es.png";
import fazer_pedido from "../assets/pedidos_harukinha_es.png";
import Svg, { SvgProps, Rect, Path } from "react-native-svg";

const LANG = {
  key: "ES",
  value: "Español",
};

const PROGRAMS: Program[] = [
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Jiyuu-Jikan-Logo.webp",
    name: "Jiyuu Jikan",
    dj: "Cualquier miembro del equipo de locución",
    theme: "¡Cualquiera (¡siendo otaku es lo que cuenta!) (BRT)",
    dayAndTime: "En cualquier momento",
    information:
      "¡El programa donde invadimos la programación del DJ Haruka y le decimos que tome ese cafecito! Y puede ser en cualquier momento y a cualquier hora, en la radio más moe de Brasil!",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/AnimuSong-Logo.webp",
    name: "AnimuSong",
    dj: "LL!",
    theme: "TOP 10 más solicitadas",
    dayAndTime: "Todos los martes de 20:00 a 21:20 horas (BRT)",
    information:
      "¡El TOP 10 de la más moe de Brasil! Basado en las más solicitadas por los oyentes en la última semana",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/08/Logo-Natsukashii.webp",
    name: "Natsukashii",
    dj: "Dolode",
    theme: "Nostalgia",
    dayAndTime: "Jueves de 20:00 a 21:00 horas (BRT)",
    information:
      "¡El programa que te llevará de vuelta al pasado, trayendo lo mejor de las animusongs que marcaron generaciones, incluido el ritmo envolvente y contagioso del City Pop!",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Expresso-Otaku-Logo.webp",
    name: "Expresso Otaku",
    dj: "LL!",
    theme: "Quiz",
    dayAndTime: "Sábado de 20:00 a 23:00 horas (BRT)",
    information:
      "¡Únete a mí en este expreso lleno de otakus! ¡El Expresso Otaku es un programa donde tú, oyente, pones a prueba tu nivel otaku en vivo conmigo, DJ LL! Y si ganas, te conviertes en el otaku de la semana en nuestro Discord 🏆",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Animu-Plus-logo-final.webp",
    name: "Animu+",
    dj: "Cualquier miembro del equipo de locución junto con los oyentes",
    theme: "¡Cualquiera (siendo otaku es lo que cuenta²)",
    dayAndTime: "Domingo de 18:00 a 21:00 horas (BRT)",
    information:
      "¡Animu Plus es un programa donde los oyentes participan en vivo, formando parte e interactuando junto con los locutores. Nos encanta estar cerca de nuestros oyentes y este programa fue creado especialmente para eso!",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Logo-DollarRocks-1.webp",
    name: "DollarRocks!",
    dj: "Dollar$",
    theme: "J-rock",
    dayAndTime: "Domingo de 21:00 a 00:00 horas (BRT)",
    information:
      "El Dios japonés del rock descendió a la tierra y me encomendó pasar la palabra a todos sus seguidores. Las 3 reglas más importantes son Rock hoy, Rock mañana y Rock siempre. 🤘😝",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Yoake-Logo.webp",
    name: "Yoake",
    dj: "Haruka Yuki",
    theme: "Bloque Musical ",
    dayAndTime: "Todos los días de 05:00 a 07:00 horas (BRT)",
    information:
      "¡Nuestro amanecer! ¡Yoake está hecho para animar el comienzo de tu día con mucha buena música y donde tú también comandas la secuencia en vivo! 🌄",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/04/Kohi-Logo.webp",
    name: "Kohi",
    dj: "Haruka Yuki",
    theme: "Bloque Musical ",
    dayAndTime: "Todos los días de 07:00 a 09:00 horas (BRT)",
    information:
      "¡El bloque que te despierta en tus mañanas otaku! ¡Prepara tu cafecito y haz la secuencia junto con nuestra Haru-chan ☕",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Animu-Ohayou-Logo-maior.webp",
    name: "Animu Ohayou",
    dj: "Haruka Yuki",
    theme: "Bloque Musical ",
    dayAndTime: "Todos los días de 09:00 a 12:00 horas (BRT)",
    information:
      "¡Nuestra mañana dirigida por ti! ¡La mejor manera de disfrutar la mejor parte del día aquí en la más moe de Brasil! ☀️",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Gohan-Desu-Logo.webp",
    name: "Gohan desu!",
    dj: "Haruka Yuki",
    theme: "Bloque Musical ",
    dayAndTime: "Todos los días de 12:00 a 14:00 horas (BRT)",
    information:
      "¡Tu hora del almuerzo más animada aquí en tu Animu 😋🍴 ¡El almuerzo es muy sagrado para nosotros y por eso en este horario es dueño de su propio bloque musical!",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Oyatsu-Logo.webp",
    name: "Oyatsu",
    dj: "Haruka Yuki",
    theme: "Bloque Musical ",
    dayAndTime: "Todos los días de 16:00 a 18:00 horas (BRT)",
    information:
      "¡Tu tarde más dulce y divertida en la más moe de Brasil! 🍰 La hora de tu merienda donde haces la secuencia en las tardes con nuestra Haru-chan",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Nemukunai-logo.webp",
    name: "Nemukunai",
    dj: "Haruka Yuki",
    theme: "Bloque Musical ",
    dayAndTime: "Todos los días de 00:00 a 05:00 horas (BRT)",
    information:
      "¡Nuestra madrugada que no duerme! 🌙 Nemukunai es el bloque de Animu perfecto para oyentes que están despiertos y quieren escuchar sus canciones favoritas junto con Haru-chan en vivo en la más moe de Brasil 💜",
  },
];

const DICT = {
  PROGRAMS,
  TIME_REMAINING: "Tiempo restante",
  WITH_DJ: "CON",
  MENU: "Menú",
  MENU_LAST_REQUESTED: "Últimas Solicitudes",
  MENU_LAST_PLAYED: "Últimas Reproducciones",
  LINKS: "Enlaces",
  LINKS_DISCORD: "Discord",
  LINKS_WEBSITE: "Sitio Web",
  VERSION_TEXT: `Versión v${version} - Desarrollado con mucho ❤️ por`,
  SETTINGS_TITLE: "Ajustes",
  SETTINGS_ACCOUNT_TITLE: "Cuenta",
  SETTINGS_SAVE_DATA_TITLE: "Guardar Datos",
  SETTINGS_QUALITY_LIVE_LABEL: "Calidad de las portadas en vivo:",
  SETTINGS_QUALITY_LIVE_LABEL_LOW: "Baja",
  SETTINGS_QUALITY_LIVE_LABEL_MEDIUM: "Media",
  SETTINGS_QUALITY_LIVE_LABEL_HIGH: "Alta",
  SETTINGS_COVER_LIVE_LABEL_SWITCH: "Portadas en vivo:",
  SETTINGS_COVER_LAST_REQUESTED_SWITCH: "Últimas solicitudes de portadas:",
  SETTINGS_COVER_LAST_PLAYED_SWITCH: "Últimas reproducciones de portadas:",
  SETTINGS_COVER_REQUESTED_SWITCH: "Hacer solicitudes con portadas:",
  SETTINGS_LANGUAGE_SELECT_TITLE: "Selección de Idioma",
  SETTINGS_LANGUAGE_SELECT_PLACEHOLDER: "Selecciona un idioma",
  SETTINGS_MEMORY_TITLE: "Memoria",
  SETTINGS_MEMORY_CLEAR_CACHE_SWITCH: "Limpiar caché de portadas:",
  TRACK_REQUEST: "MÚSICA SOLICITADA",
  INFO_REQUEST: `¡Hola! ¡Soy Haruka, la DJ de la radio más moe de Brasil!${"\n"}¡Veamos que ya has hecho tu elección!${"\n"}Pero antes, ¿te gustaría dejar un mensaje para mí o para nuestro equipo? Este mensaje se entregará en el chat principal de nuestro servidor de Discord para que todos lo vean${"\n"}💜 No es necesario que dejes un mensaje si no quieres.`,
  SEND_REQUEST_BUTTON_TEXT: "Enviar",
  SEND_REQUEST_PLACEHOLDER: "Deja tu mensaje aquí",
  LOGIN_ERROR: "Necesitas iniciar sesión para hacer una solicitud",
  SELECT_ERROR: "Error al seleccionar la canción",
  REQUEST_ERROR: "Error al hacer la solicitud: ",
  REQUEST_ERROR_ALREADY_REQUESTED:
    "La canción ya ha sido solicitada anteriormente",
  REQUEST_SUCCESS: "¡Solicitud realizada con éxito!",
  REQUEST_SEARCH_PLACEHOLDER: "Escribe aquí para buscar",
  REQUEST_SEARCH_BUTTON_TEXT: "Buscar",
  HARU_CHAN_TEXT: "HARU-CHAN",
  THEME_WORD: "Tema",
  LOGIN_WORD: "Ingresar al",
};

const NoArLabel = (props: SvgProps) => (
  <Svg width="41" height="92" viewBox="0 0 41 92" fill="none">
    <Rect width="41" height="92" fill="#FF0000" />
    <Path
      d="M28 70.9753L28 74.5393L25.514 75.4413L25.514 81.7333L28 82.6573L28 86.2213L13.326 80.5453L13.326 76.6293L28 70.9753ZM22.764 76.2993L16.45 78.5873L22.764 80.8753L22.764 76.2993ZM28 60.2923L28 69.6203L13.326 69.6203L13.326 66.4963L25.25 66.4963L25.25 60.2923L28 60.2923ZM28 38.7917L28 42.3557L25.514 43.2577L25.514 49.5497L28 50.4737L28 54.0377L13.326 48.3617L13.326 44.4457L28 38.7917ZM22.764 44.1157L16.45 46.4037L22.764 48.6917L22.764 44.1157ZM28 34.3127L28 37.4367L13.326 37.4367L13.326 34.3127L28 34.3127ZM28 19.5196L28 23.1056L22.786 25.9876L22.786 28.2756L28 28.2756L28 31.3996L13.326 31.3996L13.326 24.5356C13.326 23.0249 13.766 21.8296 14.646 20.9496C15.526 20.0549 16.6627 19.6076 18.056 19.6076C19.2587 19.6076 20.234 19.9229 20.982 20.5536C21.73 21.1696 22.2067 21.9249 22.412 22.8196L28 19.5196ZM20.036 24.9976C20.036 24.3522 19.86 23.8242 19.508 23.4136C19.1413 23.0029 18.6573 22.7976 18.056 22.7976C17.4547 22.7976 16.978 23.0029 16.626 23.4136C16.2593 23.8242 16.076 24.3522 16.076 24.9976L16.076 28.2756L20.036 28.2756L20.036 24.9976ZM28 6.87884L28 17.2628L13.326 17.2628L13.326 6.87884L16.076 6.87884L16.076 14.1388L19.178 14.1388L19.178 7.03284L21.928 7.03284L21.928 14.1388L25.25 14.1388L25.25 6.87884L28 6.87884Z"
      fill="white"
    />
  </Svg>
);

const PedidosAoVivoAtivados = (props: SvgProps) => {
  return (
    <Svg width="81" height="23" viewBox="0 0 81 23" fill="none">
      <Rect width="76.1881" height="23" rx="4" fill="#6BDB00" />
      <Path d="M81 11.5L76.1881 16L76.1881 7L81 11.5Z" fill="#6BDB00" />
      <Path
        d="M13.944 16H11.838L11.305 14.531H7.587L7.041 16H4.935L8.289 7.329H10.603L13.944 16ZM10.798 12.906L9.446 9.175L8.094 12.906H10.798ZM18.4994 16.156C17.182 16.156 16.0814 15.74 15.1974 14.908C14.322 14.0673 13.8844 12.9883 13.8844 11.671C13.8844 10.3537 14.322 9.279 15.1974 8.447C16.0814 7.60633 17.182 7.186 18.4994 7.186C20.12 7.186 21.329 7.89233 22.1264 9.305L20.5404 10.085C20.3497 9.721 20.0681 9.422 19.6954 9.188C19.3314 8.94533 18.9327 8.824 18.4994 8.824C17.7107 8.824 17.0607 9.09267 16.5494 9.63C16.038 10.1673 15.7824 10.8477 15.7824 11.671C15.7824 12.4943 16.038 13.1747 16.5494 13.712C17.0607 14.2493 17.7107 14.518 18.4994 14.518C18.9327 14.518 19.3314 14.401 19.6954 14.167C20.0681 13.933 20.3497 13.6297 20.5404 13.257L22.1264 14.024C21.303 15.4453 20.094 16.156 18.4994 16.156ZM27.0862 16H25.2272V8.954H22.6922V7.329H29.6082V8.954H27.0862V16ZM32.6376 16H30.7916V7.329H32.6376V16ZM39.104 16H36.79L33.436 7.329H35.542L37.947 13.998L40.339 7.329H42.445L39.104 16ZM50.7223 16H48.6163L48.0833 14.531H44.3653L43.8193 16H41.7133L45.0673 7.329H47.3813L50.7223 16ZM47.5763 12.906L46.2243 9.175L44.8723 12.906H47.5763ZM54.942 16H51.523V7.329H54.942C56.3027 7.329 57.4077 7.72767 58.257 8.525C59.115 9.32233 59.544 10.371 59.544 11.671C59.544 12.971 59.1194 14.0197 58.27 14.817C57.4207 15.6057 56.3114 16 54.942 16ZM54.942 14.375C55.774 14.375 56.4327 14.115 56.918 13.595C57.412 13.075 57.659 12.4337 57.659 11.671C57.659 10.8737 57.4207 10.2237 56.944 9.721C56.4674 9.20967 55.8 8.954 54.942 8.954H53.369V14.375H54.942ZM64.9621 16.156C63.6534 16.156 62.5701 15.7357 61.7121 14.895C60.8628 14.0457 60.4381 12.971 60.4381 11.671C60.4381 10.371 60.8628 9.30067 61.7121 8.46C62.5701 7.61067 63.6534 7.186 64.9621 7.186C66.2794 7.186 67.3628 7.60633 68.2121 8.447C69.0701 9.28767 69.4991 10.3623 69.4991 11.671C69.4991 12.9797 69.0701 14.0543 68.2121 14.895C67.3628 15.7357 66.2794 16.156 64.9621 16.156ZM63.0511 13.712C63.5364 14.2493 64.1734 14.518 64.9621 14.518C65.7508 14.518 66.3878 14.2493 66.8731 13.712C67.3584 13.1747 67.6011 12.4943 67.6011 11.671C67.6011 10.8477 67.3584 10.1673 66.8731 9.63C66.3878 9.09267 65.7508 8.824 64.9621 8.824C64.1734 8.824 63.5364 9.09267 63.0511 9.63C62.5744 10.1673 62.3361 10.8477 62.3361 11.671C62.3361 12.4943 62.5744 13.1747 63.0511 13.712Z"
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
        d="M6.29 15H3.66V8.33H6.29C7.33667 8.33 8.18667 8.63667 8.84 9.25C9.5 9.86333 9.83 10.67 9.83 11.67C9.83 12.67 9.50333 13.4767 8.85 14.09C8.19667 14.6967 7.34333 15 6.29 15ZM6.29 13.75C6.93 13.75 7.43667 13.55 7.81 13.15C8.19 12.75 8.38 12.2567 8.38 11.67C8.38 11.0567 8.19667 10.5567 7.83 10.17C7.46333 9.77667 6.95 9.58 6.29 9.58H5.08V13.75H6.29ZM15.5577 15H10.8377V8.33H15.5577V9.58H12.2577V10.99H15.4877V12.24H12.2577V13.75H15.5577V15ZM19.0378 15.12C17.8511 15.12 16.9111 14.7667 16.2178 14.06L16.9878 12.98C17.5611 13.58 18.2678 13.88 19.1078 13.88C19.4745 13.88 19.7578 13.81 19.9578 13.67C20.1645 13.5233 20.2678 13.3467 20.2678 13.14C20.2678 12.96 20.1711 12.81 19.9778 12.69C19.7911 12.57 19.5545 12.4833 19.2678 12.43C18.9878 12.3767 18.6811 12.3 18.3478 12.2C18.0145 12.1 17.7045 11.9867 17.4178 11.86C17.1378 11.7333 16.9011 11.5333 16.7078 11.26C16.5211 10.9867 16.4278 10.6533 16.4278 10.26C16.4278 9.68667 16.6578 9.20667 17.1178 8.82C17.5778 8.42667 18.1911 8.23 18.9578 8.23C20.0178 8.23 20.8845 8.54 21.5578 9.16L20.7678 10.2C20.2411 9.71333 19.5945 9.47 18.8278 9.47C18.5278 9.47 18.2945 9.53 18.1278 9.65C17.9611 9.77 17.8778 9.93333 17.8778 10.14C17.8778 10.3 17.9711 10.4367 18.1578 10.55C18.3511 10.6567 18.5878 10.7367 18.8678 10.79C19.1545 10.8433 19.4611 10.9233 19.7878 11.03C20.1211 11.13 20.4278 11.2467 20.7078 11.38C20.9945 11.5067 21.2311 11.71 21.4178 11.99C21.6111 12.2633 21.7078 12.5933 21.7078 12.98C21.7078 13.62 21.4778 14.1367 21.0178 14.53C20.5645 14.9233 19.9045 15.12 19.0378 15.12ZM28.7863 15H27.1663L26.7563 13.87H23.8963L23.4763 15H21.8562L24.4363 8.33H26.2163L28.7863 15ZM26.3663 12.62L25.3263 9.75L24.2863 12.62H26.3663ZM32.2904 15.12C31.2771 15.12 30.4304 14.8 29.7504 14.16C29.0771 13.5133 28.7404 12.6833 28.7404 11.67C28.7404 10.6567 29.0771 9.83 29.7504 9.19C30.4304 8.54333 31.2771 8.22 32.2904 8.22C33.5371 8.22 34.4671 8.76333 35.0804 9.85L33.8604 10.45C33.7137 10.17 33.4971 9.94 33.2104 9.76C32.9304 9.57333 32.6237 9.48 32.2904 9.48C31.6837 9.48 31.1837 9.68667 30.7904 10.1C30.3971 10.5133 30.2004 11.0367 30.2004 11.67C30.2004 12.3033 30.3971 12.8267 30.7904 13.24C31.1837 13.6533 31.6837 13.86 32.2904 13.86C32.6237 13.86 32.9304 13.77 33.2104 13.59C33.4971 13.41 33.7137 13.1767 33.8604 12.89L35.0804 13.48C34.4471 14.5733 33.5171 15.12 32.2904 15.12ZM38.8956 15H37.4656V9.58H35.5156V8.33H40.8356V9.58H38.8956V15ZM43.1659 15H41.7459V8.33H43.1659V15ZM48.1401 15H46.3601L43.7801 8.33H45.4001L47.2501 13.46L49.0901 8.33H50.7101L48.1401 15ZM57.0773 15H55.4573L55.0473 13.87H52.1873L51.7673 15H50.1473L52.7273 8.33H54.5073L57.0773 15ZM54.6573 12.62L53.6173 9.75L52.5773 12.62H54.6573ZM60.3232 15H57.6932V8.33H60.3232C61.3699 8.33 62.2199 8.63667 62.8732 9.25C63.5332 9.86333 63.8632 10.67 63.8632 11.67C63.8632 12.67 63.5365 13.4767 62.8832 14.09C62.2299 14.6967 61.3765 15 60.3232 15ZM60.3232 13.75C60.9632 13.75 61.4699 13.55 61.8432 13.15C62.2232 12.75 62.4132 12.2567 62.4132 11.67C62.4132 11.0567 62.2299 10.5567 61.8632 10.17C61.4965 9.77667 60.9832 9.58 60.3232 9.58H59.1132V13.75H60.3232ZM68.0309 15.12C67.0243 15.12 66.1909 14.7967 65.5309 14.15C64.8776 13.4967 64.5509 12.67 64.5509 11.67C64.5509 10.67 64.8776 9.84667 65.5309 9.2C66.1909 8.54667 67.0243 8.22 68.0309 8.22C69.0443 8.22 69.8776 8.54333 70.5309 9.19C71.1909 9.83667 71.5209 10.6633 71.5209 11.67C71.5209 12.6767 71.1909 13.5033 70.5309 14.15C69.8776 14.7967 69.0443 15.12 68.0309 15.12ZM66.5609 13.24C66.9343 13.6533 67.4243 13.86 68.0309 13.86C68.6376 13.86 69.1276 13.6533 69.5009 13.24C69.8743 12.8267 70.0609 12.3033 70.0609 11.67C70.0609 11.0367 69.8743 10.5133 69.5009 10.1C69.1276 9.68667 68.6376 9.48 68.0309 9.48C67.4243 9.48 66.9343 9.68667 66.5609 10.1C66.1943 10.5133 66.0109 11.0367 66.0109 11.67C66.0109 12.3033 66.1943 12.8267 66.5609 13.24Z"
        fill="#270052"
      />
    </Svg>
  );
};

const IMGS = {
  LOGO: logo,
  LAST_REQUEST: ultimas_pedidas,
  LAST_PLAYED: ultimas_tocadas,
  LIVE_LABEL: NoArLabel,
  MAKE_REQUEST: fazer_pedido,
  LIVE_REQUEST_ENABLED: PedidosAoVivoAtivados,
  LIVE_REQUEST_DISABLED: PedidosAoVivoDesativados,
};

export { DICT, IMGS, LANG };
