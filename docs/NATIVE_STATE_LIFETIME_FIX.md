# Android Fabric state lifetime fix

The signed Release app crashed during the tablet-size/density lifecycle audit:
`StateWrapperImpl.getStateDataReferenceImpl` threw a native
`NullPointerException` while `ReactTextViewManager.updateState` read text state.

React Native 0.86.3's `SurfaceMountingManager.stopSurface` can destroy state
wrappers from any thread. Its UI-thread readers check `isValid` before JNI
access, but another thread can reset the hybrid between that check and the
native call. The wrapper source itself documents the teardown race.

The pinned React Native patch places its three state getters, `updateState`,
`destroyState` and `toString` under the same instance monitor. Existing
already-destroyed handling remains intact; exceptions are not caught or hidden.
Construction publishes the wrapper only after native state initialization.

Android enables Expo's `buildReactNativeFromSource` so the patched Kotlin class
reaches the application. Patching npm sources while consuming the Maven AAR
would leave the crash unchanged. This increases native build time. iOS keeps
its existing precompiled framework configuration.

The release pipeline inspects the compiled Release class with `javap` and fails
if any state-lifetime entry point lacks its monitor or source-built output is
absent. Regression fixtures prove that unpatched bytecode and absent output
fail this gate. Signed-device lifecycle stress remains required after building.

Reassess this patch and source-build setting when adopting a compatible upstream
fix. See the [upstream wrapper](https://github.com/react/react-native/blob/v0.86.3/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/fabric/StateWrapperImpl.kt)
and [source-build documentation](https://reactnative.dev/contributing/how-to-build-from-source).
