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
};

const NoArLabel = (props: SvgProps) => (
  <Svg width="41" height="92" viewBox="0 0 41 92" fill="none">
    <Rect width="41" height="92" fill="#FF0000" />
    <Path
      d="M27 75.24L27 84.68L13.66 84.68L13.66 75.24L16.16 75.24L16.16 81.84L18.98 81.84L18.98 75.38L21.48 75.38L21.48 81.84L24.5 81.84L24.5 75.24L27 75.24ZM27 61.0798L27 63.8198L18.3 70.1798L27 70.1798L27 73.0198L13.66 73.0198L13.66 70.0998L22.04 63.9198L13.66 63.9198L13.66 61.0798L27 61.0798ZM27 46.0323L27 49.5923L13.66 54.7523L13.66 51.5123L23.92 47.8123L13.66 44.1323L13.66 40.8923L27 46.0323ZM27 36.8205L27 39.6605L13.66 39.6605L13.66 36.8205L27 36.8205ZM27 26.8722L27 30.4322L13.66 35.5922L13.66 32.3522L23.92 28.6522L13.66 24.9722L13.66 21.7322L27 26.8722ZM27.24 14.5709C27.24 16.5843 26.5933 18.2509 25.3 19.5709C23.9933 20.8776 22.34 21.5309 20.34 21.5309C18.34 21.5309 16.6933 20.8776 15.4 19.5709C14.0933 18.2509 13.44 16.5843 13.44 14.5709C13.44 12.5443 14.0867 10.8776 15.38 9.57094C16.6733 8.25094 18.3267 7.59094 20.34 7.59094C22.3533 7.59094 24.0067 8.25094 25.3 9.57094C26.5933 10.8776 27.24 12.5443 27.24 14.5709ZM23.48 17.5109C24.3067 16.7643 24.72 15.7843 24.72 14.5709C24.72 13.3576 24.3067 12.3776 23.48 11.6309C22.6533 10.8843 21.6067 10.5109 20.34 10.5109C19.0733 10.5109 18.0267 10.8843 17.2 11.6309C16.3733 12.3776 15.96 13.3576 15.96 14.5709C15.96 15.7843 16.3733 16.7643 17.2 17.5109C18.0267 18.2443 19.0733 18.6109 20.34 18.6109C21.6067 18.6109 22.6533 18.2443 23.48 17.5109Z"
      fill="white"
    />
  </Svg>
);

const IMGS = {
  LOGO: logo,
  LAST_REQUEST: ultimas_pedidas,
  LAST_PLAYED: ultimas_tocadas,
  LIVE_LABEL: NoArLabel,
  MAKE_REQUEST: fazer_pedido,
};

export { DICT, IMGS, LANG };
