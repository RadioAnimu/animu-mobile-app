import { Path, Rect, Svg, SvgProps } from "react-native-svg";
import { version } from "../../package.json";
import { Program } from "../api";
import logo from "../assets/logo_PT.png";
import fazer_pedido from "../assets/pedidos_harukinha_pt.png";
import ultimas_tocadas from "../assets/ultimas_tocadas-haru_pt.png";
import ultimas_pedidas from "../assets/ultimos_pedidas-haru_pt.png";

const PROGRAMS: Program[] = [
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Jiyuu-Jikan-Logo.webp",
    name: "Jiyuu Jikan",
    dj: "Qualquer pessoa que faz parte da equipe de locução",
    theme: "Qualquer um (sendo otakice é o que vale!)",
    dayAndTime: "A qualquer momento",
    information:
      "O programa onde invadimos a programação da DJ Haruka e mandamos ela tomar aquele cafezinho. E pode ser a qualquer momento e a qualquer hora, na rádio mais moe do Brasil!",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/AnimuSong-Logo.webp",
    name: "AnimuSong",
    dj: "LL!",
    theme: "TOP 10 mais pedidas",
    dayAndTime: "Toda Terça das 20:00 às 21:20 horas",
    information:
      "O TOP 10 da mais moe do Brasil! Baseado nas mais pedidas pelos ouvintes na última semana",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/08/Logo-Natsukashii.webp",
    name: "Natsukashii",
    dj: "Dolode",
    theme: "Nostalgia",
    dayAndTime: "Quinta das 20:00 às 21:00 horas",
    information:
      "O programa que vai levar você de volta ao passado, trazendo o melhor das animusongs que marcaram gerações, incluindo o ritmo envolvente e contagiante do City Pop!",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Expresso-Otaku-Logo.webp",
    name: "Expresso Otaku",
    dj: "LL!",
    theme: "Quiz",
    dayAndTime: "Sábado das 20:00 às 23:00 horas",
    information:
      "Embarque comigo nesse expresso cheio de otakice! O Expresso Otaku é um programa onde você ouvinte testa seu nível otaku ao vivo comigo DJ LL! E se vencer se torna o otaku da semana no nosso Discord 🏆",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Animu-Plus-logo-final.webp",
    name: "Animu+",
    dj: "Qualquer pessoa que faz parte da equipe de Locução junto com ouvintes",
    theme: "Qualquer um (Sendo otakice é o que vale²)",
    dayAndTime: "Domingo das 18:00 às 21:00 horas",
    information:
      "O Animu Plus é um programa onde ouvintes participam ao vivo, fazendo parte e interagindo junto com os locutores. Gostamos muito de estar perto dos nossos ouvintes e esse programa foi criado especialmente para isso!",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Logo-DollarRocks-1.webp",
    name: "DollarRocks!",
    dj: "Dollar$",
    theme: "J-rock",
    dayAndTime: "Domingo das 21:00 às 00:00 horas",
    information:
      "O Deus japonês do rock desceu para a terra e me incumbiu de passar a palavra a todos seus seguidores. As 3 regras mais importantes são Rock hoje, Rock amanhã e Rock sempre. 🤘😝",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Yoake-Logo.webp",
    name: "Yoake",
    dj: "Haruka Yuki",
    theme: "Bloco Musical ",
    dayAndTime: "Todos os dias das 05:00 às 07:00 horas",
    information:
      "O nosso amanhecer! O Yoake foi feito para animar o início do seu dia com muita música boa e onde você também comanda a sequência ao vivo! 🌄",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/04/Kohi-Logo.webp",
    name: "Kohi",
    dj: "Haruka Yuki",
    theme: "Bloco Musical ",
    dayAndTime: "Todos os dias das 07:00 às 09:00 horas",
    information:
      "O bloco que te acorda nas suas manhãs otaku! Prepare seu cafezinho e faça a sequência junto com nossa Haru-chan ☕",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Animu-Ohayou-Logo-maior.webp",
    name: "Animu Ohayou",
    dj: "Haruka Yuki",
    theme: "Bloco Musical ",
    dayAndTime: "Todos os dias das 09:00 às 12:00 horas",
    information:
      "A nossa manhã comandada por você! A melhor forma de aproveitar a melhor parte do dia aqui na mais moe do Brasil! ☀️",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Gohan-Desu-Logo.webp",
    name: "Gohan desu!",
    dj: "Haruka Yuki",
    theme: "Bloco Musical ",
    dayAndTime: "Todos os dias das 12:00 às 14:00 horas",
    information:
      "A sua hora do almoço mais animada aqui na sua Animu 😋🍴 Almoço é muito sagrado para nós e por isso neste horário ele é dono do seu próprio bloco musical!",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Oyatsu-Logo.webp",
    name: "Oyatsu",
    dj: "Haruka Yuki",
    theme: "Bloco Musical ",
    dayAndTime: "Todos os dias das 16:00 às 18:00 horas",
    information:
      "Sua tarde mais doce e divertida na mais moe do Brasil! 🍰 A hora do seu lanchinho onde você faz a sequência nas tardes com a nossa Haru-chan",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Nemukunai-logo.webp",
    name: "Nemukunai",
    dj: "Haruka Yuki",
    theme: "Bloco Musical ",
    dayAndTime: "Todos os dias das 00:00 às 05:00 horas",
    information:
      "Nossa madrugada que não dorme! 🌙 O Nemukunai é o bloco da Animu perfeito para ouvintes que estão sem sono e querem ouvir suas músicas favoritas junto com a Haru-chan ao vivo na mais moe do Brasil 💜",
  },
];

