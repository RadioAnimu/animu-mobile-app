import XCTest

final class ReleaseSmokeUITests: XCTestCase {
  @MainActor
  func testLaunchAndAssistantPlay() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.nessjs.animu")
    app.launch()
    let play = app.buttons.matching(NSPredicate(format: "label IN %@", ["Reproduzir", "Play"])).firstMatch
    XCTAssertTrue(play.waitForExistence(timeout: 30), "Release player did not render")

    app.open(URL(string: "animuapp://assistant/play")!)
    let system = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let confirmation = system.buttons["Open"]
    if confirmation.waitForExistence(timeout: 3) {
      confirmation.tap()
    }

    let pause = app.buttons.matching(NSPredicate(format: "label IN %@", ["Pausar", "Pause"])).firstMatch
    XCTAssertTrue(pause.waitForExistence(timeout: 30), "Assistant URL did not start the play intent")
    XCTAssertEqual(app.state, .runningForeground)
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.lifetime = .keepAlways
    add(screenshot)
  }
}
