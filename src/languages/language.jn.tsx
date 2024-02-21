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
  REQUEST_SEARCH_PLACEHOLDER: "ローマ字で検索してください",
  REQUEST_SEARCH_BUTTON_TEXT: "検索",
  HARU_CHAN_TEXT: "はるちゃん",
  THEME_WORD: "テーマ",
  LOGIN_WORD: "ログイン",
};

const NoArLabel = (props: SvgProps) => (
  <Svg width="41" height="93" viewBox="0 0 41 93" fill="none">
    <Rect width="41" height="92" fill="#FF0000" />
    <Path
      d="M13.021 8.291C13.75 8.399 14.911 8.453 15.829 8.453C17.53 8.453 24.631 8.453 26.197 8.453C27.061 8.453 28.384 8.399 29.113 8.291V11.801C28.411 11.747 27.142 11.693 26.143 11.693C24.658 11.693 17.422 11.693 15.829 11.693C14.938 11.693 13.804 11.72 13.021 11.801V8.291ZM31.408 16.148C31.219 16.499 30.976 16.985 30.895 17.255C30.058 19.874 28.897 22.52 26.899 24.734C24.172 27.785 20.716 29.594 17.26 30.593L14.56 27.542C18.637 26.678 21.85 24.923 23.929 22.79C25.36 21.332 26.224 19.631 26.683 18.146C25.333 18.146 16.072 18.146 13.669 18.146C12.994 18.146 11.644 18.173 10.51 18.254V14.744C11.671 14.852 12.805 14.933 13.669 14.933C15.505 14.933 25.171 14.933 27.007 14.933C27.898 14.933 28.627 14.825 29.005 14.636L31.408 16.148Z"
      fill="white"
    />
    <Path
      d="M8.674 44.9698C13.507 43.7278 17.449 41.9728 20.473 40.1098C23.227 38.4088 26.305 35.7088 28.06 33.5758L30.976 36.3298C28.519 38.8138 25.225 41.3518 22.039 43.2688C18.988 45.0778 14.614 47.1028 10.348 48.3718L8.674 44.9698ZM19.906 41.8648L23.74 40.9468V53.1238C23.74 54.3118 23.794 55.9858 23.983 56.6608H19.69C19.798 56.0128 19.906 54.3118 19.906 53.1238V41.8648Z"
      fill="white"
    />
    <Path
      d="M26.493 61.3383C27.168 62.3643 28.059 63.9033 28.545 64.9023L26.304 65.8473C25.764 64.7133 24.954 63.3363 24.252 62.2563L26.493 61.3383ZM30.246 60.6363C30.948 61.6353 31.893 63.2553 32.406 64.2273L30.165 65.1723C29.598 64.0653 28.761 62.5533 28.005 61.5543L30.246 60.6363ZM29.274 66.4143C29.031 66.9273 28.815 67.7103 28.68 68.2773C28.059 70.9233 26.871 75.1353 24.63 78.1323C22.173 81.3723 18.582 84.0453 13.776 85.5843L10.833 82.3443C16.179 81.1023 19.23 78.7533 21.39 76.0263C23.199 73.7853 24.225 70.7073 24.576 68.3853C22.956 68.3853 14.019 68.3853 11.994 68.3853C10.779 68.3853 9.483 68.4663 8.781 68.5203V64.6863C9.591 64.7943 11.103 64.9293 11.994 64.9293C14.019 64.9293 22.983 64.9293 24.495 64.9293C25.035 64.9293 25.899 64.9023 26.601 64.7133L29.274 66.4143Z"
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
