import { useEffect, useState } from "react";

const HAZARD_BLINK_MS = 450;

/**
 * One shared on/off phase for hazard mode so left and right lamps stay visually in lockstep.
 */
export function useSyncedHazardPhase(hazardsOn: boolean): boolean {
  const [phase, setPhase] = useState(false);

  useEffect(() => {
    if (!hazardsOn) {
      setPhase(false);
      return;
    }
    const tick = () => {
      setPhase(Math.floor(performance.now() / HAZARD_BLINK_MS) % 2 === 0);
    };
    tick();
    const id = setInterval(tick, 40);
    return () => clearInterval(id);
  }, [hazardsOn]);

  return hazardsOn ? phase : false;
}
