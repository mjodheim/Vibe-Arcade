const btn=document.querySelector('#langBtn');
const translatables=[...document.querySelectorAll('[data-fr][data-en]')];
const key='vibe-arcade.lang';
const metaDescription=document.querySelector('meta[name="description"]');
const metadata={
  fr:{
    title:'Vibe Arcade — Choisis un jeu',
    description:'Vibe Arcade — une collection de jeux gratuits à lancer directement dans le navigateur.'
  },
  en:{
    title:'Vibe Arcade — Pick a game',
    description:'Vibe Arcade — a collection of free games you can play directly in your browser.'
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
