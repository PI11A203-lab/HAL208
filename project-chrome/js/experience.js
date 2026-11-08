export const PHASES = Object.freeze({
  SELECT: "select",
  EQUIPPING: "equipping",
  ACTION: "action",
});

export const EVENTS = Object.freeze({
  SELECT: "SELECT",
  APPLY: "APPLY",
  EQUIP_READY: "EQUIP_READY",
  EQUIP_FAILED: "EQUIP_FAILED",
  FINISH_EQUIP: "FINISH_EQUIP",
  BACK: "BACK",
  RESET: "RESET",
});

const DEFAULT_ID = "mk1";

export function createExperience() {
  return {
    phase: PHASES.SELECT,
    selectedId: DEFAULT_ID,
    appliedId: null,
    requestId: 0,
    startedAt: null,
    muted: false,
  };
}

export function reduceExperience(state, event) {
  switch (event.type) {
    case EVENTS.SELECT: {
      if (state.phase !== PHASES.SELECT) return state;
      if (typeof event.id !== "string" || event.id === "") return state;
      return { ...state, selectedId: event.id };
    }

    case EVENTS.APPLY: {
      if (state.phase !== PHASES.SELECT) return state;
      return {
        ...state,
        phase: PHASES.EQUIPPING,
        appliedId: state.selectedId,
        requestId: state.requestId + 1,
        startedAt: event.now ?? null,
      };
    }

    case EVENTS.EQUIP_READY: {
      if (state.phase !== PHASES.EQUIPPING) return state;
      if (event.requestId !== state.requestId) return state;
      return state;
    }

    case EVENTS.EQUIP_FAILED: {
      if (state.phase !== PHASES.EQUIPPING) return state;
      if (event.requestId !== state.requestId) return state;
      return { ...state, phase: PHASES.SELECT, appliedId: null, startedAt: null };
    }

    case EVENTS.FINISH_EQUIP: {
      if (state.phase !== PHASES.EQUIPPING) return state;
      if (event.requestId !== state.requestId) return state;
      return { ...state, phase: PHASES.ACTION, startedAt: null };
    }

    case EVENTS.BACK: {
      if (state.phase !== PHASES.ACTION) return state;
      return { ...state, phase: PHASES.SELECT, appliedId: null };
    }

    case EVENTS.RESET: {
      return { ...createExperience(), muted: state.muted, requestId: state.requestId };
    }

    default:
      return state;
  }
}
