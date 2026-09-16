'use strict';

// Deep-playtest fixes that need to wrap the final gameplay hooks.
(() => {
  const cabinet = document.getElementById('cabinet');

  // The runtime shifts its original timers, but later systems added their own
  // absolute timestamps. Keep those frozen too so pause cannot be used to burn
  // through a sabotage pulse or the REALITY FAIL cooldown.
  const baseTogglePause = togglePause;
  togglePause = function(){
    const wasPaused = state.paused;
    const pausedAt = state.pauseStartedAt || 0;
    baseTogglePause();
    if (wasPaused === state.paused) return; // e.g. REALITY FAIL is not manually pausable

    if (state.paused) {
      cabinet?.getAnimations?.({subtree:true}).forEach(animation => {
        try { animation.pause(); } catch { /* cosmetic animation only */ }
      });
      return;
    }

    const delta = Math.max(0, performance.now() - pausedAt);
    if (state.shuffleEvent?.next) state.shuffleEvent.next += delta;
    if (state.nextRealityFailAt) state.nextRealityFailAt += delta;
    cabinet?.getAnimations?.({subtree:true}).forEach(animation => {
      try { animation.play(); } catch { /* cosmetic animation only */ }
    });
  };

  // OS key-repeat is useful for horizontal movement and soft drop, but it must
  // not machine-gun hard drops, rotations or pause toggles.
  document.addEventListener('keydown', event => {
    if (!event.repeat) return;
    if (['p','P','Escape',' ','ArrowUp','x','X'].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();
