'use strict';

// Events-only mode: incidents must happen in the playfield, not as fake UI/messages.
(() => {
  // Remove incidents whose entire identity is an overlay/message rather than a physical event.
  for (let i = EVENT_POOL.length - 1; i >= 0; i--) {
    if (EVENT_POOL[i].id === 'ad' || EVENT_POOL[i].id === 'bsod') EVENT_POOL.splice(i, 1);
  }
  if (Array.isArray(SIDE_EVENTS)) {
    for (let i = SIDE_EVENTS.length - 1; i >= 0; i--) {
      if (SIDE_EVENTS[i] === 'ad' || SIDE_EVENTS[i] === 'bsod') SIDE_EVENTS.splice(i, 1);
    }
  }

  // No textual incident banners. The animation, audio and board mutation are the announcement.
  showBanner = function(){
    clearTimeout(state.bannerTimer);
    banner.classList.remove('show');
  };

  // Belt-and-suspenders: even a stale/manual call cannot resurrect fake UI.
  showAd = function(){ hideAd(); };
  showCrash = function(){ hideCrash(); };

  // Defensive cleanup in case a stale state survived hot reload/dev tooling.
  hideAd();
  hideCrash();
  if (state.side?.id === 'ad' || state.side?.id === 'bsod') state.side = null;
  if (state.activeEvent?.id === 'ad' || state.activeEvent?.id === 'bsod') {
    state.activeEvent = null;
    state.eventUntil = 0;
  }
})();
