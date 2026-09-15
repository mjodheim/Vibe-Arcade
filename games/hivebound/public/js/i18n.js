// Language wiring: French is the default and English is the alternate. The
// translations themselves live in ./i18n/fr.js.
import { translateText } from './i18n/fr.js';

const STORAGE_KEY='vibe-arcade.lang';
const sourceText=new WeakMap();
let applying=false;

function currentLang(){return localStorage.getItem(STORAGE_KEY)==='en'?'en':'fr'}

function applyStatic(lang){
  document.querySelectorAll('[data-fr][data-en]').forEach(el=>{
    const next=el.dataset[lang];
    if(next!==undefined&&el.textContent!==next){applying=true;el.textContent=next;applying=false}
  });
}

function rememberAndTranslateText(node){
  if(node.nodeType!==Node.TEXT_NODE)return;
  if(!sourceText.has(node))sourceText.set(node,node.nodeValue);
  const source=sourceText.get(node);
  const next=currentLang()==='fr'?translateText(source):source;
  if(node.nodeValue!==next){applying=true;node.nodeValue=next;applying=false}
}

function translateDynamic(node){
  if(node.nodeType===Node.TEXT_NODE){rememberAndTranslateText(node);return}
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  if(node.matches?.('[data-fr][data-en]'))return;
  [...node.childNodes].forEach(child=>translateDynamic(child));
  for(const attr of ['placeholder','title','aria-label']){
    if(!node.hasAttribute?.(attr))continue;
    const key=`attr:${attr}`;
    let bag=sourceText.get(node);
    if(!bag||typeof bag!=='object')bag={};
    if(!(key in bag))bag[key]=node.getAttribute(attr);
    sourceText.set(node,bag);
    const source=bag[key];
    const next=currentLang()==='fr'?translateText(source):source;
    if(node.getAttribute(attr)!==next){applying=true;node.setAttribute(attr,next);applying=false}
  }
}

function apply(){
  const lang=currentLang();
  document.documentElement.lang=lang;
  document.title=lang==='fr'?'Hivebound — Reliques de la Bloom':'Hivebound — Relics of the Bloom';
  applyStatic(lang);
  translateDynamic(document.body);
  const btn=document.querySelector('#langBtn');if(btn)btn.textContent=lang==='fr'?'EN':'FR';
  // Text drawn outside the DOM (the gate signposts) redraws itself on this.
  dispatchEvent(new CustomEvent('hivebound:language',{detail:{lang}}));
}

// Text drawn outside the DOM (canvas signposts) asks for its translation here.
export function currentLanguage(){return currentLang()}

export function translate(text){return currentLang()==='fr'?translateText(text):text}

export function toggleLanguage(){localStorage.setItem(STORAGE_KEY,currentLang()==='fr'?'en':'fr');apply()}
export function refreshLanguage(){apply()}

const observer=new MutationObserver(records=>{
  if(applying)return;
  for(const record of records){
    if(record.type==='childList')record.addedNodes.forEach(node=>translateDynamic(node));
    else if(record.type==='characterData')rememberAndTranslateText(record.target);
  }
});

function boot(){
  apply();
  document.querySelector('#langBtn')?.addEventListener('click',toggleLanguage);
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
}

if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