const LANG = {
  key: "PT",
  value: "Português",
};

const DICT = {
  PROGRAMS,
  TIME_REMAINING: "Tempo restante",
  WITH_DJ: "COM",
  MENU: "Menu",
  MENU_LAST_REQUESTED: "Últimas Pedidas",
  MENU_LAST_PLAYED: "Últimas Tocadas",
  LINKS: "Links",
  LINKS_DISCORD: "Discord",
  LINKS_WEBSITE: "Página Web",
  VERSION_TEXT: `Versão v${version} - Desenvolvido com muito ❤️ por`,
  SETTINGS_TITLE: "Configurações",
  SETTINGS_ACCOUNT_TITLE: "Conta",
  SETTINGS_SAVE_DATA_TITLE: "Poupança de dados",
  SETTINGS_QUALITY_LIVE_LABEL: "Qualidade da capa carregada ao vivo:",
  SETTINGS_QUALITY_LIVE_LABEL_LOW: "Baixa",
  SETTINGS_QUALITY_LIVE_LABEL_MEDIUM: "Média",
  SETTINGS_QUALITY_LIVE_LABEL_HIGH: "Alta",
  SETTINGS_COVER_LIVE_LABEL_SWITCH: "Capas ao vivo:",
  SETTINGS_COVER_LAST_REQUESTED_SWITCH: "Últimas pedidas capas:",
  SETTINGS_COVER_LAST_PLAYED_SWITCH: "Últimas tocadas capas:",
  SETTINGS_COVER_REQUESTED_SWITCH: "Fazer pedidos com capas:",
  SETTINGS_LANGUAGE_SELECT_TITLE: "Seleção de idioma",
  SETTINGS_LANGUAGE_SELECT_PLACEHOLDER: "Selecione um idioma",
  SETTINGS_MEMORY_TITLE: "Mémoria",
  SETTINGS_MEMORY_CLEAR_CACHE_SWITCH: "Guardar capas em cache:",
  TRACK_REQUEST: "MÚSICA PEDIDA",
  INFO_REQUEST: `Oii! Sou a Haruka, a DJ da mais moe do Brasil!${"\n"}Vi que já fez a sua escolha!${"\n"}Mas antes não quer deixar um recadinho para mim ou para nossa equipe? Este recado será entregue no chat principal do nosso servidor discord para todo mundo ver${"\n"}💜 Você não precisa deixar recado se não quiser.`,
  SEND_REQUEST_BUTTON_TEXT: "Enviar",
  SEND_REQUEST_PLACEHOLDER: "Deixe seu recado aqui",
  LOGIN_ERROR: "Você precisa estar logado para fazer um pedido",
  SELECT_ERROR: "Erro ao selecionar a música",
  REQUEST_ERROR: "Erro ao fazer pedido: ",
  REQUEST_ERROR_ALREADY_REQUESTED: "Música já foi pedida anteriormente",
  REQUEST_SUCCESS: "Pedido feito com sucesso!",
  REQUEST_SEARCH_PLACEHOLDER: "Digite aqui para pesquisar",
  REQUEST_SEARCH_BUTTON_TEXT: "Pesquisar",
  THEME_WORD: "Tema",
  LOGIN_WORD: "Entrar com",
  HARU_CHAN_TEXT: "HARU-CHAN",
  FORM_LABEL_NICK: "Apelido",
  FORM_LABEL_CITY: "Cidade",
  FORM_LABEL_ARTIST: "Artista",
  FORM_LABEL_MUSIC: "Música",
  FORM_LABEL_ANIME: "Anime/VN/Jogo",
  FORM_LABEL_REQUEST: "Recado",
  ERROR_STRIKE_AND_OUT: "Erro! Você atingiu o limite de pedidos por 90 minutos",
};

