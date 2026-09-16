(() => {
  const synth=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));
  document.addEventListener('keydown',e=>{
    if(!e.isTrusted)return;
    if(e.code==='KeyQ'){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      synth('keydown','KeyA');
    } else if(e.code==='KeyR'){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      synth('keydown','KeyQ');synth('keyup','KeyQ');
    }
  },true);
  document.addEventListener('keyup',e=>{
    if(!e.isTrusted||e.code!=='KeyQ')return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();synth('keyup','KeyA');
  },true);
  addEventListener('DOMContentLoaded',()=>{
    const slots=[...document.querySelectorAll('.slot')],potion=slots[4];
    if(potion){potion.querySelector('small').textContent='R';potion.onclick=e=>{e.preventDefault();synth('keydown','KeyQ');synth('keyup','KeyQ');};}
    const hint=document.querySelector('.hint');if(hint)hint.innerHTML=hint.innerHTML.replace('<strong>Q</strong> potion','<strong>R</strong> potion');
    const inv=document.getElementById('inventoryPanel');if(inv)new MutationObserver(()=>{for(const el of inv.querySelectorAll('small'))el.textContent=el.textContent.replace('Press Q','Press R')}).observe(inv,{subtree:true,childList:true,characterData:true});
  });
})();
