import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "vitest";

// Runs in order: the second test sees what the first one wrote, unless the
// shared setup empties the default store between tests.
describe("the shared test setup", () => {
  it("lets a test write to the default AsyncStorage", async () => {
    await AsyncStorage.setItem("key", "value");
    expect(await AsyncStorage.getItem("key")).toBe("value");
  });

  it("starts every test with it empty", async () => {
    expect(await AsyncStorage.getItem("key")).toBeNull();
  });
});