const NoArLabel = (props: SvgProps) => (
  <Svg width={41} height={92} fill="none" {...props}>
    <Path fill="red" d="M0 0h41v92H0z" />
    <Path
      fill="#fff"
      d="M30 68.425v3.425L19.125 79.8H30v3.55H13.325V79.7L23.8 71.975H13.325v-3.55H30Zm.3-11.188c0 2.517-.808 4.6-2.425 6.25-1.633 1.633-3.7 2.45-6.2 2.45s-4.558-.817-6.175-2.45c-1.633-1.65-2.45-3.733-2.45-6.25 0-2.533.808-4.617 2.425-6.25 1.617-1.65 3.683-2.475 6.2-2.475 2.517 0 4.583.825 6.2 2.475 1.617 1.633 2.425 3.717 2.425 6.25Zm-4.7 3.675c1.033-.933 1.55-2.158 1.55-3.675s-.517-2.742-1.55-3.675c-1.033-.933-2.342-1.4-3.925-1.4-1.583 0-2.892.467-3.925 1.4-1.033.933-1.55 2.158-1.55 3.675s.517 2.742 1.55 3.675c1.033.917 2.342 1.375 3.925 1.375 1.583 0 2.892-.458 3.925-1.375ZM30 24.074v4.05l-2.825 1.025v7.15L30 37.35v4.05l-16.675-6.45V30.5L30 24.074Zm-5.95 6.05-7.175 2.6 7.175 2.6v-5.2ZM30 9.034v4.076l-5.925 3.275v2.6H30v3.55H13.325v-7.8c0-1.717.5-3.075 1.5-4.075 1-1.017 2.292-1.525 3.875-1.525 1.367 0 2.475.358 3.325 1.075.85.7 1.392 1.558 1.625 2.575L30 9.035Zm-9.05 6.226c0-.734-.2-1.334-.6-1.8-.417-.467-.967-.7-1.65-.7-.683 0-1.225.233-1.625.7-.417.466-.625 1.066-.625 1.8v3.725h4.5V15.26Z"
    />
  </Svg>
);

