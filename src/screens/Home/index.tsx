import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Platform, Text, View } from "react-native";

import { styles } from "./styles";
import { Background } from "../../components/Background";
import { AnimuInfoProps } from "../../api";

import { HeaderBar } from "../../components/HeaderBar";
import { Loading } from "../Loading";
import { Logo } from "../../components/Logo";
import { Listeners } from "../../components/Listeners";
import { Cover } from "../../components/Cover";
import { Live } from "../../components/Live";
import { Program } from "../../components/Program";
import { CountdownTimerText } from "../../components/CountdownTimerText";
import { ChooseBitrateSection } from "../../components/ChooseBitrateSection";
import { myPlayer } from "../../utils";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from 'react-native-webview';

const default_cover =
  "https://cdn.discordapp.com/attachments/634406949198364702/1093233650025377892/Animu-3-anos-nova-logo.png";

export function Home() {
  const [animuInfo, setAnimuInfo] = useState<AnimuInfoProps | null>(null);
  const [cover, setCover] = useState<string>(default_cover);
  const isFirstRun = useRef(true);
  const player = useRef(myPlayer());
  let auxData;

  useEffect(() => {
    setInterval(() => {
      function isUrlAnImage(url: string) {
        return url.match(/\.(jpeg|jpg|gif|png)$/) != null;
      }
      async function getAnimuInfo() {
        auxData = await player.current.getCurrentMusic();
        if (auxData.track != animuInfo?.track) {
          setAnimuInfo(auxData);
        }
        const cover =
          auxData.track.artworks.large ||
          auxData.track.artworks.medium ||
          auxData.track.artworks.tiny ||
          default_cover;
        if (isUrlAnImage(cover)) {
          setCover(cover);
        } else {
          setCover(default_cover);
        }
      }
      getAnimuInfo();
    }, 1000);
/*
    if (isFirstRun.current) {
      player.current.play();
      isFirstRun.current = false;
    }
*/
  }, []);

  const htmlContent = `
        <canvas id="oscilloscope"></canvas>
        <script>
            function setupVisualfluff(x) {
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

            function startplayer() {
                window.audioContext = new (window.AudioContext || window.webkitAudioContext);
                document.addEventListener('touchend', ()=>window.audioContext.resume());
                window.audioContext.resume();
                window.masterGain = audioContext.createGain();
                window.masterGain.connect(audioContext.destination);
                if(!window.hasOsci){
                    setupVisualfluff();
                } else {
                    console.log("wario land 4, play it.");
                }
                const url = "https://cast.animu.com.br:9079/stream";
                song = new Audio(url);
                var songSource = audioContext.createMediaElementSource(song);
                song.crossOrigin = "anonymous";
                songSource.connect(masterGain);
                song.preload = "none";
                var gainfrac = 0.5;
                if (window.masterGain) window.masterGain.gain.value = gainfrac * gainfrac;
                window.song_result = song.play();
                window.songPlaying = true;
            }
        </script>
        <button id="teste" onclick="startplayer()">Play</button>
`;

  return (
    <Background>
      {animuInfo ? (
        <SafeAreaView style={styles.container}>
          <HeaderBar player={player.current} />
          <View style={styles.containerApp}>
                <View
                style={{
                    flex: 1,
                    height: 400,
                    position: 'absolute',
                    top: 0,
                    width: '100%',
                }}
                >
         <WebView
            source={{ html: htmlContent }}
            javaScriptEnabled={true}
            style={{ resizeMode: 'cover', flex: 1, backgroundColor: 'transparent' }}
            injectedJavaScript={`const meta = document.createElement('meta'); meta.setAttribute('content', 'width=width, initial-scale=0.5, maximum-scale=0.5, user-scalable=2.0'); meta.setAttribute('name', 'viewport'); document.getElementsByTagName('head')[0].appendChild(meta); `}
            scalesPageToFit={Platform.OS === 'ios'}
          />
                </View>
            <Logo size={127} />
            <Listeners info={animuInfo} />
            <Cover cover={cover} />
            {!animuInfo.track.isLiveProgram && (
              <Text style={styles.timeLeft}>
                Tempo restante:{" "}
                <CountdownTimerText
                  startTime={
                    animuInfo.track.duration -
                    (Date.now() - animuInfo.track.timestart)
                  }
                />
              </Text>
            )}
            <Live track={animuInfo.track} />
            <Program info={animuInfo} />
            <ChooseBitrateSection player={player.current} />
          </View>
        </SafeAreaView>
      ) : (
        <Loading />
      )}
    </Background>
  );
}
