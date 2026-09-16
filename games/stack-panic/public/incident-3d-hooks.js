import '/stack-panic/incident-3d.js';

const cabinet=document.getElementById('cabinet');

function mark3D(on){cabinet?.classList.toggle('incident-3d-live',!!on);}

const baseSheep=window.spawnSheep;
if(typeof baseSheep==='function'){
  window.spawnSheep=function(){
    baseSheep();
    const ok=window.Incident3D?.startSheep?.();
    mark3D(ok);
  };
}

const baseTank=window.spawnTank;
if(typeof baseTank==='function'){
  window.spawnTank=function(){
    baseTank();
    const ok=window.Incident3D?.startTank?.();
    mark3D(ok);
  };
}

const baseEndEvent=window.endEvent;
if(typeof baseEndEvent==='function'){
  window.endEvent=function(){
    const id=state.activeEvent?.id;
    baseEndEvent();
    if(id==='sheep'||id==='tank'){window.Incident3D?.stop?.(id);mark3D(false);}
  };
}

const baseEndSide=window.endSideEvent;
if(typeof baseEndSide==='function'){
  window.endSideEvent=function(){
    const id=state.side?.id;
    baseEndSide();
    if(id==='sheep'){window.Incident3D?.stop?.('sheep');mark3D(false);}
  };
}

const baseReset=window.resetGame;
if(typeof baseReset==='function'){
  window.resetGame=function(daily=false){window.Incident3D?.stop?.();mark3D(false);baseReset(daily);};
}

const baseGameOver=window.endGame;
if(typeof baseGameOver==='function'){
  window.endGame=function(){window.Incident3D?.stop?.();mark3D(false);baseGameOver();};
}
