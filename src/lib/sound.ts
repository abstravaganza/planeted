export function playCue(enabled: boolean, kind: "pop" | "success" = "pop") {
  if (!enabled) return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.frequency.setValueAtTime(
      kind === "pop" ? 520 : 660,
      context.currentTime,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      kind === "pop" ? 280 : 990,
      context.currentTime + 0.14,
    );
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    oscillator.onended = () => void context.close();
  } catch {
    /* Optional sound never blocks learning. */
  }
}
