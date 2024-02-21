import { Path, Rect, Svg, SvgProps } from "react-native-svg";
import { Program } from "../utils/player.config";
import logo from "../assets/logo_PT.png";
import ultimas_pedidas from "../assets/ultimos_pedidas-haru_pt.png";
import ultimas_tocadas from "../assets/ultimas_tocadas-haru_pt.png";
import fazer_pedido from "../assets/pedidos_harukinha_pt.png";
import { version } from "../../package.json";

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
    <Svg width="101" height="23" viewBox="0 0 101 23" fill="none">
      <Rect width="95" height="23" rx="4" fill="#6BDB00" />
      <Path d="M101 11.5L95 16L95 7L101 11.5Z" fill="#6BDB00" />
      <Path
        d="M7.277 16H3.858V7.329H7.277C8.63767 7.329 9.74267 7.72767 10.592 8.525C11.45 9.32233 11.879 10.371 11.879 11.671C11.879 12.971 11.4543 14.0197 10.605 14.817C9.75567 15.6057 8.64633 16 7.277 16ZM7.277 14.375C8.109 14.375 8.76767 14.115 9.253 13.595C9.747 13.075 9.994 12.4337 9.994 11.671C9.994 10.8737 9.75567 10.2237 9.279 9.721C8.80233 9.20967 8.135 8.954 7.277 8.954H5.704V14.375H7.277ZM19.3251 16H13.1891V7.329H19.3251V8.954H15.0351V10.787H19.2341V12.412H15.0351V14.375H19.3251V16ZM23.8492 16.156C22.3065 16.156 21.0845 15.6967 20.1832 14.778L21.1842 13.374C21.9295 14.154 22.8482 14.544 23.9402 14.544C24.4168 14.544 24.7852 14.453 25.0452 14.271C25.3138 14.0803 25.4482 13.8507 25.4482 13.582C25.4482 13.348 25.3225 13.153 25.0712 12.997C24.8285 12.841 24.5208 12.7283 24.1482 12.659C23.7842 12.5897 23.3855 12.49 22.9522 12.36C22.5188 12.23 22.1158 12.0827 21.7432 11.918C21.3792 11.7533 21.0715 11.4933 20.8202 11.138C20.5775 10.7827 20.4562 10.3493 20.4562 9.838C20.4562 9.09267 20.7552 8.46867 21.3532 7.966C21.9512 7.45467 22.7485 7.199 23.7452 7.199C25.1232 7.199 26.2498 7.602 27.1252 8.408L26.0982 9.76C25.4135 9.12733 24.5728 8.811 23.5762 8.811C23.1862 8.811 22.8828 8.889 22.6662 9.045C22.4495 9.201 22.3412 9.41333 22.3412 9.682C22.3412 9.89 22.4625 10.0677 22.7052 10.215C22.9565 10.3537 23.2642 10.4577 23.6282 10.527C24.0008 10.5963 24.3995 10.7003 24.8242 10.839C25.2575 10.969 25.6562 11.1207 26.0202 11.294C26.3928 11.4587 26.7005 11.723 26.9432 12.087C27.1945 12.4423 27.3202 12.8713 27.3202 13.374C27.3202 14.206 27.0212 14.8777 26.4232 15.389C25.8338 15.9003 24.9758 16.156 23.8492 16.156ZM36.5221 16H34.4161L33.8831 14.531H30.1651L29.6191 16H27.5131L30.8671 7.329H33.1811L36.5221 16ZM33.3761 12.906L32.0241 9.175L30.6721 12.906H33.3761ZM40.346 16H38.487V8.954H35.952V7.329H42.868V8.954H40.346V16ZM45.8974 16H44.0514V7.329H45.8974V16ZM52.3637 16H50.0497L46.6957 7.329H48.8017L51.2067 13.998L53.5987 7.329H55.7047L52.3637 16ZM63.9821 16H61.8761L61.3431 14.531H57.6251L57.0791 16H54.9731L58.3271 7.329H60.6411L63.9821 16ZM60.8361 12.906L59.4841 9.175L58.1321 12.906H60.8361ZM68.2018 16H64.7828V7.329H68.2018C69.5625 7.329 70.6675 7.72767 71.5168 8.525C72.3748 9.32233 72.8038 10.371 72.8038 11.671C72.8038 12.971 72.3791 14.0197 71.5298 14.817C70.6805 15.6057 69.5711 16 68.2018 16ZM68.2018 14.375C69.0338 14.375 69.6925 14.115 70.1778 13.595C70.6718 13.075 70.9188 12.4337 70.9188 11.671C70.9188 10.8737 70.6805 10.2237 70.2038 9.721C69.7271 9.20967 69.0598 8.954 68.2018 8.954H66.6288V14.375H68.2018ZM78.2219 16.156C76.9132 16.156 75.8299 15.7357 74.9719 14.895C74.1225 14.0457 73.6979 12.971 73.6979 11.671C73.6979 10.371 74.1225 9.30067 74.9719 8.46C75.8299 7.61067 76.9132 7.186 78.2219 7.186C79.5392 7.186 80.6225 7.60633 81.4719 8.447C82.3299 9.28767 82.7589 10.3623 82.7589 11.671C82.7589 12.9797 82.3299 14.0543 81.4719 14.895C80.6225 15.7357 79.5392 16.156 78.2219 16.156ZM76.3109 13.712C76.7962 14.2493 77.4332 14.518 78.2219 14.518C79.0105 14.518 79.6475 14.2493 80.1329 13.712C80.6182 13.1747 80.8609 12.4943 80.8609 11.671C80.8609 10.8477 80.6182 10.1673 80.1329 9.63C79.6475 9.09267 79.0105 8.824 78.2219 8.824C77.4332 8.824 76.7962 9.09267 76.3109 9.63C75.8342 10.1673 75.5959 10.8477 75.5959 11.671C75.5959 12.4943 75.8342 13.1747 76.3109 13.712ZM87.1353 16.156C85.5926 16.156 84.3706 15.6967 83.4693 14.778L84.4703 13.374C85.2156 14.154 86.1343 14.544 87.2263 14.544C87.703 14.544 88.0713 14.453 88.3313 14.271C88.6 14.0803 88.7343 13.8507 88.7343 13.582C88.7343 13.348 88.6086 13.153 88.3573 12.997C88.1146 12.841 87.807 12.7283 87.4343 12.659C87.0703 12.5897 86.6716 12.49 86.2383 12.36C85.805 12.23 85.402 12.0827 85.0293 11.918C84.6653 11.7533 84.3576 11.4933 84.1063 11.138C83.8636 10.7827 83.7423 10.3493 83.7423 9.838C83.7423 9.09267 84.0413 8.46867 84.6393 7.966C85.2373 7.45467 86.0346 7.199 87.0313 7.199C88.4093 7.199 89.536 7.602 90.4113 8.408L89.3843 9.76C88.6996 9.12733 87.859 8.811 86.8623 8.811C86.4723 8.811 86.169 8.889 85.9523 9.045C85.7356 9.201 85.6273 9.41333 85.6273 9.682C85.6273 9.89 85.7486 10.0677 85.9913 10.215C86.2426 10.3537 86.5503 10.4577 86.9143 10.527C87.287 10.5963 87.6856 10.7003 88.1103 10.839C88.5436 10.969 88.9423 11.1207 89.3063 11.294C89.679 11.4587 89.9866 11.723 90.2293 12.087C90.4806 12.4423 90.6063 12.8713 90.6063 13.374C90.6063 14.206 90.3073 14.8777 89.7093 15.389C89.12 15.9003 88.262 16.156 87.1353 16.156Z"
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
