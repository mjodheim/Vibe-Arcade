const btn=document.querySelector('#langBtn');
const translatables=[...document.querySelectorAll('[data-fr][data-en]')];
const key='vibe-arcade.lang';
function apply(lang){
  document.documentElement.lang=lang;
  translatables.forEach(el=>el.textContent=el.dataset[lang]);
  btn.textContent=lang==='fr'?'EN':'FR';
  localStorage.setItem(key,lang);
}
btn?.addEventListener('click',()=>apply(document.documentElement.lang==='fr'?'en':'fr'));
apply(localStorage.getItem(key)==='en'?'en':'fr');
