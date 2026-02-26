<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header('Expires: Sun, 22 Apr 2018 00:00:00 GMT');
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

session_id($_POST['PHPSESSID']);
session_start();

if($_SESSION['discord_login'] ){
extract($_SESSION['discord_data']);

if ($mfa === false){
die('NO2FA');  
}

if(empty($username)){
die("strike and out");
}

if(empty($id)){
die("strike and out");
}

if(empty($mfa)){
die("strike and out");
}

if($id === "124198518280814592"){
die("strike and out");
}

$nomenick = $username;



$ipaddr = $_SERVER['REMOTE_ADDR'];
$server = 1;
$musicid = $_POST['allmusic'];
$recado = $_POST['message'];



$proxyLink = "https://www.animu.moe";

// treta temporaria para converter de ipv6 para ipv4

$v4mapped_prefix_hex = '00000000000000000000ffff';
$v4mapped_prefix_bin = pack("H*", $v4mapped_prefix_hex);

$ip_bin = inet_pton($ipaddr);

if (substr($ip_bin, 0, strlen($v4mapped_prefix_bin)) == $v4mapped_prefix_bin) {
    $ip_bin = substr($ip_bin, strlen($v4mapped_prefix_bin));
}

$ipaddr = inet_ntop($ip_bin);






/*
if ($nomenick === ".") {
    exit("nome longo");
}
*/

if (mb_strlen($recado) > 120) {
    exit("blablabla");
}

/*
if (mb_strlen($nomenick) > 15) {
    exit("nome longo");
}
*/

if ($recado === '') {
    $recado = '';
    $vazio = true;
}

/*
if ("" == trim($nomenick)) {
    exit("Shoutout to all MKULTRA survivors!");
}
*/

if (!is_numeric($musicid)) {
    exit("Shoutout to all MKULTRA survivors!");
}

if (!preg_match("/\S/", $recado)) {
    $recado = '';
    $vazio = true;
}


$musicdata = json_decode(file_get_contents('https://stm.sistemayuki.com:3000/api/v2/music/' . $musicid . '/?format=json'), true);
$songtitle = $musicdata['meta'];
$artist = $musicdata['author'];
$coverart_link = $musicdata['image_large'];
$songname = $musicdata["title"];
$songexplode = explode("|", $songname);

//URL pra cache
$parsed_url = parse_url($coverart_link);
$coverart_link = $proxyLink . $parsed_url['path'];


//Checa se algum DJ esta no ar
$djdata = json_decode(file_get_contents('https://www.animu.moe/teste/locutor.php'), true);

if ($djdata["locutor"] != "Haruka Yuki") {
    die('ONAIR');
} else if ($djdata["locutor"] == "Manutenção") {
    die('MANU');
} else if ($djdata["pedidos_programa"] == "nao" && $djdata["locutor"] == "Haruka Yuki") {
    die('BLOCOBLOCK');
}

//  Sistema de registro e bloqueio de IP
require('connbedido.php');
$musid = mysqli_real_escape_string($cone, $musicid);
$artisto = stripcslashes(mysqli_real_escape_string($cone, $artist));
$sungname = stripcslashes(mysqli_real_escape_string($cone, $songtitle));
$nickelodeon = mysqli_real_escape_string($cone, htmlspecialchars($nomenick));
$recado_trat = str_replace(array('http://', 'https://'), '', $recado);
$recadin = mysqli_real_escape_string($cone, htmlspecialchars($recado_trat));

//Atualiza os pedidos antigos na DB
$updateold = mysqli_query($cone, "UPDATE sp_queue SET attempt = 7 WHERE attempt = 1 AND timestrike < (NOW() - INTERVAL 90 MINUTE);");
$updateold = mysqli_query($cone, "UPDATE sp_queue SET attempt = 7 WHERE attempt = 2 AND timestrike < (NOW() - INTERVAL 90 MINUTE)");
$updateold = mysqli_query($cone, "UPDATE sp_queue SET attempt = 7 WHERE attempt = 3 AND timestrike < (NOW() - INTERVAL 90 MINUTE)");


//Check 3 strike

$checkip = mysqli_query($cone, "SELECT ipaddr, attempt, remain FROM sp_queue WHERE ipaddr = '$ipaddr' AND attempt < 4 AND remain = 0");
$row = mysqli_fetch_assoc($checkip);
if ($row['ipaddr'] == $ipaddr && $row['remain'] == 0) {
    mysqli_close($cone);
    die("strike and out");
}
;

//Check 3 strike (mas para ids discord)

$check_discordid = mysqli_query($cone, "SELECT discord FROM sp_queue WHERE discord = '$id' AND timestrike > (NOW() - INTERVAL 90 MINUTE) ");
$rows_discordid = mysqli_num_rows($check_discordid);

if ($rows_discordid > 2) {
    mysqli_close($cone);
    die("strike and out");
}

//Checa as ultimas 24 horas de pedidos

$checaid = mysqli_query($cone, "SELECT music_id FROM sp_queue WHERE music_id = '$musid' AND timestrike > (NOW() - INTERVAL 1440 MINUTE)");
$rownid = mysqli_num_rows($checaid);
if ($rownid > 0) {
    $checa_timestrike = mysqli_query($cone, "SELECT music_id,timestrike FROM sp_queue where music_id = '$musid' ORDER BY `sp_queue`.`timestrike` DESC LIMIT 1;");
    $results_timestrike = mysqli_fetch_assoc($checa_timestrike);

    $d = DateTime::createFromFormat(
        'Y-m-d H:i:s',
        $results_timestrike['timestrike'],
        new DateTimeZone('UTC')
    );

    die('{"pediblock":"' . $results_timestrike['timestrike'] . '"}');
}
;



//Checa anime

if ($pos = strpos($songtitle, '|')) {
    $aniname = mysqli_real_escape_string($cone, stripcslashes(substr($songtitle, $pos + 1)));
    $checanime = mysqli_query($cone, 'SELECT music FROM sp_queue WHERE music LIKE "%' . mysqli_real_escape_string($cone,$aniname) . '" AND timestrike > (NOW() - INTERVAL 90 MINUTE)');
    $rownumber = mysqli_num_rows($checanime);
    if ($rownumber > 1) {
        die('{"aniblock":"' . $aniname . '"}');
    }
    ;
}

//Checa artista

if ($pos = strpos($songtitle, '|')) {
    $checartist = mysqli_query($cone, 'SELECT artist FROM sp_queue WHERE artist LIKE "%' . mysqli_real_escape_string($cone,$artist) . '" AND timestrike > (NOW() - INTERVAL 90 MINUTE)');
    $rownumber = mysqli_num_rows($checartist);
    if ($rownumber > 1) {
        die('{"artistblock":"' . $artist . '"}');
    }
    ;
}


//Checa nome da musica (para evitar pedir a musga original + covers)

if(isset($songexplode[0])){

    $trimexplode = mysqli_real_escape_string($cone,trim($songexplode[0]));
    $checanome = $cone->prepare("SELECT music FROM sp_queue WHERE music REGEXP BINARY CONCAT(?,'?') AND timestrike > (NOW() - INTERVAL 180 MINUTE)");
    $checanome->bind_param("s", $trimexplode);
        
    try {
        $checanome->execute();
        $checanomeres =  $checanome->get_result();
    
    if( mysqli_num_rows($checanomeres) > 0){
    die('{"coverblock":"' . $songexplode[0] . '"}');
}

    } catch (Exception $e){ 
        //lol
    }
    
    
} else {

    
       $trimtitle = mysqli_real_escape_string($cone,trim($songtitle));
    
     $checanome = $cone->prepare("SELECT music FROM sp_queue WHERE music REGEXP BINARY CONCAT(?,'?') AND timestrike > (NOW() - INTERVAL 180 MINUTE)");
        $checanome->bind_param("s", $trimtitle);
         try {
        $checanome->execute();
        $checanomeres =  $checanome->get_result();

if( mysqli_num_rows($checanomeres) > 0){
    die('{"coverblock":"' . $songtitle . '"}');
}
         }  catch (Exception $e){ 
        //fodase kkkk
    }
    
}



//Checa se a Haru(AutoDJ) já tocou a musica nas ultimas (aproximadamente) 24 horas

$hispat = '/pedido/mi';
$musichistory = json_decode(file_get_contents('https://stm.sistemayuki.com:3000/api/v2/history/?limit=50&offset=0&server=1&format=json'), true);
for ($i = 0; $i < 50; $i++) {
    $historyexplode = explode("|", $musichistory['results'][$i]['title']);
    
    if ($musicid == $musichistory['results'][$i]['all_music_id'] && !preg_match($hispat, $musichistory['results'][$i]['metadata'])) {
        die("harublock");
    };
    
    
    // uma mescla entre o coverblock e a harublock  (basicamente para não pedirem covers de musgas que a haruka ja tocou)
    if(isset($historyexplode[0])){
        if($historyexplode[0] ==  $songexplode && !preg_match($hispat, $musichistory['results'][$i]['metadata'])){
            die("harublock");
        } else {
            if($songtitle == $musichistory['results'][$i]['title']){
               die("harublock");
            }
        }
    }
    
};



//checagem de reputação de ip

$curl = curl_init();
curl_setopt_array($curl, [
    CURLOPT_URL => 'https://proxycheck.io/v2/' . $ipaddr . '?key=00rh3o-e52028-ei071x-247397&vpn=1&asn=1&risk=1',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => "GET",
]);

$ipresult = curl_exec($curl);
$err = curl_error($curl);


$checkinfos = json_decode($ipresult, true);

$risk = $checkinfos[$ipaddr]['risk'];
$proxy = $checkinfos[$ipaddr]['proxy'];
$type = $checkinfos[$ipaddr]['type'];

if (($proxy === 'no' && $risk > 66) || ($proxy === 'yes' && $type === 'VPN' && $risk > 33) || ($proxy === 'yes' && $type != 'VPN')) {
    die('strike and out');
}
;

//fim de checagem de rep

if (!$vazio) {
    $recadoever = $recado;
}
;

//open connection
$nomenickSemTreta = preg_replace('/[^\x20-\x7E]/', '', $nomenick);

$chpedi = curl_init();
curl_setopt($chpedi, CURLOPT_PORT, 8999);
curl_setopt($chpedi, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($chpedi, CURLOPT_POST, false);
curl_setopt($chpedi, CURLOPT_URL, 'https://stm.sistemayuki.com:3000/api/playrequest/add/?server=1&allmusic=' . $musicid . '&person=' . $nomenickSemTreta . '&message=' . "" . '&timeoutIP=0&timeoutTrack=0');
curl_setopt($chpedi, CURLOPT_HEADER, 0);
curl_setopt($chpedi, CURLOPT_RETURNTRANSFER, true);

$result = curl_exec($chpedi);


//echo json_encode($result);


if (json_encode($result) == '"{\"status\": \"success\"}"') {

    // escrita de strike
    $checkip = mysqli_query($cone, "SELECT ipaddr, attempt, remain FROM sp_queue WHERE ipaddr = '$ipaddr' AND attempt < 4");
    $row = mysqli_fetch_assoc($checkip);
    if ($row['ipaddr'] != $ipaddr) {
        $attempt = 1;
        $remain = 2;

        $strike_stmt = $cone->prepare("INSERT INTO sp_queue ( ipaddr, nick, attempt, remain, music_id, artist, music, message, discord) VALUES (?,?,?,?,?,?,?,?,?)");
        $strike_stmt->bind_param("ssiiissss", $ipaddr, $nickelodeon, $attempt, $remain, $musid, $artisto, $sungname, $recadin, $id);
        $strike_stmt->execute();

        //   mysqli_query($cone, $query) or die(mysqli_error());
    } elseif ($row['ipaddr'] == $ipaddr && $row['remain'] == 2) {
        $norep = mysqli_query($cone, "UPDATE sp_queue SET remain = 1 WHERE ipaddr = '$ipaddr' AND attempt < 4");
        $attempt = 2;
        $remain = 1;

        $strike_stmt = $cone->prepare("INSERT INTO sp_queue ( ipaddr, nick, attempt, remain, music_id, artist, music, message, discord) VALUES (?,?,?,?,?,?,?,?,?)");
        $strike_stmt->bind_param("ssiiissss", $ipaddr, $nickelodeon, $attempt, $remain, $musid, $artisto, $sungname, $recadin, $id);
        $strike_stmt->execute();

        //$query = "INSERT INTO sp_queue ( ipaddr, nick, attempt, remain, music_id, artist, music, message) VALUES('$ipaddr', '$nickelodeon','$attempt', '$remain', '$musid', '$artisto', '$sungname', '$recadin')";
        //mysqli_query($cone, $query) or die(mysqli_error());
    } elseif ($row['ipaddr'] == $ipaddr && $row['remain'] == 1) {
        $norep = mysqli_query($cone, "UPDATE sp_queue SET remain = 0 WHERE ipaddr = '$ipaddr' AND attempt < 4");
        $attempt = 3;
        $remain = 0;

        $strike_stmt = $cone->prepare("INSERT INTO sp_queue ( ipaddr, nick, attempt, remain, music_id, artist, music, message, discord) VALUES (?,?,?,?,?,?,?,?,?)");
        $strike_stmt->bind_param("ssiiissss", $ipaddr, $nickelodeon, $attempt, $remain, $musid, $artisto, $sungname, $recadin, $id);
        $strike_stmt->execute();

        //$query = "INSERT INTO sp_queue ( ipaddr, nick, attempt, remain, music_id, artist, music, message) VALUES('$ipaddr', '$nickelodeon','$attempt', '$remain', '$musid', '$artisto', '$sungname', '$recadin')";
        //mysqli_query($cone, $query) or die(mysqli_error());
    } else {
        die("strike and out");
    }
    ;
    //Fim de escrita


    // Contar o numero de pedidos total (para mostrar no discord)
    $query_count = mysqli_query($cone, "SELECT COUNT(*) FROM sp_queue");
    $result_count = mysqli_fetch_assoc($query_count);
    mysqli_close($cone);

    // hack rápido para remover qualquer link (ou tentativa de link)
// é muito chato, já que impossiblita qualquer emoticon que tenha dois pontos finais
// mas eu acho um preço decente para ninguem estar a spamar meatspin no sistema
    
    $isIos = isset($_GET['ios']) ? $_GET['ios'] : 0;
$emoji = "📱";
if ($isIos) {
    
    $device = "| Enviado do meu iPhone";
    
    $sufixos = [
        " com muito amor ❤️",
        " direto de Akihabara 🗼",
        " no modo otaku 🎌"
    ];
    $device .= $sufixos[array_rand($sufixos)];
} else {
   
    $device = "| Enviado do meu Android-kun";
}

$ftext = [
    "text" => "({$emoji}) Pedido Nº " . $result_count['COUNT(*)'] . " " . $device . " | @" . date('B')
];
    
    
    if (!$vazio) {
        $pat = '/([\w+]+\:\/\/)?([\w\d-]+\.)*[\w-]+[\.\:]\w+([\/\?\=\&\#.]?[\w-]+)*\/?/m';
        $recnourl = preg_replace($pat, 'no links plz', $recado);
        $recadodisc = "$recnourl";
    };
    
    
    $noSeries = false;
    
       // tratar do artista/nome de musica
    if(preg_match('/.+?(?=[|])/i', $songtitle , $matches)){
    $nomart = $matches[0];
    $noSeries = false;
    } else {
    $nomart = $songtitle;
    $noSeries = true;
    }

     $urldiscorde = 'https://discord.com/api/webhooks/1031307011591245835/1UOnVQ2s63ic-qkKQhN7Gts5NmABH3gT0hst8FjCDl4QGj74ycjy9HhneXBpJ5NQJKAy';
    if($vazio){
    if($noSeries){
    $discorde = curl_init($urldiscorde);
    $jsonData = json_encode([
        "username" => "Pedidos da Haru-chan",
        "embeds" => [
            [
                "author" => [
                    "name" => "$nomenick pediu:",
                    "icon_url" => "https://cdn.discordapp.com/avatars/$id/$avatar.webp"
                ], 
                "description" => "",
                "color" => hexdec("37ff1a"),
                "fields" => [
                    [
                        "name" => "Artista/Nome da Música", "value" => "$nomart"
                    ]
                ],
                "thumbnail" => ["url" => "$coverart_link"],
                "footer" => $ftext
            ]
        ]
    ]);
    } else {
        $discorde = curl_init($urldiscorde);
    $jsonData = json_encode([
        "username" => "Pedidos da Haru-chan",
        "embeds" => [
            [
                "author" => [
                    "name" => "$nomenick pediu:",
                    "icon_url" => "https://cdn.discordapp.com/avatars/$id/$avatar.webp"
                ], 
                "description" => "",
                "color" => hexdec("37ff1a"),
                "fields" => [
                    [
                        "name" => "Obra", "value" => $aniname
                    ],
                    [
                        "name" => "Artista/Nome da Música", "value" => "$nomart"
                    ]
                ],
                "thumbnail" => ["url" => "$coverart_link"],
                "footer" => $ftext
            ]
        ]
    ]);
    }
    

    curl_setopt($discorde, CURLOPT_POST, 1);
    curl_setopt($discorde, CURLOPT_POSTFIELDS, $jsonData);
    curl_setopt($discorde, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
    $result = curl_exec($discorde);
        
    } else {
        if($noSeries){
    $discorde = curl_init($urldiscorde);
    
    

    
    
    $jsonData = json_encode([
        "username" => "Pedidos da Haru-chan",
        "embeds" => [
            [
                "author" => [
                    "name" => "$nomenick pediu:",
                    "icon_url" => "https://cdn.discordapp.com/avatars/$id/$avatar.webp"
                ], 
                "description" => "",
                "color" => hexdec("37ff1a"),
                "fields" => [
                    [
                        "name" => "Artista/Nome da Música", "value" => "$nomart"
                    ],
                    [
                        "name" => "Recado", "value" => $recadodisc
                    ]
                ],
                "thumbnail" => ["url" => "$coverart_link"],
                "footer" => ["text" => $ftext]
            ]
        ]
    ]);
            
        } else {
    $discorde = curl_init($urldiscorde);
    $jsonData = json_encode([
        "username" => "Pedidos da Haru-chan",
        "embeds" => [
            [
                "author" => [
                    "name" => "$nomenick pediu:",
                    "icon_url" => "https://cdn.discordapp.com/avatars/$id/$avatar.webp"
                ], 
                "description" => "",
                "color" => hexdec("37ff1a"),
                "fields" => [
                    [
                        "name" => "Obra", "value" => $aniname
                    ],
                    [
                        "name" => "Artista/Nome da Música", "value" => "$nomart"
                    ],
                    [
                        "name" => "Recado", "value" => $recadodisc
                    ]
                ],
                "thumbnail" => ["url" => "$coverart_link"],
                "footer" => $ftext
            ]
        ]
    ]);
            
        }
        

    curl_setopt($discorde, CURLOPT_POST, 1);
    curl_setopt($discorde, CURLOPT_POSTFIELDS, $jsonData);
    curl_setopt($discorde, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
    $result = curl_exec($discorde);
    }
    
    
} else {

    $urlwatchdog = 'https://discord.com/api/webhooks/1031740364933038080/P_75iOlS9PhXH_1c5aPyOXEg4Ao2Dtot9yGyrLSryd9k_tfUuFNvl98O6FDT7i1VLXFz';
    $discordDog = curl_init($urlwatchdog);
    $json2send = json_encode([
        "username" => "Watchdog da Haru-chan",
        "content" => "Deu merda a enviar o pedido para o painel! Erro: `" . json_encode($result) . "`"
    ]);
    curl_setopt($discordDog, CURLOPT_POST, 1);
    curl_setopt($discordDog, CURLOPT_POSTFIELDS, $json2send);
    curl_setopt($discordDog, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
    $resultDog = curl_exec($discordDog);

    die('{"erro":"' . json_encode($result) . '"}');
    
};
} else {
 die('NOLOGIN');
}
?>
