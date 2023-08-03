import { Dimensions, Platform, View } from "react-native";
import { styles } from "./styles";
import WebView from "react-native-webview";
import { LegacyRef, useEffect, useState } from "react";
import { MyPlayerProps } from "../../utils";
import { AppState } from "react-native";

interface Props {
  webViewRef: any;
  player: MyPlayerProps;
}

export function Oscilloscope({ webViewRef, player }: Props) {
  const [appState, setAppState] = useState(AppState.currentState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      setAppState(nextAppState);
    };

    AppState.addEventListener("change", handleAppStateChange);
  }, []);

  const htmlContent = `
         <style>
            html, body, div, canvas {
                margin: 0;
                padding: 0;
            }
         </style>
         <canvas id="oscilloscope"></canvas>
         <script> function setupVisualfluff(x) {

                const analyser = audioContext.createAnalyser();
                masterGain.connect(analyser);

                const waveform = new Float32Array(analyser.frequencyBinCount);
                analyser.getFloatTimeDomainData(waveform);

                function updateWaveForm() {
                    requestAnimationFrame(updateWaveForm);
                    analyser.getFloatTimeDomainData(waveform);
                }

                function drawOscilloscope() {
                    requestAnimationFrame(drawOscilloscope);

                    const scopeCanvas = document.getElementById("oscilloscope");
                    const scopeContext = scopeCanvas.getContext("2d", { alpha: true });

                    scopeCanvas.width = ${Dimensions.get("window").width};
                    scopeCanvas.height = 75;

                    scopeContext.clearRect(0, 0, scopeCanvas.width, scopeCanvas.height);
                    scopeContext.beginPath();

                    for (let i = 0; i < waveform.length; i++) {
                        const x = i * (scopeCanvas.width / 1000);
                        const y = (0.5 + waveform[i] / 2) * scopeCanvas.height;

                        if (i == 0) {
                            scopeContext.moveTo(x, y);
                        } else {
                            scopeContext.lineTo(x, y);
                        }
                    }

                    scopeContext.strokeStyle = "#723eb2";
                    scopeContext.lineWidth = 3;
                    scopeContext.stroke();
                }

                if (x == "hide") {
                    console.log("hidden");
                    const scopeCanvas = document.getElementById("oscilloscope");
                    scopeCanvas.width = 0;
                    scopeCanvas.height = 0;
                    return;
                } else {
                    drawOscilloscope();
                    updateWaveForm();
                    window.hasOsci = true;
                }
            }

            function stfuplayer() {
  window.songPlaying = false;
  song.pause();
  const scopeCanvas = document.getElementById("oscilloscope");
  const scopeContext = scopeCanvas.getContext("2d", { alpha: true });
  scopeContext.clearRect(0, 0, scopeCanvas.width, scopeCanvas.height);
  window.hasOsci = false;
  window.audioContext.close();
  song = new Audio();
  song.src = "";
}

            function startplayer() {
                window.songPlaying = false;
                try {
                    song.pause();
                    window.audioContext.close();
                } catch (e) {
                    console.log(e);
                }
                song = new Audio();
                song.src = '';

                window.audioContext = new (window.AudioContext || window.webkitAudioContext);
                document.addEventListener('touchend', ()=>window.audioContext.resume());
                window.audioContext.resume();

  // Instead of connecting to audioContext.destination, create a dummy gain node as a destination.
    window.dummyGain = audioContext.createGain();
    window.dummyGain.gain.value = 0; // Set gain to 0 to mute the dummy destination.
    window.dummyGain.connect(audioContext.destination);

    // Create masterGain as before (you can set it to a non-zero value if you want audio later).
    window.masterGain = audioContext.createGain();
    window.masterGain.connect(dummyGain);



                if(!window.hasOsci){
                    setupVisualfluff();
                } else {
                    console.log("wario land 4, play it.");
                }
                url = '${
                  player.CONFIG.BITRATES[
                    player.currentBitrate || player.CONFIG.DEFAULT_BITRATE
                  ].url
                }';
                song = document.createElement('audio');
                songSource = audioContext.createMediaElementSource(song);
                song.crossOrigin = "anonymous";
                song.src = url;
                songSource.connect(masterGain);
                song.preload = "none";
                var gainfrac = 1;
                if (window.masterGain) window.masterGain.gain.value = gainfrac;
                window.song_result = song.play();
                window.songPlaying = true;
            }
        </script>
`;

  const debugging = `
      const consoleLog = (type, log) => window.ReactNativeWebView.postMessage(JSON.stringify({'type': 'Console', 'data': {'type': type, 'log': log}}));
      console = {
          log: (log) => consoleLog('log', log),
          debug: (log) => consoleLog('debug', log),
          info: (log) => consoleLog('info', log),
          warn: (log) => consoleLog('warn', log),
          error: (log) => consoleLog('error', log),
        };
    `;

  const onMessage = (payload: any) => {
    let dataPayload;
    try {
      dataPayload = JSON.parse(payload.nativeEvent.data);
    } catch (e) {}

    if (dataPayload) {
      if (dataPayload.type === "Console") {
        console.info(`[Console] ${JSON.stringify(dataPayload.data)}`);
      } else {
        console.log(dataPayload);
      }
    }
  };

  return player._loaded &&
    player._oscilloscopeEnabled &&
    !player._paused &&
    appState != "background" ? (
    <View style={styles.container}>
      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          javaScriptEnabled={true}
          style={{ backgroundColor: "transparent" }}
          injectedJavaScript={`${debugging} const meta = document.createElement('meta'); meta.setAttribute('content', 'width=width, initial-scale=0.5, maximum-scale=0.5, user-scalable=2.0'); meta.setAttribute('name', 'viewport'); document.getElementsByTagName('head')[0].appendChild(meta); `}
          scalesPageToFit={Platform.OS === "ios"}
          mediaCapturePermissionGrantType={"grant"}
          useWebView2
          javaScriptCanOpenWindowsAutomatically
          mediaPlaybackRequiresUserAction={false}
          domStorageEnabled
          allowsInlineMediaPlayback
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          onMessage={onMessage}
          onLoad={() => {
            if (!loaded) {
              setLoaded(true);
            } else {
              webViewRef.current.injectJavaScript(`stfuplayer()`);
            }
            webViewRef.current.injectJavaScript(`startplayer()`);
          }}
        />
      </View>
    </View>
  ) : (
    <></>
  );
}
