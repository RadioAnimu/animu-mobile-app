import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Components
import { Background } from "../../components/Background";
import { ChooseBitrateSection } from "../../components/ChooseBitrateSection";
import { TrackCover } from "../../components/TrackCover";
import { HeaderBar } from "../../components/HeaderBar";
import { Listeners } from "../../components/Listeners";
import { Live } from "../../components/Live";
import { LiveRequestModal } from "../../components/LiveRequestModal";
import { Logo } from "../../components/Logo";
import { PopUpProgram } from "../../components/PopUpProgram";
import { Program } from "../../components/Program";
import { TimeRemaining } from "../../components/TimeRemaining";

// Routes
import { RootStackParamList } from "../../routes/app.routes";

// Styles
import { styles } from "./styles";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export const Home = ({ navigation }: Props) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLiveRequestModalVisible, setIsLiveRequestModalVisible] =
    useState(false);

  // UI Handlers
  const handleOpenProgramModal = useCallback(() => {
    setIsModalVisible(true);
  }, []);

  const handleCloseProgramModal = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  const handleLiveRequestModal = useCallback((state: boolean) => {
    setIsLiveRequestModalVisible(state);
  }, []);

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <ScrollView>
          <HeaderBar
            openLiveRequestModal={() => handleLiveRequestModal(true)}
            navigation={navigation}
          />

          <View style={styles.containerApp}>
            <Logo size={127} />

            <View style={styles.listenersWrapper}>
              <Listeners />
            </View>

            <View style={styles.coverWrapper}>
              <TrackCover />
            </View>

            <View style={styles.timeRemainingWrapper}>
              <TimeRemaining />
            </View>

            <View style={styles.liveWrapper}>
              <Live />
            </View>

            <View style={styles.programWrapper}>
              <Program handleClick={handleOpenProgramModal} />
            </View>

            <ChooseBitrateSection />
          </View>
        </ScrollView>

        <LiveRequestModal
          visible={isLiveRequestModalVisible}
          handleClose={() => handleLiveRequestModal(false)}
        />

        <PopUpProgram
          visible={isModalVisible}
          handleClose={handleCloseProgramModal}
        />
      </SafeAreaView>
    </Background>
  );
};
