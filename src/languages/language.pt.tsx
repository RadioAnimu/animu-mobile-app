import { Path, Svg, SvgProps } from "react-native-svg";
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

const IMGS = {
  LIVE_LABEL: NoArLabel,
  LOGO: logo,
  LAST_REQUEST: ultimas_pedidas,
  LAST_PLAYED: ultimas_tocadas,
  MAKE_REQUEST: fazer_pedido,
};

export { DICT, IMGS, LANG };
