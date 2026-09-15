const btn=document.querySelector('#langBtn');
const translatables=[...document.querySelectorAll('[data-fr][data-en]')];
const key='vibe-arcade.lang';
const metadata={
  fr:{
    title:'Vibe Arcade — Choisis un jeu',
    description:'Vibe Arcade — une collection de jeux gratuits à lancer directement dans le navigateur.',
    social:'Des jeux à lancer directement dans ton navigateur. Pas de téléchargement : choisis une borne et joue.',
    locale:'fr_FR',
    alternate:'en_US'
  },
  en:{
    title:'Vibe Arcade — Pick a game',
    description:'Vibe Arcade — a collection of free games you can play directly in your browser.',
    social:'Games you can launch straight from your browser. No downloads: pick a cabinet and play.',
    locale:'en_US',
    alternate:'fr_FR'
  }
};
// The whole site lives on one URL and switches language in the browser, so the
// canonical link never moves — only what a shared link says about itself does.
function meta(selector,value){
  const el=document.querySelector(selector);
  if(el&&value!=null) el.setAttribute('content',value);
}
function apply(lang){
  const copy=metadata[lang];
  document.documentElement.lang=lang;
  translatables.forEach(el=>el.textContent=el.dataset[lang]);
  btn.textContent=lang==='fr'?'EN':'FR';
  document.title=copy.title;
  meta('meta[name="description"]',copy.description);
  meta('meta[property="og:title"]',copy.title);
  meta('meta[property="og:description"]',copy.social);
  meta('meta[property="og:locale"]',copy.locale);
  meta('meta[property="og:locale:alternate"]',copy.alternate);
  meta('meta[name="twitter:title"]',copy.title);
  meta('meta[name="twitter:description"]',copy.social);
  localStorage.setItem(key,lang);
}
btn?.addEventListener('click',()=>apply(document.documentElement.lang==='fr'?'en':'fr'));
apply(localStorage.getItem(key)==='en'?'en':'fr');
