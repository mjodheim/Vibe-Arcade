<p align="center">
  <img src="assets/vibe-arcade-banner-v2.svg" alt="Vibe Arcade — Des idées aux jeux" width="100%" />
</p>

<p align="center">
  <strong>🇫🇷 Français</strong> · <a href="README.en.md">🇬🇧 English</a>
</p>

<p align="center">
  <strong>🎮 Une idée. Quelques itérations. Un nouveau jeu auquel jouer.</strong><br/>
  <sub>Une arcade qui grandit grâce au vibe coding.</sub>
</p>

<p align="center">
  🧠 IDÉE &nbsp;→&nbsp; 🤖 IA &nbsp;→&nbsp; 🕹️ JOUER &nbsp;→&nbsp; 💭 RÉAGIR &nbsp;→&nbsp; ✨ ÉVOLUER
</p>

---

## 🕹️ Bienvenue dans Vibe Arcade

**Vibe Arcade** est une collection de jeux qui commencent par une envie, une idée étrange ou un simple *« ce serait pas cool si… ? »*

Pas besoin de commencer par un document de game design traditionnel. Pas besoin de choisir un framework avant même de savoir si l'idée est amusante. L'expérience recherchée vient d'abord ; l'IA la transforme en quelque chose de jouable ; ensuite on joue, on réagit, on change de direction, on ajoute des idées, on enlève ce qui est ennuyeux et on continue jusqu'à ce que le résultat sonne juste.

> **Le code n'est pas l'attraction. Le résultat jouable l'est.**

Le code source est public. Les conversations privées utilisées pour orienter le développement **ne sont pas archivées dans ce dépôt**.

---

# 🐝 BORNE #001

## **Hivebound: Relics of the Bloom**

> *The Bloom is fading. The Hive remembers.*

Un **jeu d'aventure 3D** dans lequel des abeilles héroïques quittent la sécurité de la ruche, traversent des clairières générées à la volée, fouillent l'herbe, poursuivent d'étranges reliques, construisent des combinaisons absurdes, affrontent des créatures corrompues et risquent toujours davantage pour battre leur meilleur score.

Tu voles toi-même. Chaque étape d'une partie est une clairière à explorer : relief, champignons géants, piliers de cire en ruine, pollen qui dérive — et, au fond, trois portes qui annoncent exactement ce que tu choisis d'affronter ensuite.

| 🛡️ Waxguard | ✨ Bloomweaver | 🏹 Thornstrider | 🎶 Hymnkeeper |
|:---:|:---:|:---:|:---:|
| Guerrier | Mage | Rôdeur | Support |
| Armure & riposte | Pollen arcanique & explosions | Vitesse & critiques | Auras & puissance de l'essaim |

### 🍯 Qu'est-ce qui est déjà présent ?

`🌍 clairières 3D procédurales` · `⚔️ combats en temps réel` · `🐛 4 créatures du Gloam` · `👑 Gardien à 3 phases` · `💎 loot aléatoire` · `🌿 talents` · `🔨 craft` · `🌀 résonances` · `🌑 pactes risque/récompense` · `🗝 caches secrètes` · `🏆 classements` · `☀️ Daily Hive`

Chaque run consiste à devenir de plus en plus déraisonnablement puissant avant que la corruption ne finisse par te rattraper.

Cinq biomes s'enchaînent — Étendue verdoyante, Profondeurs mycéliennes, Verger de cendres, Marais au clair de lune, Jardin sans couronne — chacun avec sa lumière, sa météo, sa végétation et sa couleur d'angoisse.

**Version actuelle :** `v0.3 — aventure 3D jouable`

➡️ **[Entrer dans Hivebound](games/hivebound)**

---

## 🧪 La boucle Vibe

```text
         💡 « Et si... ? »
                │
                ▼
          🤖 CONSTRUIRE
                │
                ▼
           🎮 JOUER
          ╱          ╲
      😍 FUN        😐 BOF
        │             │
        │             ▼
        │       💭 « Change ça... »
        │             │
        └──────┬──────┘
               ▼
            ✨ ÉVOLUER
               │
               └──────────↺
```

Il n'est pas nécessaire de parler d'API, de classes, de moteurs, de bases de données ou de patterns pour faire évoluer le jeu.

Un retour utile peut être aussi simple que :

> *« Le mage ne donne pas une impression de puissance. »*
>
> *« Je veux du loot capable de changer complètement mon build. »*
>
> *« Ce boss est ennuyeux. »*
>
> *« Laisse-moi modifier les touches. »*
>
> *« J'ai envie de relancer une partie. »*

La dernière phrase est la plus importante. 😈

---

# 👾 Les bornes de l'arcade

| Borne | Jeu | Genre | Statut |
|:--:|---|---|:--:|
| `#001` | 🐝 **Hivebound: Relics of the Bloom** | Aventure 3D · roguelite d'action | 🟢 JOUABLE |
| `#002` | ❔ **???** | ??? | 🔒 VERROUILLÉ |
| `#003` | ❔ **???** | ??? | 🔒 VERROUILLÉ |
| `#004` | ❔ **???** | ??? | 🔒 VERROUILLÉ |

Les prochains jeux pourront partager la même identité d'arcade, les profils joueurs, les succès et un classement propre à chaque jeu, tout en proposant des expériences complètement différentes.

---

## 🏆 Ambitions de l'arcade

À mesure que la collection grandit, Vibe Arcade doit obtenir une couche commune autour des jeux :

- 👤 une seule identité joueur dans toute l'arcade
- 🏆 un classement pour chaque jeu
- 🥇 des défis quotidiens et permanents
- 🎖️ des succès inter-jeux
- 📊 des records personnels et statistiques d'arcade
- 🎲 des jeux très différents nés de nouvelles idées
- 🌍 une localisation complète : français en première langue, anglais en seconde

La contrainte importante reste la même : **le joueur oriente le produit par ses idées, ses tests et ses retours en langage naturel plutôt qu'en implémentant lui-même le gameplay.**

---

## 🚀 Lancer l'arcade actuelle

### Docker

```bash
cp games/hivebound/.env.example games/hivebound/.env
# Définir une valeur HIVEBOUND_SECRET robuste dans le fichier .env

docker compose up -d --build
```

Puis ouvrir :

```text
http://localhost:8080
```

### Sans Docker

Hivebound nécessite **Node.js 20+** côté serveur et un navigateur compatible **WebGL2** côté joueur. Aucune dépendance npm n'est nécessaire à l'exécution : three.js est embarqué dans `games/hivebound/public/vendor/`.

```bash
cd games/hivebound
export HIVEBOUND_SECRET='un-secret-long-et-aleatoire'
node server.js
```

Pour les contrôles, les mécaniques et les informations propres au jeu, voir **[games/hivebound](games/hivebound)**.

---

## 🗂️ Derrière les bornes

```text
Vibe-Arcade/
├── 🎮 games/
│   └── 🐝 hivebound/       # Jeu #001
├── 🎨 assets/               # Visuels de l'arcade
├── 📚 docs/
│   └── PHILOSOPHY.md        # Ce que l'expérience cherche à explorer
├── 🐳 docker-compose.yml
├── 📖 README.md             # Français
└── 📖 README.en.md          # English
```

---

<p align="center">
  <strong>✨ AVOIR UNE IDÉE. JOUER AU RÉSULTAT. ✨</strong>
</p>

<p align="center">
  <sub>Vibe Arcade — un jeu étrange à la fois.</sub>
</p>
