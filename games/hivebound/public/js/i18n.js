const STORAGE_KEY='vibe-arcade.lang';
const sourceText=new WeakMap();
let applying=false;

const fr={
  'Move forward':'Avancer','Move back':'Reculer','Strafe left':'Pas à gauche','Strafe right':'Pas à droite','Dash':'Esquive','Interact':'Interagir',
  'Click a binding, then press the key you want. Escape cancels. Move with the keyboard, aim with the mouse, hold left click to attack, right-drag to turn the camera.':'Clique sur une commande puis appuie sur la touche voulue. Échap annule. Tu voles au clavier, tu vises à la souris, tu attaques en maintenant le clic gauche, et tu tournes la caméra avec le clic droit.',
  'Explore the glade':'Explorer la clairière','Take a gate onward':'Franchis une porte','Defeat the Guardian':'Vaincre le Gardien',
  'The way onward is open.':'La voie est ouverte.','The Guardian falls. The way opens.':'Le Gardien tombe. La voie s’ouvre.',
  'A hidden comb, forgotten by everyone.':'Un rayon caché, oublié de tous.','The Guardian of the region awakens.':'Le Gardien de la région s’éveille.',
  'The Guardian calls the swarm.':'Le Gardien appelle l’essaim.','Echo Resonance: your ability reverberates.':'Résonance d’Écho : ta compétence se répercute.',
  'A Hidden Comb':'Un rayon caché','Nobody was meant to find this one.':'Personne n’était censé trouver celui-ci.',
  'Deeper Bloom':'Bloom plus profonde','Leave this region behind. The next one is worse.':'Quitte cette région. La suivante est pire.','REGION · new biome':'RÉGION · nouveau biome',
  'Gloam Mite':'Mite du Gloam','Petal Husk':'Carcasse de pétale','Spore Spitter':'Cracheur de spores','Thorn Stalker':'Traqueur d’épines','Region Guardian':'Gardien de région',
  'Sunlight still reaches the clover here. It will not last.':'La lumière atteint encore le trèfle ici. Ça ne durera pas.',
  'The spores remember every bee that breathed them in.':'Les spores se souviennent de chaque abeille qui les a respirées.',
  'Something burned the blossom. The orchard kept standing anyway.':'Quelque chose a brûlé la floraison. Le verger est resté debout quand même.',
  'Still water, and something patient underneath it.':'Une eau immobile, et quelque chose de patient en dessous.',
  'The old hive of the Queen. Gold, and nobody left to wear it.':'L’ancienne ruche de la Reine. De l’or, et plus personne pour le porter.',
  'Guardian':'Gardien','+18% melee reach.':'+18 % d’allonge au corps à corps.','Graphics quality':'Qualité graphique','Sound':'Son',
  'Secrets':'Secrets','Bosses':'Boss','Kills':'Éliminations','Level':'Niveau',
  'Leaderboard':'Classement','Controls':'Commandes','Guest':'Invité','Begin a Run':'Lancer une partie','Daily Hive':'Défi du jour',
  'CHOOSE YOUR OATH':'CHOISIS TA VOIE','Who enters the Gloam?':'Qui entre dans le Gloam ?','Every class changes movement, attack rhythm, ability and talent pool.':'Chaque classe change ton rythme de jeu, ta portée, ta compétence et tes talents.',
  '← Back':'← Retour','Vitality':'Vitalité','Level':'Niveau','Ability':'Compétence','RESONANCE':'RÉSONANCE','Sigils carried':'Sigils portés','RELICS':'RELIQUES','RUN':'PARTIE','Region':'Région','Kills':'Éliminations','Survive':'Survivre',
  'Choose the next path.':'Choisis la prochaine route.','Every step feeds the Gloam. Greed scores higher.':'Chaque étape nourrit le Gloam. Plus tu prends de risques, plus le score grimpe.',
  'THE HIVE REMEMBERS':'LA RUCHE SE SOUVIENT','Your run has ended.':'Ta partie est terminée.','FINAL SCORE':'SCORE FINAL','One More Run':'Encore une partie','Submit Score':'Envoyer le score',
  'Choose a Talent':'Choisis un talent','The Hive changes with every decision.':'Chaque décision transforme la Ruche.','Choose a Relic':'Choisis une relique','Relics carry sigils. Matching sigils awaken Resonances.':'Les reliques portent des sigils. Les combiner éveille des Résonances.',
  'The Petal Whispers':'Le Pétale murmure','There is no free power in the broken Bloom.':'Dans la Bloom brisée, aucun pouvoir n’est gratuit.','The Gloam Offers a Pact':'Le Gloam propose un pacte','The run may continue forever. The price rises with you.':'La partie peut continuer longtemps. Le prix augmente avec ta puissance.',
  'WAX SHRINE':'SANCTUAIRE DE CIRE','Shape what you carried.':'Façonne ce que tu as récolté.','Crafting is intentionally small: every choice should matter to the run.':'Peu de recettes, mais chaque choix doit compter pour cette partie.',
  'The Guardian bars the way forward.':'Le Gardien bloque la route.','Score':'Score','Relics':'Reliques','Multiplier':'Multiplicateur',
  'The Bloom remembers your first steps.':'La Bloom se souvient de tes premiers pas.','Your score can be submitted to the Hive.':'Ton score peut être envoyé à la Ruche.','Log in to place this run on the leaderboard.':'Connecte-toi pour placer cette partie dans le classement.','Login to Submit':'Se connecter pour envoyer',
  'CONTROLS':'COMMANDES','Make the Hive yours.':'Adapte la Ruche à ton jeu.','Click a binding, then press the key you want. Escape cancels. Bindings are saved on this device.':'Clique sur une commande puis appuie sur la touche souhaitée. Échap annule. Les touches sont sauvegardées sur cet appareil.',
  'Move up':'Monter','Move down':'Descendre','Move left':'Aller à gauche','Move right':'Aller à droite','Class ability':'Compétence de classe','Arrows':'Flèches','Press a key…':'Appuie sur une touche…','Binding unchanged.':'Commande inchangée.',
  'HIVE PROFILE':'PROFIL DE LA RUCHE','Log out':'Se déconnecter','HIVE ACCOUNT':'COMPTE DE LA RUCHE','Carry your scores between games.':'Retrouve tes scores d’une partie à l’autre.','Login':'Connexion','Username':'Pseudo','Password':'Mot de passe','Enter the Hive':'Entrer dans la Ruche','Create account':'Créer un compte','Create':'Créer',
  'GLOBAL HIVE':'RUCHE MONDIALE','All-time':'Tous les temps','Loading…':'Chargement…','Player':'Joueur','Class':'Classe','No score yet. The first legend could be you.':'Aucun score pour le moment. La première légende pourrait être toi.','Submitted ✓':'Envoyé ✓',
  'No relics yet.':'Aucune relique pour le moment.','Free':'Gratuit','CHOICE':'CHOIX','TALENT':'TALENT','RANK':'RANG','PACT':'PACTE',
  'REGION GUARDIAN':'GARDIEN DE RÉGION','ELITE HUNT':'CHASSE ÉLITE','GLOAM SWARM':'ESSAIM DU GLOAM','Defeat the Guardian':'Vaincre le Gardien',
  'WARRIOR OF THE HIVE':'GUERRIER DE LA RUCHE','POLLEN MAGE':'MAGE DU POLLEN','RANGER OF THE WILD':'RÔDEUR SAUVAGE','ROYAL CANTOR':'CHANTRE ROYAL',
  'Close combat · armour · retaliation':'Corps à corps · armure · riposte','Spells · area damage · chain reactions':'Sorts · dégâts de zone · réactions en chaîne','Speed · critical hits · poison':'Vitesse · critiques · poison','Motes · healing · blessings':'Motes · soins · bénédictions',
  'Stand inside the swarm. Your wax armour hardens under pressure and your stinger turns pain into momentum.':'Tiens bon au cœur de l’essaim. Ton armure de cire se durcit sous la pression et chaque coup reçu nourrit ta riposte.',
  'Shape forbidden pollen into volatile spells. Fragile at first; terrifying once Resonances begin to chain.':'Façonne le pollen interdit en sorts instables. Fragile au départ, terrifiant lorsque les Résonances commencent à s’enchaîner.',
  'Never stop moving. Thorn arrows reward distance, tempo and risky routes through the Bloom.':'Ne t’arrête jamais. Les flèches d’épine récompensent la distance, le rythme et les routes risquées à travers la Bloom.',
  'Carry the old song of the Queen. Sacred motes fight beside you while every blessing can become a weapon.':'Porte l’ancien chant de la Reine. Des motes sacrées combattent à tes côtés et chaque bénédiction peut devenir une arme.',
  'Bastion of Wax':'Bastion de cire','Become invulnerable briefly and blast nearby enemies.':'Deviens brièvement invulnérable et repousse les ennemis proches.','Superbloom':'Superfloraison','Detonate a ring of arcane seeds around you.':'Fais exploser un anneau de graines arcaniques autour de toi.','Briarstep':'Pas de ronce','Dash through danger and fire a radial thorn volley.':'Traverse le danger d’un bond et tire une volée d’épines autour de toi.','Queen’s Chorus':'Chœur de la Reine','Heal and summon a burst of homing royal motes.':'Soigne-toi et invoque une salve de motes royales à tête chercheuse.',
  'Melee cleave':'Balayage de mêlée','Highest vitality':'Vitalité maximale','Damage taken fuels fury':'Les dégâts subis nourrissent la fureur','Long range':'Longue portée','Explosive spell synergies':'Synergies de sorts explosifs','Low vitality':'Faible vitalité','Fastest movement':'Déplacements les plus rapides','Rapid ranged attacks':'Attaques à distance rapides','Critical build specialist':'Spécialiste des critiques','Self healing':'Auto-soin','Homing attacks':'Attaques à tête chercheuse','Scales with blessings':'Progresse avec les bénédictions',
  'Feral Memory':'Mémoire sauvage','+12% damage.':'+12 % de dégâts.','Wingbeat':'Battement d’ailes','+8% movement speed.':'+8 % de vitesse de déplacement.','Royal Jelly Heart':'Cœur de gelée royale','+20 max vitality and heal 20.':'+20 de vitalité max et soigne 20.','Quickened Pulse':'Pouls accéléré','Attack 8% faster.':'Attaque 8 % plus vite.','Golden Instinct':'Instinct doré','+5% critical chance.':'+5 % de chance de critique.',
  'Hornet Temper':'Tempérament de frelon','Damage rises as vitality falls.':'Les dégâts augmentent quand la vitalité baisse.','Many Against One':'Seul contre tous','Melee attacks gain +24 range.':'Les attaques de mêlée gagnent +24 de portée.','Hard Wax':'Cire dure','Contact damage hurts attackers.':'Les dégâts de contact blessent les attaquants.',
  'Forked Pollen':'Pollen fourchu','Bolts have a chance to split.':'Les projectiles ont une chance de se diviser.','Unstable Bloom':'Bloom instable','Projectile impacts deal splash damage.':'Les impacts infligent des dégâts de zone.','Nectar Current':'Courant de nectar','Superbloom recharges faster.':'Superfloraison se recharge plus vite.',
  'Twin Thorn':'Double épine','Fire additional arrows.':'Tire des flèches supplémentaires.','Predator’s Line':'Ligne du prédateur','Long shots deal more damage.':'Les tirs lointains infligent plus de dégâts.','Night Venom':'Venin nocturne','Critical hits poison.':'Les coups critiques empoisonnent.',
  'Second Voice':'Seconde voix','Attacks may summon an extra royal mote.':'Les attaques peuvent invoquer une mote royale supplémentaire.','Grace Returned':'Grâce retrouvée','Kills sometimes restore vitality.':'Les éliminations restaurent parfois de la vitalité.','Endless Hymn':'Hymne sans fin','Queen’s Chorus gains more motes.':'Le Chœur de la Reine gagne davantage de motes.',
  'Gloam Swarm':'Essaim du Gloam','Survive an escalating swarm and gather materials.':'Survis à un essaim de plus en plus dangereux et récolte des matériaux.','Normal risk':'Risque normal','Marked Predator':'Prédateur marqué','Stronger enemies, richer relics and more score.':'Des ennemis plus forts, de meilleures reliques et davantage de score.','High risk · better loot':'Risque élevé · meilleur butin','Forgotten Comb':'Rayon oublié','Choose a relic from an abandoned royal cache.':'Choisis une relique dans une cache royale abandonnée.','Safe · no combat':'Sûr · aucun combat','Wax Shrine':'Sanctuaire de cire','Spend gathered materials to permanently shape this run.':'Dépense les matériaux récoltés pour renforcer cette partie.','Crafting':'Artisanat','Whispering Petal':'Pétale murmurant','A strange choice: power always asks for something back.':'Un choix étrange : le pouvoir réclame toujours quelque chose en échange.','Unknown':'Inconnu','End the region. The next Bloom will be more corrupted.':'Termine la région. La prochaine Bloom sera plus corrompue.','BOSS · huge score':'BOSS · score énorme',
  'Temper the Stinger':'Tremper le dard','+10% damage for this run.':'+10 % de dégâts pour cette partie.','Harden the Carapace':'Durcir la carapace','+25 max vitality and heal 25.':'+25 de vitalité max et soigne 25.','Distill Moon Pollen':'Distiller le pollen lunaire','+5% critical chance and +4% movement.':'+5 % de chance de critique et +4 % de déplacement.','Leave the Shrine':'Quitter le sanctuaire','Save your materials.':'Conserve tes matériaux.',
  'Drink Black Nectar':'Boire le nectar noir','+22% damage, lose 20% current vitality, +8 Gloam.':'+22 % de dégâts, perd 20 % de la vitalité actuelle, +8 Gloam.','POWER / COST':'PUISSANCE / PRIX','Hear the Dead Queen':'Écouter la Reine morte','Gain a random talent, +6 Gloam.':'Gagne un talent aléatoire, +6 Gloam.','KNOWLEDGE / RISK':'SAVOIR / RISQUE','Close the Petal':'Refermer le pétale','Nothing happens. Perhaps that is wisdom.':'Rien ne se passe. C’est peut-être plus sage.','SAFE':'SÛR',
  'Pact of Hunger':'Pacte de Faim','Enemies gain 30% vitality. Score multiplier rises sharply.':'Les ennemis gagnent 30 % de vitalité. Le multiplicateur de score augmente fortement.','Pact of Glass':'Pacte de Verre','+28% damage, but lose 18 max vitality.':'+28 % de dégâts, mais perd 18 de vitalité max.','Pact of Wings':'Pacte des Ailes','+14% speed and attack speed. Enemies move 12% faster.':'+14 % de vitesse et de vitesse d’attaque. Les ennemis se déplacent 12 % plus vite.',
  'Verdant Reach':'Étendue verdoyante','Mycelian Deep':'Profondeurs mycéliennes','Ashen Orchard':'Verger de cendres','Moonlit Fen':'Marais au clair de lune','Crownless Garden':'Jardin sans couronne',
  'Common':'Commun','Rare':'Rare','Epic':'Épique','Legendary':'Légendaire','Ancient':'Ancien','Royal':'Royal','Gilded':'Doré','Hollow':'Creux','Thornbound':'Lié aux épines','Moonlit':'Lunaire','Ashen':'Cendré','Singing':'Chantant','Forbidden':'Interdit','Glass':'De verre','Stinger':'Dard','Carapace':'Carapace','Petal':'Pétale','Charm':'Charme','Crown':'Couronne','Vial':'Fiole','Needle':'Aiguille','Bell':'Cloche','Lantern':'Lanterne','Heart':'Cœur'
};

