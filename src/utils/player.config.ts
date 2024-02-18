const DEFAULT_COVER: string =
  "https://cdn.discordapp.com/attachments/634406949198364702/1208229038192066640/Animu_icon_2023.png?ex=65e285fa&is=65d010fa&hm=f1136f9df203303a7e45da10e1474aba1ce60e170e8278d9ac472ac57848dd58&";

export interface StreamOption {
  bitrate: number;
  category: string;
  url: string;
}

const STREAM_OPTIONS: StreamOption[] = [
  {
    bitrate: 320,
    category: "MP3",
    url: "https://cast.animu.com.br:9079/stream",
  },
  {
    bitrate: 192,
    category: "MP3",
    url: "https://cast.animu.com.br:9089/stream",
  },
  {
    bitrate: 64,
    category: "AAC+",
    url: "https://cast.animu.com.br:9069/stream",
  },
  {
    bitrate: 320,
    category: "REPRISES",
    url: "https://cast.animu.com.br:9019/stream",
  },
];

const DEFAULT_STREAM_OPTION: StreamOption = STREAM_OPTIONS[0]; // 320bitrate MP3

const USER_AGENT: string = "Animu Mobile App";

export interface Program {
  img: string;
  name: string;
  dj: string;
  theme: string;
  dayAndTime: string;
  information: string;
}

const PROGRAMAS: Program[] = [
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

export const CONFIG = {
  STREAM_OPTIONS,
  DEFAULT_STREAM_OPTION,
  DEFAULT_COVER,
  USER_AGENT,
  PROGRAMAS,
};
