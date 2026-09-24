import Svg, { Path, Rect, SvgProps } from "react-native-svg";
import { Program } from "@/api";
import { PROGRAM_IMAGES } from "@/constants/programs";
import type { Dict } from "@/i18n/language.en";
import logo from "@/assets/logo_JP.webp";
import makeRequest from "@/assets/make_request_harukinha_jn.webp";
import lastPlayed from "@/assets/last_played-haru_jn.webp";
import lastRequested from "@/assets/last_requested-haru_jn.webp";

const PROGRAMS: Program[] = [
  {
    img: PROGRAM_IMAGES[0],
    name: "Animu NON-STOP",
    dj: "Haruka Yuki",
    theme: "音楽ブロック",
    dayAndTime: "いつでも",
    information:
      "Animu NON-STOP は、Animu が止まらない音楽ブロックです。最高の曲がノンストップで流れ、リスナーのあなたがいつでも曲順を決められます。",
  },
  {
    img: PROGRAM_IMAGES[1],
    name: "自由時間",
    dj: "放送チームの誰でも",
    theme: "（オタクなら何でもOK！）",
    dayAndTime: "いつでも",
    information:
      "ＤＪ春香ちゃんの番組に乗り込んで、彼女にコーヒーを飲ませちゃう。ブラジルで最も萌えのラジオで、いつでも楽しんでね！",
  },
  {
    img: PROGRAM_IMAGES[2],
    name: "アニムソング",
    dj: "LL!",
    theme: "トップ10リクエスト",
    dayAndTime: "毎週火曜日、20:00〜21:20 (BRT) だよ！",
    information:
      "ブラジル一萌えるトップ１０！先週のリスナーのリクエストで決まる、最高のランキングだ！",
  },
  {
    img: PROGRAM_IMAGES[3],
    name: "懐かしい",
    dj: "Dolode",
    theme: "ノスタルジア",
    dayAndTime: "木曜日、20:00〜21:00 (BRT) だよ！",
    information:
      "過去に戻って、一時代を築いた懐かしいアニソンを楽しもう！もちろん、シティ・ポップの魅惑的なリズムにも酔いしれてね！",
  },
  {
    img: PROGRAM_IMAGES[4],
    name: "オタクのエクスプレス",
    dj: "LL!",
    theme: "クイズ",
    dayAndTime: "土曜日、20:00〜23:00 (BRT) だよ！",
    information:
      "僕、DJ LLと一緒にこのオタク・エクスプレスに乗ろう！「オタク・エクスプレス」は、君のオタクレベルをオンエアでテストする番組だ！そして、勝者にはディスコードで週のオタクの称号が与えられるぞ🏆",
  },
  {
    img: PROGRAM_IMAGES[5],
    name: "アニム＋",
    dj: "放送チームの誰でも、リスナーと一緒にだよ！",
    theme: "（オタクなら何でもOK²）",
    dayAndTime: "日曜日、18:00〜21:00 (BRT) だよ！",
    information:
      "アニム＋は、リスナーが生で参加し、DJと直接話せる番組だ！リスナーの皆との繋がりが大好きだから、この番組は特に皆のために作ったんだ！",
  },
  {
    img: PROGRAM_IMAGES[6],
    name: "ドルロックス！",
    dj: "Dollar$",
    theme: "Jーロック",
    dayAndTime: "日曜日、21:00〜00:00 (BRT) だよ！",
    information:
      "日本のロックの神が地上に降りてきて、全ての信者にメッセージを伝えるように俺に命じた！絶対守るべき３つのルールは、今日はロック！明日もロック！そして永遠にロックだ！🤘😝",
  },
  {
    img: PROGRAM_IMAGES[7],
    name: "夜明け",
    dj: "雪・春香",
    theme: "曲ブロック",
    dayAndTime: "毎日、05:00〜07:00 (BRT) だよ！",
    information:
      "私たちの夜明け！素晴らしい音楽で今日一日を明るくスタートしよう！ここは君がライブでリクエストできる場所だ！🌄",
  },
  {
    img: PROGRAM_IMAGES[8],
    name: "コーヒー",
    dj: "雪・春香",
    theme: "曲ブロック",
    dayAndTime: "毎日、07:00〜09:00 (BRT) だよ！",
    information:
      "君のオタクな朝を目覚めさせるブロック！はるちゃんと一緒に朝の時間を過ごしながら、コーヒーでも淹れよう！☕",
  },
  {
    img: PROGRAM_IMAGES[9],
    name: "アニムおはよう～",
    dj: "雪・春香",
    theme: "曲ブロック",
    dayAndTime: "毎日、09:00〜12:00 (BRT) だよ！",
    information:
      "君が作る朝！ラジルで最も萌えのラジオで、今日一日を最高に楽しもう！☀️",
  },
  {
    img: PROGRAM_IMAGES[10],
    name: "ごはんです！",
    dj: "雪・春香",
    theme: "曲ブロック",
    dayAndTime: "毎日、12:00〜14:00 (BRT) だよ！",
    information:
      "最高のランチタイムはここ、「ごはんです」で！ランチは私たちにとって、すごく大事な時間だからね！🍴",
  },
  {
    img: PROGRAM_IMAGES[11],
    name: "おやつ",
    dj: "雪・春香",
    theme: "曲ブロック",
    dayAndTime: "毎日、16:00〜18:00 (BRT) だよ！",
    information:
      "ブラジルで最も萌えのラジオで、甘くて楽しい午後を過ごそう！はるちゃんと一緒におやつの時間を楽しんで、午後のリクエストもしちゃおう！🍰",
  },
  {
    img: PROGRAM_IMAGES[12],
    name: "眠くない",
    dj: "雪・春香",
    theme: "曲ブロック",
    dayAndTime: "毎日、00:00〜05:00 (BRT) だよ！",
    information:
      "眠らない夜！🌙 眠れないリスナーのための、アニムの完璧なブロックだ！ブラジルで最も萌えのラジオで、はるちゃんと一緒にお気に入りの曲をライブで聴こうよ💜",
  },
];

