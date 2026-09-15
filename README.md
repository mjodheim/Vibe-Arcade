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

Un roguelite d'action fantasy dans lequel des abeilles héroïques quittent la sécurité de la ruche, poursuivent d'étranges reliques, construisent des combinaisons absurdes, affrontent des créatures corrompues et risquent toujours davantage pour battre leur meilleur score.

| 🛡️ Waxguard | ✨ Bloomweaver | 🏹 Thornstrider | 🎶 Hymnkeeper |
|:---:|:---:|:---:|:---:|
| Guerrier | Mage | Rôdeur | Support |
| Armure & riposte | Pollen arcanique & explosions | Vitesse & critiques | Auras & puissance de l'essaim |

### 🍯 Qu'est-ce qui est déjà présent ?

`⚔️ combats en temps réel` · `🗺️ routes procédurales` · `💎 loot aléatoire` · `🌿 talents` · `🔨 craft` · `👑 boss` · `🌀 résonances` · `🌑 pactes risque/récompense` · `🏆 classements` · `☀️ Daily Hive`

Chaque run consiste à devenir de plus en plus déraisonnablement puissant avant que la corruption ne finisse par te rattraper.

**Version actuelle :** `v0.2 — prototype jouable`

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
| `#001` | 🐝 **Hivebound: Relics of the Bloom** | Roguelite d'action fantasy | 🟢 JOUABLE |
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

Hivebound nécessite actuellement **Node.js 20+** et n'a aucune dépendance npm nécessaire à l'exécution.

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