function currentLang(){return localStorage.getItem(STORAGE_KEY)==='en'?'en':'fr'}

function translateText(raw){
  const text=raw.trim();
  if(!text)return raw;
  let out=fr[text];
  let m;
  if(!out&&(m=text.match(/^Survive (\d+)s$/)))out=`Survivre ${m[1]} s`;
  if(!out&&(m=text.match(/^Wave (\d+) \/ (\d+)$/)))out=`Vague ${m[1]} / ${m[2]}`;
  if(!out&&(m=text.match(/^Wave (\d+) of (\d+)$/)))out=`Vague ${m[1]} sur ${m[2]}`;
  if(!out&&(m=text.match(/^LV (\d+)$/)))out=`NIV ${m[1]}`;
  if(!out&&(m=text.match(/^Region (\d+)$/)))out=`Région ${m[1]}`;
  if(!out&&(m=text.match(/^Region (\d+) · Gloam (\d+)%$/)))out=`Région ${m[1]} · Gloam ${m[2]} %`;
  if(!out&&(m=text.match(/^The Guardian sheds its shell\. Phase (\d+)\.$/)))out=`Le Gardien abandonne sa carapace. Phase ${m[1]}.`;
  if(!out&&(m=text.match(/^Overflow (\d+): (.+)$/)))out=`Débordement ${m[1]} : ${translateText(m[2])}`;
  if(!out&&(m=text.match(/^\+(\d+)% damage · \+(\d+) vitality$/)))out=`+${m[1]} % de dégâts · +${m[2]} de vitalité`;
  if(!out&&(m=text.match(/^Hidden Cache$/)))out='Cache secrète';
  if(!out&&(m=text.match(/^Choose (.+)$/)))out=`Choisir ${fr[m[1]]||m[1]}`;
  if(!out&&(m=text.match(/^Guardian of (.+)$/)))out=`Gardien de ${fr[m[1]]||m[1]}`;
  if(!out&&(m=text.match(/^REGION (\d+) · (.+)$/)))out=`RÉGION ${m[1]} · ${fr[toTitleCase(m[2])]||m[2]}`;
  if(!out&&(m=text.match(/^The Gloam claimed a (.+)\.$/)))out=`Le Gloam a eu raison de ${m[1]}.`;
  if(!out&&(m=text.match(/^(.+) · rank (\d+)$/)))out=`${fr[m[1]]||m[1]} · rang ${m[2]}`;
  if(!out&&(m=text.match(/^Score submitted\. Your best: (.+)\.$/)))out=`Score envoyé. Ton record : ${m[1]}.`;
  if(!out&&(m=text.match(/^(.+) is already assigned to (.+)\.$/)))out=`${m[1]} est déjà assigné à ${fr[m[2]]||m[2]}.`;
  if(!out&&(m=text.match(/^(COMMON|RARE|EPIC|LEGENDARY) · (.+)$/))){const r={COMMON:'COMMUN',RARE:'RARE',EPIC:'ÉPIQUE',LEGENDARY:'LÉGENDAIRE'}[m[1]];out=`${r} · ${translateCompound(m[2])}`}
  if(!out&&(m=text.match(/^\+(\d+)% damage$/)))out=`+${m[1]} % de dégâts`;
  if(!out&&(m=text.match(/^\+(\d+)% speed$/)))out=`+${m[1]} % de vitesse`;
  if(!out&&(m=text.match(/^\+(\d+)% attack speed$/)))out=`+${m[1]} % de vitesse d’attaque`;
  if(!out&&(m=text.match(/^\+(\d+)% crit$/)))out=`+${m[1]} % de critique`;
  if(!out&&text.includes(' · '))out=text.split(' · ').map(part=>fr[part]||part).join(' · ');
  if(!out)return raw;
  return (raw.match(/^\s*/)?.[0]||'')+out+(raw.match(/\s*$/)?.[0]||'');
}

function translateCompound(text){return text.split(' ').map(w=>fr[w]||w).join(' ')}
function toTitleCase(s){return s.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase())}

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
}

// Text drawn outside the DOM (canvas signposts) asks for its translation here.
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
