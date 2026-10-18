<?php
/**
 * Rádio Animu app — store links for the "Rate the app" row in Settings.
 *
 * Drop this file in the server's /teste folder:
 *   https://www.animu.moe/teste/app-stores.php
 *
 * The app detects where it was installed from and opens the matching
 * store page so the listener can leave a review. A store whose "url" is
 * null shows a greyed-out row that answers with a "coming soon" notice.
 *
 * Edit only the $STORES values below. Plain PHP 8, no dependencies.
 */

declare(strict_types=1);

$PACKAGE = 'com.nessjs.animu';

$STORES = [
    // Google Play — installs from the Play Store.
    'play' => [
        'name' => 'Google Play',
        'url'  => "https://play.google.com/store/apps/details?id={$PACKAGE}&showAllReviews=true",
    ],

    // Apple App Store — not listed yet. Once it is, paste the numeric App
    // Store ID (App Store Connect → App Information → Apple ID), e.g.:
    //   'url' => 'https://apps.apple.com/app/id1234567890?action=write-review',
    'app-store' => [
        'name' => 'App Store',
        'url'  => null,
    ],

    // AltStore / SideStore — sideloaded iOS builds. AltStore has no reviews,
    // so this opens the app's source page inside AltStore.
    'altstore' => [
        'name' => 'AltStore',
        'url'  => 'altstore://source?url=https://radioanimu.github.io/animu-mobile-app/source.json',
    ],

    // Android APK installed by hand (GitHub, file share…). Reviews can only
    // be left on a store, so this points at the Play listing.
    'apk' => [
        'name' => 'Google Play',
        'url'  => "https://play.google.com/store/apps/details?id={$PACKAGE}&showAllReviews=true",
    ],
];

// ---------------------------------------------------------------------------

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=3600');
header('X-Content-Type-Options: nosniff');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    http_response_code(204);
    exit;
}
if ($method !== 'GET' && $method !== 'HEAD') {
    header('Allow: GET, HEAD, OPTIONS');
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$stores = [];
foreach ($STORES as $id => $store) {
    $url = $store['url'] ?? null;
    $url = is_string($url) && trim($url) !== '' ? trim($url) : null;
    $stores[$id] = [
        'name'      => (string) $store['name'],
        'url'       => $url,
        'available' => $url !== null,
    ];
}

echo json_encode(
    ['version' => 1, 'stores' => $stores],
    JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT,
);
