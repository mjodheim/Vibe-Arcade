const btn=document.querySelector('#langBtn');
const translatables=[...document.querySelectorAll('[data-fr][data-en]')];
const key='vibe-arcade.lang';
const metaDescription=document.querySelector('meta[name="description"]');
const metadata={
  fr:{
    title:'Vibe Arcade — Les idées deviennent jouables',
    description:"Vibe Arcade — des idées qui deviennent des jeux jouables grâce au vibe coding, au playtest et à l’itération."
  },
  en:{
    title:'Vibe Arcade — Ideas become playable',
    description:'Vibe Arcade — ideas turned into playable games through vibe coding, playtesting and iteration.'
  }
};
function apply(lang){
  document.documentElement.lang=lang;
  translatables.forEach(el=>el.textContent=el.dataset[lang]);
  btn.textContent=lang==='fr'?'EN':'FR';
  document.title=metadata[lang].title;
  metaDescription?.setAttribute('content',metadata[lang].description);
  localStorage.setItem(key,lang);
}
btn?.addEventListener('click',()=>apply(document.documentElement.lang==='fr'?'en':'fr'));
apply(localStorage.getItem(key)==='en'?'en':'fr');
