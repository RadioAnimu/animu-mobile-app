import logo from "../assets/logo_JP.png";
import { Program } from "../utils/player.config";
import { version } from "../../package.json";
import ultimas_pedidas from "../assets/ultimos_pedidas-haru_jn.png";
import ultimas_tocadas from "../assets/ultimas_tocadas-haru_jn.png";
import fazer_pedido from "../assets/pedidos_harukinha_jn.png";
import Svg, { SvgProps, Rect, Path } from "react-native-svg";

const LANG = {
  key: "JP",
  value: "日本語",
};

const PROGRAMS: Program[] = [
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Jiyuu-Jikan-Logo.webp",
    name: "自由時間",
    dj: "放送チームの誰でも",
    theme: "（オタクなら何でもOK！）",
    dayAndTime: "いつでも",
    information:
      "ＤＪ春香の番組に乱入して、彼女にコーヒーを飲むように促します。ブラジルで最萌えエなラジオでいつでも、いつでもお楽しみください！",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/AnimuSong-Logo.webp",
    name: "アニムソング",
    dj: "LL!",
    theme: "トップ10リクエスト",
    dayAndTime: "毎週火曜日、20:00〜21:20 (BRT)",
    information:
      "ブラジル最大の萌え！ 先週のリスナーからのリクエストに基づいたトップ10",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/08/Logo-Natsukashii.webp",
    name: "懐かしい",
    dj: "Dolode",
    theme: "ノスタルジア",
    dayAndTime: "木曜日、20:00〜21:00 (BRT)",
    information:
      "過去に戻って、世代を築いたアニソングの最高をお楽しみください。中でも、City Popの魅力的で魅力的なリズムもお楽しみください！",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Expresso-Otaku-Logo.webp",
    name: "オタクのエクスプレス",
    dj: "LL!",
    theme: "クイズ",
    dayAndTime: "土曜日、20:00〜23:00 (BRT)",
    information:
      "私と一緒にこのオタクなエクスプレスに乗ってください！ オタクのエクスプレスは、リスナーが私、DJ LL！と一緒にオンエアでオタクのレベルをテストする番組です。そして、勝ったら、Discordで週のオタクになります🏆",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Animu-Plus-logo-final.webp",
    name: "アニム＋",
    dj: "放送チームの誰でも、リスナーと一緒に (BRT)",
    theme: "（オタクなら何でもOK²）",
    dayAndTime: "日曜日、18:00〜21:00",
    information:
      "アニム＋は、リスナーがライブで参加し、アナウンサーと一緒にインタラクションする番組です。私たちはリスナーに近づくのが大好きで、この番組は特にそれのために作られました！",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Logo-DollarRocks-1.webp",
    name: "ドルロックス！",
    dj: "Dollar$",
    theme: "Jーロック",
    dayAndTime: "日曜日、21:00〜00:00 (BRT)",
    information:
      "日本のロックの神が地上に降りてきて、すべての信者にメッセージを伝えるように私に命じました。最も重要な3つのルールは、今日はロック、明日もロック、そして常にロックです。🤘😝",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Yoake-Logo.webp",
    name: "夜明け",
    dj: "春香・雪",
    theme: "音楽ブロック",
    dayAndTime: "毎日、05:00〜07:00 (BRT)",
    information:
      "私たちの夜明け！ 夜明けは、素晴らしい音楽であなたの一日を明るくし、ライブでシーケンスを指示できる場所です！ 🌄",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/04/Kohi-Logo.webp",
    name: "コーヒー",
    dj: "春香・雪",
    theme: "音楽ブロック",
    dayAndTime: "毎日、07:00〜09:00 (BRT)",
    information:
      "あなたのオタクな朝を目覚めさせるブロック！あなたのハルちゃんと一緒にシーケンスを作成して、あなたのコーヒーを準備してください ☕",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Animu-Ohayou-Logo-maior.webp",
    name: "アニムおやほう～",
    dj: "春香・雪",
    theme: "音楽ブロック",
    dayAndTime: "毎日、09:00〜12:00 (BRT)",
    information:
      "あなたによって指導される朝！ブラジルで最も萌えな場所で一日の最高の部分を楽しむ最良の方法！ ☀️",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2023/03/Gohan-Desu-Logo.webp",
    name: "ごはんです！",
    dj: "春香・雪",
    theme: "音楽ブロック",
    dayAndTime: "毎日、12:00〜14:00 (BRT)",
    information:
      "あなたの最も楽しいランチタイム、ここであなたのごはんです！ 🍴ランチは私たちにとって非常に",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Oyatsu-Logo.webp",
    name: "おやつ",
    dj: "春香・雪",
    theme: "音楽ブロック",
    dayAndTime: "毎日、16:00〜18:00",
    information:
      "ブラジルで最も萌えのラジオで、最も甘く楽しい午後を！🍰私たちのはるちゃんと一緒に午後のシーケンスを作るおやつの時間",
  },
  {
    img: "https://www.animu.com.br/wp-content/uploads/2024/02/Nemukunai-logo.webp",
    name: "眠くない",
    dj: "春香・雪",
    theme: "音楽ブロック",
    dayAndTime: "毎日、00:00〜05:00 (BRT)",
    information:
      "眠らない夜！🌙 眠くないは眠れないリスナー向けのアニムの完璧なブロックであり、ブラジルで最も萌えのラジオではるちゃんと一緒にお気に入りの曲を生で聴きたい人に最適です 💜",
  },
];