const PedidosAoVivoAtivados = (props: SvgProps) => {
  return (
    <Svg width="79" height="23" viewBox="0 0 79 23" fill="none">
      <Rect width="73" height="23" rx="4" fill="#6BDB00" />
      <Path d="M79 11.5L73 16L73 7L79 11.5Z" fill="#6BDB00" />
      <Path
        d="M13.944 16H11.838L11.305 14.531H7.587L7.041 16H4.935L8.289 7.329H10.603L13.944 16ZM10.798 12.906L9.446 9.175L8.094 12.906H10.798ZM17.7678 16H15.9088V8.954H13.3738V7.329H20.2898V8.954H17.7678V16ZM23.3192 16H21.4732V7.329H23.3192V16ZM29.7856 16H27.4716L24.1176 7.329H26.2236L28.6286 13.998L31.0206 7.329H33.1266L29.7856 16ZM41.404 16H39.298L38.765 14.531H35.047L34.501 16H32.395L35.749 7.329H38.063L41.404 16ZM38.258 12.906L36.906 9.175L35.554 12.906H38.258ZM45.6237 16H42.2047V7.329H45.6237C46.9843 7.329 48.0893 7.72767 48.9387 8.525C49.7967 9.32233 50.2257 10.371 50.2257 11.671C50.2257 12.971 49.801 14.0197 48.9517 14.817C48.1023 15.6057 46.993 16 45.6237 16ZM45.6237 14.375C46.4557 14.375 47.1143 14.115 47.5997 13.595C48.0937 13.075 48.3407 12.4337 48.3407 11.671C48.3407 10.8737 48.1023 10.2237 47.6257 9.721C47.149 9.20967 46.4817 8.954 45.6237 8.954H44.0507V14.375H45.6237ZM55.6437 16.156C54.3351 16.156 53.2517 15.7357 52.3937 14.895C51.5444 14.0457 51.1197 12.971 51.1197 11.671C51.1197 10.371 51.5444 9.30067 52.3937 8.46C53.2517 7.61067 54.3351 7.186 55.6437 7.186C56.9611 7.186 58.0444 7.60633 58.8937 8.447C59.7517 9.28767 60.1807 10.3623 60.1807 11.671C60.1807 12.9797 59.7517 14.0543 58.8937 14.895C58.0444 15.7357 56.9611 16.156 55.6437 16.156ZM53.7327 13.712C54.2181 14.2493 54.8551 14.518 55.6437 14.518C56.4324 14.518 57.0694 14.2493 57.5547 13.712C58.0401 13.1747 58.2827 12.4943 58.2827 11.671C58.2827 10.8477 58.0401 10.1673 57.5547 9.63C57.0694 9.09267 56.4324 8.824 55.6437 8.824C54.8551 8.824 54.2181 9.09267 53.7327 9.63C53.2561 10.1673 53.0177 10.8477 53.0177 11.671C53.0177 12.4943 53.2561 13.1747 53.7327 13.712ZM64.5572 16.156C63.0145 16.156 61.7925 15.6967 60.8912 14.778L61.8922 13.374C62.6375 14.154 63.5562 14.544 64.6482 14.544C65.1248 14.544 65.4932 14.453 65.7532 14.271C66.0218 14.0803 66.1562 13.8507 66.1562 13.582C66.1562 13.348 66.0305 13.153 65.7792 12.997C65.5365 12.841 65.2288 12.7283 64.8562 12.659C64.4922 12.5897 64.0935 12.49 63.6602 12.36C63.2268 12.23 62.8238 12.0827 62.4512 11.918C62.0872 11.7533 61.7795 11.4933 61.5282 11.138C61.2855 10.7827 61.1642 10.3493 61.1642 9.838C61.1642 9.09267 61.4632 8.46867 62.0612 7.966C62.6592 7.45467 63.4565 7.199 64.4532 7.199C65.8312 7.199 66.9578 7.602 67.8332 8.408L66.8062 9.76C66.1215 9.12733 65.2808 8.811 64.2842 8.811C63.8942 8.811 63.5908 8.889 63.3742 9.045C63.1575 9.201 63.0492 9.41333 63.0492 9.682C63.0492 9.89 63.1705 10.0677 63.4132 10.215C63.6645 10.3537 63.9722 10.4577 64.3362 10.527C64.7088 10.5963 65.1075 10.7003 65.5322 10.839C65.9655 10.969 66.3642 11.1207 66.7282 11.294C67.1008 11.4587 67.4085 11.723 67.6512 12.087C67.9025 12.4423 68.0282 12.8713 68.0282 13.374C68.0282 14.206 67.7292 14.8777 67.1312 15.389C66.5418 15.9003 65.6838 16.156 64.5572 16.156Z"
        fill="#270052"
      />
    </Svg>
  );
};