const DICT: Dict = {
  PROGRAMS,
  TIME_REMAINING: "のこり時間",
  SYNCHRONIZING: "同調中",
  WITH_DJ: "DJ",
  MENU: "メニュー",
  MENU_PLAYER: "プレーヤー",
  MENU_LAST_REQUESTED: "最後のリクエスト",
  MENU_LAST_PLAYED: "最後に流れた曲",
  MENU_MAKE_REQUEST: "リクエストする",
  LINKS: "リンク",
  LINKS_DISCORD: "ディスコード",
  LINKS_WEBSITE: "ウェブサイト",
  SETTINGS_TITLE: "設定",
  SETTINGS_ACCOUNT_TITLE: "アカウント",
  SETTINGS_SAVE_DATA_TITLE: "画像の読み込み",
  SETTINGS_QUALITY_ROW: "カバー画像の画質",
  SETTINGS_QUALITY_LIVE_LABEL_LOW: "低",
  SETTINGS_QUALITY_LIVE_LABEL_MEDIUM: "中",
  SETTINGS_QUALITY_LIVE_LABEL_HIGH: "高",
  SETTINGS_QUALITY_LIVE_LABEL_OFF: "オフ",
  SETTINGS_QUALITY_LIVE_OFF_HINT:
    "カバーをどこにもダウンロードしない（通信量を節約）",
  SETTINGS_COVER_LAST_REQUESTED_SWITCH: "リクエスト履歴のカバー：",
  SETTINGS_COVER_LAST_PLAYED_SWITCH: "最近流れた曲のカバー：",
  SETTINGS_COVER_REQUESTED_SWITCH: "リクエストするときのカバー：",

  SETTINGS_LANGUAGE_ROW: "アプリの言語",

  SETTINGS_LIVE_UPDATES_SWITCH: "リアルタイム情報：",
  SETTINGS_MEMORY_TITLE: "ストレージ",
  SETTINGS_GENERAL_TITLE: "一般",
  SETTINGS_PLAYBACK_TITLE: "再生",

  SETTINGS_VISUALIZER_SWITCH: "音の波形：",
  SETTINGS_MEMORY_CLEAR_CACHE_SWITCH: "ダウンロード済みカバーを再利用：",
  SETTINGS_STORAGE_TOTAL: "キャッシュされたカバー",
  SETTINGS_STORAGE_FILES: "件",
  SETTINGS_STORAGE_LIVE: "再生中のカバー",
  SETTINGS_STORAGE_REQUESTED: "リクエスト履歴のカバー",
  SETTINGS_STORAGE_PLAYED: "再生履歴のカバー",
  SETTINGS_STORAGE_SEARCH: "リクエスト検索のカバー",
  SETTINGS_STORAGE_EMPTY: "キャッシュされたカバーはまだありません",
  SETTINGS_STORAGE_HINT_OFF: "カバーのキャッシュは無効です",
  SETTINGS_STORAGE_LIMIT_TITLE: "キャッシュサイズの上限",
  SETTINGS_STORAGE_LIMIT_UNLIMITED: "無制限",
  SETTINGS_STORAGE_CLEANING: "削除中…",
  STORAGE_TITLE: "ストレージ",
  SETTINGS_STORAGE_FREE_UP: "空き容量を増やす",
  SETTINGS_QUALITY_ROW_DESC: "きれいな画像は通信量が増えます",
  SETTINGS_QUALITY_RECOMMENDED: "おすすめ",
  SETTINGS_VISUALIZER_DESC: "再生中に波形を表示します",
  SETTINGS_LIVE_UPDATES_DESC: "バックグラウンドでも曲情報を更新します",

  SETTINGS_HAPTICS_SWITCH: "触覚フィードバック:",
  SETTINGS_HAPTICS_DESC: "タップや操作時の振動",
  A11Y_BACK: "戻る",
  A11Y_OPEN_MENU: "メニューを開く",
  A11Y_MAKE_REQUEST: "リクエストする",
  A11Y_OPENS_SETTINGS: "設定を開きます",
  A11Y_OPENS_LOGIN: "ログインを開きます",
  A11Y_PLAY: "再生",
  A11Y_PAUSE: "一時停止",
  A11Y_CLOSE: "閉じる",
  A11Y_CLEAR_SEARCH: "検索をクリア",
  SETTINGS_MEMORY_CLEAR_CACHE_DESC: "カバーを保存して表示を速くします",
  SETTINGS_UPDATES_TITLE: "アプリの更新",
  SETTINGS_UPDATES_ROW: "更新を確認",
  SETTINGS_UPDATES_DESC: "再インストールせずに最新の変更を受け取れます",
  SETTINGS_ASSISTANT_TITLE: "音声アシスタント",
  SETTINGS_ASSISTANT_HINT_IOS:
    "「Hey Siri、Rádio Animuを再生」と話しかけてください",
  SETTINGS_ASSISTANT_HINT_ANDROID:
    "「Ok Google、Rádio Animuを再生」と話しかけてください",

  SETTINGS_UPDATES_CHECKING: "確認中…",
  SETTINGS_UPDATES_DOWNLOADING: "ダウンロード中…",
  SETTINGS_UPDATES_UP_TO_DATE: "最新です",
  SETTINGS_UPDATES_DOWNLOADED: "更新をダウンロードしました — 再起動で適用",
  SETTINGS_UPDATES_READY: "更新の準備完了",
  SETTINGS_UPDATES_ERROR: "更新を確認できませんでした",
  SETTINGS_UPDATES_RESTART_TITLE: "今すぐ再起動しますか？",
  SETTINGS_UPDATES_RESTART_MSG:
    "ダウンロードした更新はアプリの再起動後に適用されます。",
  SETTINGS_UPDATES_RESTART_CONFIRM: "再起動",
  SETTINGS_ADVANCED_TITLE: "詳細",
  SETTINGS_RESET_ROW: "初期設定に戻す",
  SETTINGS_RESET_CONFIRM_TITLE: "設定をリセットしますか？",
  SETTINGS_RESET_CONFIRM_MSG: "すべての設定が初期状態に戻ります。",
  SETTINGS_RESET_CONFIRM: "リセット",

  SETTINGS_FOOTER_TEAM: "Animuチームが❤️とたくさんの☕で制作",
  SETTINGS_FOOTER_FOUNDER: "設立・デザイン：Lucas Lopes (LL!)",
  SETTINGS_FOOTER_DEV:
    "開発：Afonso Oliveira (FZero)、José Silva (Tossa)、João Vitor (Mr.Zapp)、Ricardo Freitas (Ness)",
  SETTINGS_FOOTER_LOCATION:
    "サンタクルス・ド・カピバリベ – ペルナンブコ州、ブラジル",
  SETTINGS_FOOTER_SYSTEM: "Yuki 放送システム",
  SETTINGS_FOOTER_CHIHAYA: "Chihaya Radio Station by",
  SETTINGS_FOOTER_NONPROFIT:
    "非営利プロジェクト · オタク文化への愛から生まれました 💜",
  SETTINGS_FOOTER_LICENSE: "ライセンス (BY-NC-SA) 4.0",
  SETTINGS_FOOTER_SOCIAL: "SNS",
  SETTINGS_FOOTER_SOURCE: "ソースコード",
  SETTINGS_ABOUT_ROW: "このアプリについて",
  SETTINGS_ABOUT_ROW_DESC: "バージョン・クレジット・ライセンス",
  ABOUT_TITLE: "アプリについて",
  ABOUT_APP_INFO_TITLE: "アプリ情報",
  ABOUT_VERSION_ROW: "バージョン",
  ABOUT_RELEASE_ROW: "配布",
  ABOUT_OTA_VERSION_ROW: "OTAバージョン",
  ABOUT_OTA_BUILTIN: "内蔵",
  ABOUT_OTA_LOADING: "…",
  ABOUT_PACKAGE_ROW: "パッケージ",
  ABOUT_RELEASE_APP_STORE: "App Store",
  ABOUT_RELEASE_ADHOC: "AltStore（Ad-Hoc）",
  ABOUT_RELEASE_DEVELOPMENT: "開発",
  ABOUT_RELEASE_SIMULATOR: "シミュレータ",
  ABOUT_RELEASE_ENTERPRISE: "Enterprise",
  ABOUT_RELEASE_PLAY: "Google Play",
  ABOUT_RELEASE_APK: "APK（サイドロード）",
  ABOUT_RELEASE_UNKNOWN: "不明",
  ABOUT_CREDITS_TITLE: "クレジット",

  ABOUT_ROLE_MAINTAINER: "アプリ管理者",

  ABOUT_DONORS_TITLE: "支援者",
  ABOUT_DONORS_INTRO:
    "このアプリを実現してくれた皆さんに心から感謝します。下記の方々は2024年2月15日〜18日のご寄付でプロジェクトを支え、Android版、そしてiOS版のリリースを可能にしてくれました。",

  SETTINGS_FOOTER_NPC: "NPCpepper",
  SETTINGS_LEGAL_TITLE: "法的事項",
  SETTINGS_PRIVACY_POLICY: "プライバシーポリシー",
  SETTINGS_CONTENT_LICENSE: "ラジオのコンテンツ",
  SETTINGS_CONTENT_LICENSE_DESC: "非営利プロジェクト · CC BY-NC-SA 4.0",

  SETTINGS_COPYRIGHT_NOTICE: "© 2018–2026 Rádio Animu",
  SETTINGS_IMAGE_RIGHTS:
    "改変された画像はすべて、それぞれの制作者・スタジオに帰属します。",
  STORAGE_EXPLAIN:
    "曲のカバー画像を端末に保存して、すばやく表示し通信量を節約します。",
  STORAGE_FREE_UP: "空き容量を増やす",
  STORAGE_CLEAR_CONFIRM_TITLE: "空き容量を増やしますか？",
  STORAGE_CLEAR_CONFIRM_MSG:
    "保存されたカバー画像はすべて削除されます。次に再生したときに再ダウンロードされます。",
  STORAGE_CLEAR_CONFIRM: "削除",
  STORAGE_LIMIT_ROW: "最大サイズ",
  STORAGE_DEVICE_FREE: "この端末では {total} 中 {free} 空き",
  STORAGE_DEVICE_CACHED: "キャッシュ済みカバー：{cached}（この端末の {pct}%）",
  STORAGE_ADVANCED_TITLE: "詳細設定",
  STORAGE_PARTITION_CUSTOM_LABEL: "パーティションを個別に設定",
  STORAGE_PARTITION_CUSTOM_DESC: "上限をセクションごとに配分できます",
  STORAGE_PARTITION_AUTO: "自動",
  STORAGE_PARTITION_CAP_DESC: "実効上限: {cap}",
  STORAGE_PARTITION_NEEDS_LIMIT: "個別設定には上限の設定が必要です",
  STORAGE_FREED: "{freed} を解放しました",
  TRACK_REQUEST: "リクエスト曲",
  INFO_REQUEST: `こんにちは！私は春香、ブラジルで最も萌えのラジオのDJだよ！${"\n"}もう選曲はバッチリかな？${"\n"}その前に、私やチームのみんなにメッセージを残してみない？君からのメッセージは、みんなが見れるようにディスコードのメインチャットに流すね！${"\n"}💜 メッセージを残したくない場合は、無理しなくて大丈夫だよ。`,
  SEND_REQUEST_BUTTON_TEXT: "リクエストを送る",
  SEND_REQUEST_PLACEHOLDER: "ここにメッセージを書いてね",
  LOGIN_ERROR: "リクエストするにはログインが必要だよ",
  SELECT_ERROR: "選曲に失敗しちゃった",
  REQUEST_ERROR: "リクエスト失敗: ",
  REQUEST_ERROR_PEDIBLOCK:
    "この曲はもうリクエストされたよ。{time}のあとにまたリクエストできるよ。",
  REQUEST_ERROR_PEDIBLOCK_RECENT: "この曲はさっきリクエストされたばかりだよ。",
  REQUEST_ERROR_BLOCK_90: "「{detail}」の曲が直近90分で多すぎるよ。",
  REQUEST_ERROR_HARUBLOCK: "この曲はAutoDJでさっき流れたばかりだよ。",
  REQUEST_ERROR_ONAIR: "DJが放送中のときはリクエストできないよ。",
  REQUEST_ERROR_BLOCOBLOCK: "今はリクエストをお休みしているよ。",
  REQUEST_ERROR_NOLOGIN: "セッションが切れちゃったよ。もう一度ログインしてね。",
  REQUEST_ERROR_NO2FA:
    "リクエストにはDiscordで2段階認証を有効にする必要があるよ。",
  REQUEST_ERROR_PANEL:
    "ラジオのパネルが一時的に利用できないよ。少ししてからもう一度試してね。",
  REQUEST_SUCCESS: "リクエスト成功！",
  REQUEST_SEARCH_PLACEHOLDER: "ローマ字で検索してね",
  REQUEST_SEARCH_MIN: "3文字以上入力してね",
  REQUEST_SEARCH_RECENT: "最近の検索",
  REQUEST_SEARCH_RECENT_CLEAR: "クリア",
  REQUEST_SEARCH_EMPTY: "曲が見つかりませんでした。別のキーワードで試してね。",
  REQUEST_SEARCH_ERROR: "検索できませんでした。接続を確認してね。",
  HARU_CHAN_TEXT: "はるちゃん",
  THEME_WORD: "テーマ",
  LOGIN_WORD: "ログイン",
  FORM_LABEL_NICK: "ニックネーム",
  FORM_LABEL_CITY: "すんでいる場所",
  FORM_LABEL_ARTIST: "アーティスト",
  FORM_LABEL_MUSIC: "曲",
  FORM_LABEL_ANIME: "アニメ/ノベルげー/ゲーム",
  FORM_LABEL_REQUEST: "メッセージ",
  ERROR_STRIKE_AND_OUT:
    "エラーなのですっ！90分ごとにできるリクエストは3曲までだよっ！🎶💜",
  LIVE_REQUEST_TITLE: "放送中のDJにリクエストを送ろう！",
  OPTIONAL_LABEL: "任意",
  FORM_PLACEHOLDER_NICK: "名前かニックネームを入力してね",
  FORM_PLACEHOLDER_CITY: "住んでいる場所を入力してね",
  FORM_PLACEHOLDER_ARTIST: "アーティスト名を入力してね",
  FORM_PLACEHOLDER_MUSIC: "曲名を入力してね",
  FORM_PLACEHOLDER_ANIME: "アニメ/ノベルゲー/ゲーム名を入力してね",
  FORM_PLACEHOLDER_REQUEST: "DJへのメッセージを書いてね",
  OK_BUTTON: "OK",
  ERROR_TITLE: "エラーが発生しちゃった💜",
  ERROR_MESSAGE: "予期しないエラーが発生したよ。もう一度試してね。",
  ERROR_RETRY: "もう一度試す",
  TEXT_COPIED: "コピーしました！",
  LOGIN_SUCCESS: "ログインできたよ！",
  LOGIN_FAILED: "ログインできなかったよ。もう一度試してね。",
  LOGIN_MISSING_FIELDS: "全部の項目を入力してね。",
  LOGIN_TITLE: "ログイン",
  LOGIN_SUBTITLE: "続ける方法を選んでね",
  LOGIN_OR: "または",
  LOGIN_WITH_ANIMU_CONNECT: "Animu Connect で続ける",
  LOGIN_ANIMU_CONNECT_HINT:
    "Animu アカウントに登録したメールが使えるよ。プロバイダーのメールは自動だよ。追加のメールはプロフィールで登録できるよ。",
  LOGIN_CONNECT_SUBTITLE: "4桁のコードをメールで送るよ",
  LOGIN_EMAIL: "メール",
  LOGIN_EMAIL_PLACEHOLDER: "you@example.com",
  LOGIN_SEND_CODE: "コードを送る",
  LOGIN_CODE: "コード",

  LOGIN_CODE_SENT: "メールにコードを送ったよ。",
  LOGIN_CODE_SUBTITLE: "{email} に送ったコードを入力してね",
  LOGIN_CODE_RESEND: "コードを再送",
  LOGIN_CODE_CHANGE_EMAIL: "別のメールを使う",
  LOGIN_CODE_INVALID: "コードが間違っているか期限切れだよ。もう一度試してね。",
  LOGIN_BUTTON: "ログイン",
  ACCOUNT_TITLE: "アカウント",
  ACCOUNT_SIGNED_OUT: "ログインしていないよ。",
  ACCOUNT_SIGN_IN: "ログイン",

  ACCOUNT_VERIFIED_INFO:
    "リクエストできるのは認証済みのリスナーだけだよ。認証するには、ディスコードを連携して2段階認証を有効にしてね。",
  ACCOUNT_CONNECTED_VIA: "接続中:",
  ACCOUNT_LAST_LOGIN: "最終ログイン",
  ACCOUNT_SHOW: "表示",
  ACCOUNT_HIDE: "隠す",
  ACCOUNT_REFRESH: "プロフィールを更新",
  ACCOUNT_REFRESHED: "プロフィールを更新したよ",
  ACCOUNT_LINKED_ACCOUNTS: "連携アカウント",
  ACCOUNT_LINKED: "連携済み",
  ACCOUNT_NOT_LINKED: "未連携",
  ACCOUNT_UNLINK: "連携解除",
  ACCOUNT_LINK: "連携",
  ACCOUNT_LAST_PROVIDER:
    "アカウントを1つ以上残してね。退会したい場合はアカウントを削除してね。",
  ACCOUNT_LINK_SUCCESS: "連携したよ",
  ACCOUNT_UNLINK_SUCCESS: "連携を解除したよ",
  ACCOUNT_ANIMU_CONNECT: "Animu Connect",
  ACCOUNT_ANIMU_CONNECT_DESC: "メールコードでのパスワードレスログイン。",
  ACCOUNT_ANIMU_CONNECT_READY_AS: "{email} で設定済み",
  ACCOUNT_ANIMU_CONNECT_FORM_HINT:
    "プロバイダのメールは自動。追加メールを1つ設定できます。",
  ACCOUNT_EMAILS_TITLE: "メール",
  ACCOUNT_DANGER: "危険な操作",
  ACCOUNT_LOGOUT: "ログアウト",
  ACCOUNT_LOGOUT_HINT:
    "この端末のセッションを終了します。アカウントは残ります。",
  ACCOUNT_DELETE: "アカウントを削除",
  ACCOUNT_DELETE_HINT: "プロフィールとセッションを完全に削除します。",
  ACCOUNT_DELETE_CONFIRM_TITLE: "アカウントを削除する？",
  ACCOUNT_DELETE_CONFIRM_MSG:
    "プロフィール・連携アカウント・セッションが完全に削除されるよ。元には戻せないよ。",
  ACCOUNT_CANCEL: "キャンセル",
  ACCOUNT_ACTION_FAILED: "失敗しちゃった。もう一度試してね。",
  ACCOUNT_SAVE: "保存",
  ACCOUNT_EMAIL_ADD: "メールを追加",
  ACCOUNT_EMAIL_SAVED: "メールを保存したよ",
  ACCOUNT_EMAIL_TAKEN: "そのメールはすでに使われているよ。",
  ACCOUNT_EMAIL_REMOVE: "削除",
  ACCOUNT_EMAIL_REMOVED: "メールを削除したよ",
  ACCOUNT_EMAIL_REMOVE_CONFIRM_TITLE: "メールを削除する？",
  ACCOUNT_EMAIL_REMOVE_CONFIRM_MSG: "{email} でログインできなくなるよ。",
  ACCOUNT_EMAIL_EXTRA: "追加",
  ACCOUNT_EMAIL_EMPTY: "まだメールが登録されていないよ。",
  SETTINGS_ACCOUNT_SIGN_IN: "アカウントにログイン",
};