const DICT = {
  PROGRAMS,
  TIME_REMAINING: "残り時間",
  WITH_DJ: "DJと",
  MENU: "メニュー",
  MENU_LAST_REQUESTED: "最後のリクエスト",
  MENU_LAST_PLAYED: "最後に再生されたもの",
  LINKS: "リンク",
  LINKS_DISCORD: "Discord",
  LINKS_WEBSITE: "ウェブサイト",
  VERSION_TEXT: `バージョン v${version} - によって ❤️ で開発されました`,
  SETTINGS_TITLE: "設定",
  SETTINGS_ACCOUNT_TITLE: "アカウント",
  SETTINGS_SAVE_DATA_TITLE: "データの保存",
  SETTINGS_QUALITY_LIVE_LABEL: "ライブカバーの品質：",
  SETTINGS_QUALITY_LIVE_LABEL_LOW: "低",
  SETTINGS_QUALITY_LIVE_LABEL_MEDIUM: "中",
  SETTINGS_QUALITY_LIVE_LABEL_HIGH: "高",
  SETTINGS_COVER_LIVE_LABEL_SWITCH: "ライブカバー：",
  SETTINGS_COVER_LAST_REQUESTED_SWITCH: "最後のリクエストされたカバー：",
  SETTINGS_COVER_LAST_PLAYED_SWITCH: "最後に再生されたカバー：",
  SETTINGS_COVER_REQUESTED_SWITCH: "カバーでリクエストする：",
  SETTINGS_LANGUAGE_SELECT_TITLE: "言語の選択",
  SETTINGS_LANGUAGE_SELECT_PLACEHOLDER: "言語を選択",
  SETTINGS_MEMORY_TITLE: "メモリ",
  SETTINGS_MEMORY_CLEAR_CACHE_SWITCH: "キャッシュされたカバーをクリア：",
  TRACK_REQUEST: "リクエストされた音楽",
  INFO_REQUEST: `こんにちは！私は春香です、ブラジルで最も萌えのラジオのDJです！${"\n"}既に選択をお済みのようですね！${"\n"}しかし、その前に、私やチーム宛にメッセージを残してみたいですか？このメッセージは、皆が見るために私たちのDiscordサーバーのメインチャットに配信されます${"\n"}💜 メッセージを残さなくても構いません。`,
  SEND_REQUEST_BUTTON_TEXT: "送信",
  SEND_REQUEST_PLACEHOLDER: "ここにメッセージを残してください",
  LOGIN_ERROR: "リクエストを作成するにはログインが必要です",
  SELECT_ERROR: "曲の選択中にエラーが発生しました",
  REQUEST_ERROR: "リクエスト作成中にエラーが発生しました: ",
  REQUEST_ERROR_ALREADY_REQUESTED: "この曲は既に以前にリクエストされています",
  REQUEST_SUCCESS: "リクエストが成功しました！",
  REQUEST_SEARCH_PLACEHOLDER: "検索するにはここに入力してください",
  REQUEST_SEARCH_BUTTON_TEXT: "検索",
  HARU_CHAN_TEXT: "はるちゃん",
  THEME_WORD: "テーマ",
  LOGIN_WORD: "ログイン",
};

const NoArLabel = (props: SvgProps) => (
  <Svg width="41" height="92" viewBox="0 0 41 92" fill="none">
    <Rect width="41" height="92" fill="#FF0000" />
    <Path
      d="M10.825 77.425C10.925 76.75 10.975 75.675 10.975 74.825C10.975 73.25 10.975 66.675 10.975 65.225C10.975 64.425 10.925 63.2 10.825 62.525L14.075 62.525C14.025 63.175 13.975 64.35 13.975 65.275C13.975 66.65 13.975 73.35 13.975 74.825C13.975 75.65 14 76.7 14.075 77.425L10.825 77.425ZM18.1 60.4C18.425 60.575 18.875 60.8 19.125 60.875C21.55 61.65 24 62.725 26.05 64.575C28.875 67.1 30.55 70.3 31.475 73.5L28.65 76C27.85 72.225 26.225 69.25 24.25 67.325C22.9 66 21.325 65.2 19.95 64.775C19.95 66.025 19.95 74.6 19.95 76.825C19.95 77.45 19.975 78.7 20.05 79.75L16.8 79.75C16.9 78.675 16.975 77.625 16.975 76.825C16.975 75.125 16.975 66.175 16.975 64.475C16.975 63.65 16.875 62.975 16.7 62.625L18.1 60.4ZM20.3 56.45C19.15 51.975 17.525 48.325 15.8 45.525C14.225 42.975 11.725 40.125 9.75 38.5L12.3 35.8C14.6 38.075 16.95 41.125 18.725 44.075C20.4 46.9 22.275 50.95 23.45 54.9L20.3 56.45ZM17.425 46.05L16.575 42.5L27.85 42.5C28.95 42.5 30.5 42.45 31.125 42.275L31.125 46.25C30.525 46.15 28.95 46.05 27.85 46.05L17.425 46.05ZM8.95 14.025C9.9 13.4 11.325 12.575 12.25 12.125L13.125 14.2C12.075 14.7 10.8 15.45 9.8 16.1L8.95 14.025ZM8.3 10.55C9.225 9.9 10.725 9.025 11.625 8.55L12.5 10.625C11.475 11.15 10.075 11.925 9.15 12.625L8.3 10.55ZM13.65 11.45C14.125 11.675 14.85 11.875 15.375 12C17.825 12.575 21.725 13.675 24.5 15.75C27.5 18.025 29.975 21.35 31.4 25.8L28.4 28.525C27.25 23.575 25.075 20.75 22.55 18.75C20.475 17.075 17.625 16.125 15.475 15.8C15.475 17.3 15.475 25.575 15.475 27.45C15.475 28.575 15.55 29.775 15.6 30.425L12.05 30.425C12.15 29.675 12.275 28.275 12.275 27.45C12.275 25.575 12.275 17.275 12.275 15.875C12.275 15.375 12.25 14.575 12.075 13.925L13.65 11.45Z"
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