const PedidosAoVivoDesativados = (props: SvgProps) => {
  return (
    <Svg width="86" height="19" viewBox="0 0 86 19" fill="none">
      <Rect width="81" height="19" rx="4" fill="#6BDB00" />
      <Path
        d="M86 9.49999L80.8317 13.2644L80.8317 5.73557L86 9.49999Z"
        fill="#6BDB00"
      />
      <Path
        d="M9.29 13H6.66V6.33H9.29C10.3367 6.33 11.1867 6.63667 11.84 7.25C12.5 7.86333 12.83 8.67 12.83 9.67C12.83 10.67 12.5033 11.4767 11.85 12.09C11.1967 12.6967 10.3433 13 9.29 13ZM9.29 11.75C9.93 11.75 10.4367 11.55 10.81 11.15C11.19 10.75 11.38 10.2567 11.38 9.67C11.38 9.05667 11.1967 8.55667 10.83 8.17C10.4633 7.77667 9.95 7.58 9.29 7.58H8.08V11.75H9.29ZM18.5577 13H13.8377V6.33H18.5577V7.58H15.2577V8.99H18.4877V10.24H15.2577V11.75H18.5577V13ZM22.0378 13.12C20.8511 13.12 19.9111 12.7667 19.2178 12.06L19.9878 10.98C20.5611 11.58 21.2678 11.88 22.1078 11.88C22.4745 11.88 22.7578 11.81 22.9578 11.67C23.1645 11.5233 23.2678 11.3467 23.2678 11.14C23.2678 10.96 23.1711 10.81 22.9778 10.69C22.7911 10.57 22.5545 10.4833 22.2678 10.43C21.9878 10.3767 21.6811 10.3 21.3478 10.2C21.0145 10.1 20.7045 9.98667 20.4178 9.86C20.1378 9.73333 19.9011 9.53333 19.7078 9.26C19.5211 8.98667 19.4278 8.65333 19.4278 8.26C19.4278 7.68667 19.6578 7.20667 20.1178 6.82C20.5778 6.42667 21.1911 6.23 21.9578 6.23C23.0178 6.23 23.8845 6.54 24.5578 7.16L23.7678 8.2C23.2411 7.71333 22.5945 7.47 21.8278 7.47C21.5278 7.47 21.2945 7.53 21.1278 7.65C20.9611 7.77 20.8778 7.93333 20.8778 8.14C20.8778 8.3 20.9711 8.43667 21.1578 8.55C21.3511 8.65667 21.5878 8.73667 21.8678 8.79C22.1545 8.84333 22.4611 8.92333 22.7878 9.03C23.1211 9.13 23.4278 9.24667 23.7078 9.38C23.9945 9.50667 24.2311 9.71 24.4178 9.99C24.6111 10.2633 24.7078 10.5933 24.7078 10.98C24.7078 11.62 24.4778 12.1367 24.0178 12.53C23.5645 12.9233 22.9045 13.12 22.0378 13.12ZM31.7863 13H30.1663L29.7563 11.87H26.8963L26.4763 13H24.8562L27.4363 6.33H29.2163L31.7863 13ZM29.3663 10.62L28.3263 7.75L27.2863 10.62H29.3663ZM34.7277 13H33.2977V7.58H31.3477V6.33H36.6677V7.58H34.7277V13ZM38.998 13H37.578V6.33H38.998V13ZM43.9721 13H42.1921L39.6121 6.33H41.2321L43.0821 11.46L44.9221 6.33H46.5421L43.9721 13ZM52.9093 13H51.2893L50.8793 11.87H48.0193L47.5993 13H45.9793L48.5593 6.33H50.3393L52.9093 13ZM50.4893 10.62L49.4493 7.75L48.4093 10.62H50.4893ZM56.1552 13H53.5252V6.33H56.1552C57.2019 6.33 58.0519 6.63667 58.7052 7.25C59.3652 7.86333 59.6952 8.67 59.6952 9.67C59.6952 10.67 59.3686 11.4767 58.7152 12.09C58.0619 12.6967 57.2086 13 56.1552 13ZM56.1552 11.75C56.7952 11.75 57.3019 11.55 57.6752 11.15C58.0552 10.75 58.2452 10.2567 58.2452 9.67C58.2452 9.05667 58.0619 8.55667 57.6952 8.17C57.3286 7.77667 56.8152 7.58 56.1552 7.58H54.9452V11.75H56.1552ZM63.863 13.12C62.8563 13.12 62.023 12.7967 61.363 12.15C60.7096 11.4967 60.383 10.67 60.383 9.67C60.383 8.67 60.7096 7.84667 61.363 7.2C62.023 6.54667 62.8563 6.22 63.863 6.22C64.8763 6.22 65.7096 6.54333 66.363 7.19C67.023 7.83667 67.353 8.66333 67.353 9.67C67.353 10.6767 67.023 11.5033 66.363 12.15C65.7096 12.7967 64.8763 13.12 63.863 13.12ZM62.393 11.24C62.7663 11.6533 63.2563 11.86 63.863 11.86C64.4696 11.86 64.9596 11.6533 65.333 11.24C65.7063 10.8267 65.893 10.3033 65.893 9.67C65.893 9.03667 65.7063 8.51333 65.333 8.1C64.9596 7.68667 64.4696 7.48 63.863 7.48C63.2563 7.48 62.7663 7.68667 62.393 8.1C62.0263 8.51333 61.843 9.03667 61.843 9.67C61.843 10.3033 62.0263 10.8267 62.393 11.24ZM70.7195 13.12C69.5328 13.12 68.5928 12.7667 67.8995 12.06L68.6695 10.98C69.2428 11.58 69.9495 11.88 70.7895 11.88C71.1561 11.88 71.4395 11.81 71.6395 11.67C71.8461 11.5233 71.9495 11.3467 71.9495 11.14C71.9495 10.96 71.8528 10.81 71.6595 10.69C71.4728 10.57 71.2361 10.4833 70.9495 10.43C70.6695 10.3767 70.3628 10.3 70.0295 10.2C69.6961 10.1 69.3861 9.98667 69.0995 9.86C68.8195 9.73333 68.5828 9.53333 68.3895 9.26C68.2028 8.98667 68.1095 8.65333 68.1095 8.26C68.1095 7.68667 68.3395 7.20667 68.7995 6.82C69.2595 6.42667 69.8728 6.23 70.6395 6.23C71.6995 6.23 72.5661 6.54 73.2395 7.16L72.4495 8.2C71.9228 7.71333 71.2761 7.47 70.5095 7.47C70.2095 7.47 69.9761 7.53 69.8095 7.65C69.6428 7.77 69.5595 7.93333 69.5595 8.14C69.5595 8.3 69.6528 8.43667 69.8395 8.55C70.0328 8.65667 70.2695 8.73667 70.5495 8.79C70.8361 8.84333 71.1428 8.92333 71.4695 9.03C71.8028 9.13 72.1095 9.24667 72.3895 9.38C72.6761 9.50667 72.9128 9.71 73.0995 9.99C73.2928 10.2633 73.3895 10.5933 73.3895 10.98C73.3895 11.62 73.1595 12.1367 72.6995 12.53C72.2461 12.9233 71.5861 13.12 70.7195 13.12Z"
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
