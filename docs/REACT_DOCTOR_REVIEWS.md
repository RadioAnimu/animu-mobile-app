# React Doctor diagnostic review — 14 October 2026

React Doctor 0.9.18 reports two `rn-pressable-shared-value-mutation` warnings
in the lyrics pronunciation button. The scan remains complete, with its
original **97 score and two warnings**. The controls and animation are unchanged.

The diagnostic claims that `press.set(withSpring(...))` animates on the JS
thread. The installed Reanimated 4.5.1 source shows a different execution path:
`addCompilerSafeGetAndSet` writes through the native mutable, whose setter
schedules UI work; `valueSetter` executes the spring and its frame callback as
a worklet. JS initiates the animation asynchronously. This is supported by the
[shared-value documentation](https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue/).

Press-feedback latency under JS load remains a performance hypothesis, not a
measured production defect. The detector's
[canonical review guidance](https://www.react.doctor/prompts/rules/react-doctor/rn-pressable-shared-value-mutation.md)
requires release-build latency evidence before replacing an accessible Pressable.
No latency improvement or iOS runtime verification is claimed by this review.

The gate retains and prints both findings. A review applies only to their exact
diagnostic IDs, the SHA-256 of the inspected source file, scanner 0.9.18, and
Reanimated 4.5.1. A changed source file, scanner, native animation version, severity,
or occurrence invalidates the review and fails CI. Other findings, incomplete
scans, and skipped checks still fail. The complete report is archived for review.

Reassess after a relevant tool/source change or measured press-feedback issue.
Device checks must still cover opening/closing, selection, cancellation,
accessibility state, and reduced motion; this source review does not replace them.