const OnAirLabel = (props: SvgProps) => (
  <Svg width="41" height="92" viewBox="0 0 41 92" fill="none">
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

const LiveRequestsEnabled = (props: SvgProps) => {
  return (
    <Svg width="81" height="23" viewBox="0 0 81 23" fill="none">
      <Rect width="76.1881" height="23" rx="4" fill="#6BDB00" />
      <Path d="M81 11.5L76.1881 16L76.1881 7L81 11.5Z" fill="#6BDB00" />
      <Path
        d="M33.892 5.587C33.827 6.003 33.801 6.497 33.814 6.913C33.853 9.058 33.944 12.633 33.97 15.259C33.983 16.091 33.502 16.572 32.514 16.572C31.721 16.572 31.006 16.546 30.265 16.494L30.109 14.804C30.707 14.895 31.409 14.947 31.851 14.947C32.176 14.947 32.293 14.778 32.293 14.414C32.293 12.62 32.267 9.058 32.163 6.913C32.124 6.354 32.098 5.938 32.033 5.587H33.892ZM26.469 7.758C26.833 7.797 27.457 7.849 27.899 7.849C28.809 7.849 34.815 7.849 35.452 7.849C35.868 7.849 36.479 7.784 36.791 7.745V9.461C36.388 9.448 35.881 9.435 35.53 9.435C35.023 9.435 28.666 9.435 27.951 9.435C27.47 9.435 26.924 9.461 26.469 9.487V7.758ZM25.767 13.946C28.484 12.646 30.759 10.644 31.695 9.11H32.54L32.553 10.501C31.5 12.074 29.199 14.115 26.963 15.298L25.767 13.946ZM41.133 6.12C42.03 6.731 43.72 8.083 44.487 8.876L43.161 10.228C42.485 9.5 40.847 8.083 39.898 7.433L41.133 6.12ZM39.495 14.778C41.536 14.492 43.213 13.829 44.474 13.088C46.697 11.762 48.387 9.786 49.219 8.031L50.22 9.851C49.245 11.619 47.516 13.413 45.423 14.674C44.097 15.467 42.42 16.182 40.6 16.494L39.495 14.778Z"
        fill="#270052"
      />
    </Svg>
  );
};

const LiveRequestsDisabled = (props: SvgProps) => {
  return (
    <Svg width="81" height="23" viewBox="0 0 81 23" fill="none">
      <Rect width="76.1881" height="23" rx="4" fill="#6BDB00" />
      <Path d="M81 11.5L76.1881 16L76.1881 7L81 11.5Z" fill="#6BDB00" />
      <Path
        d="M33.892 5.587C33.827 6.003 33.801 6.497 33.814 6.913C33.853 9.058 33.944 12.633 33.97 15.259C33.983 16.091 33.502 16.572 32.514 16.572C31.721 16.572 31.006 16.546 30.265 16.494L30.109 14.804C30.707 14.895 31.409 14.947 31.851 14.947C32.176 14.947 32.293 14.778 32.293 14.414C32.293 12.62 32.267 9.058 32.163 6.913C32.124 6.354 32.098 5.938 32.033 5.587H33.892ZM26.469 7.758C26.833 7.797 27.457 7.849 27.899 7.849C28.809 7.849 34.815 7.849 35.452 7.849C35.868 7.849 36.479 7.784 36.791 7.745V9.461C36.388 9.448 35.881 9.435 35.53 9.435C35.023 9.435 28.666 9.435 27.951 9.435C27.47 9.435 26.924 9.461 26.469 9.487V7.758ZM25.767 13.946C28.484 12.646 30.759 10.644 31.695 9.11H32.54L32.553 10.501C31.5 12.074 29.199 14.115 26.963 15.298L25.767 13.946ZM49.557 7.355C49.427 7.602 49.336 7.979 49.271 8.252C48.972 9.526 48.4 11.541 47.308 12.997C46.138 14.544 44.409 15.844 42.082 16.585L40.665 15.025C43.252 14.427 44.708 13.296 45.761 11.983C46.632 10.891 47.113 9.422 47.295 8.304C46.502 8.304 42.212 8.304 41.237 8.304C40.639 8.304 40.028 8.343 39.69 8.356V6.523C40.08 6.575 40.808 6.627 41.237 6.627C42.212 6.627 46.528 6.627 47.256 6.627C47.503 6.627 47.919 6.614 48.27 6.536L49.557 7.355Z"
        fill="#270052"
      />
    </Svg>
  );
};

const IMGS = {
  LOGO: logo,
  LAST_REQUEST: lastRequested,
  LAST_PLAYED: lastPlayed,
  LIVE_LABEL: OnAirLabel,
  MAKE_REQUEST: makeRequest,
  LIVE_REQUEST_ENABLED: LiveRequestsEnabled,
  LIVE_REQUEST_DISABLED: LiveRequestsDisabled,
};

export { DICT, IMGS };
