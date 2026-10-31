import { useEffect, useRef } from "react";
import { useUIStore } from "@/store/useUIStore";
import { startGamepadLoop, getConnectedPads, detectControllerKind } from "@/lib/gamepad";
import { BP_AUTOSTART_KEY } from "./BigPicture";

export default function GamepadLauncher() {
  const bigPicture = useUIStore((s) => s.bigPicture);
  const setBigPicture = useUIStore((s) => s.setBigPicture);
  const announced = useRef(false);
  const autostarted = useRef(false);

  useEffect(() => {
    if (autostarted.current) return;
    autostarted.current = true;
    try {
      if (localStorage.getItem(BP_AUTOSTART_KEY) === "1") setBigPicture(true);
    } catch {}
  }, [setBigPicture]);

  useEffect(() => {
    if (bigPicture) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setBigPicture(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bigPicture, setBigPicture]);

  useEffect(() => {
    const onConnect = (e: GamepadEvent) => {
      if (announced.current || useUIStore.getState().bigPicture) return;
      announced.current = true;
      const kind = detectControllerKind(e.gamepad.id);
      const label = kind === "playstation" ? "PlayStation controller" : kind === "xbox" ? "Xbox controller" : "Controller";
      const btn = kind === "playstation" ? "OPTIONS" : "Start";
      useUIStore.getState().addToast(`${label} connected — press ${btn} for Big Picture mode`, "info");
    };
    window.addEventListener("gamepadconnected", onConnect);
    return () => window.removeEventListener("gamepadconnected", onConnect);
  }, []);

  useEffect(() => {
    if (bigPicture) return;
    let stop: (() => void) | null = null;
    const begin = () => {
      if (stop) return;
      stop = startGamepadLoop((action) => {
        if (action === "start" && !useUIStore.getState().bigPicture) setBigPicture(true);
      });
    };
    if (getConnectedPads().length) begin();
    window.addEventListener("gamepadconnected", begin);
    return () => {
      window.removeEventListener("gamepadconnected", begin);
      stop?.();
    };
  }, [bigPicture, setBigPicture]);

  return null;
}
