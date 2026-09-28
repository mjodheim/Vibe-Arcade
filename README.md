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

# 🧱 BORNE #002

## **Stack Panic**

> *Tout est sous contrôle.*

Un **jeu de blocs qui tombent** dans lequel la partie refuse de rester sage. Tu empiles, tu nettoies des lignes — et le directeur du chaos envoie des moutons qui poussent les cases, de l'eau qui coule dans les trous, une bombe, un tank, une panne de courant, un canard inspecteur, ou une **brèche structurelle** : le jeu s'ouvre alors en 3D et tu pilotes un vaisseau dans un tunnel construit à partir de ta propre pile.

Depuis la **v1.0 — NO MERCY**, plus aucun incident ne joue pour toi : les blocs ne disparaissent plus, ils sont déplacés, enterrés ou renvoyés sur ta pile. Le chaos monte tout seul, un niveau tombe toutes les 30 secondes et une marée de gravats remonte du sol de plus en plus souvent. Chaque partie finit par casser — la question est quand.

`🐑 moutons` · `💧 commandes qui glissent` · `💣 gravats` · `🪖 tank à remblai` · `🌑 panne de courant` · `📼 commandes inversées` · `🦆 canard contrôleur` · `🌀 brèche 3D` · `☀️ défi du jour` · `👤 comptes joueurs` · `🏆 classements en ligne`

➡️ **[Jouer à Stack Panic](https://arcade.mjodheim.be/stack-panic/)** · [le code et les notes de jeu](games/stack-panic)

---

# 🍎 BORNE #003

## **Forbidden Fruit**

> *Snake, mais c'est toi la pomme.*

Tu fuis. Trois serpents te chassent : **le Chasseur** fonce droit sur toi, **l'Embusqué** vise là où tu vas, **le Bourré** zigzague au hasard. Ils grandissent et accélèrent sans arrêt, et un nouveau débarque toutes les 22 secondes. Un serpent qui percute un mur, lui-même ou un autre serpent explose en graines (+500, combos ×2, ×3…) : le vrai jeu, c'est de les faire s'entretuer.

➡️ **[Jouer à Forbidden Fruit](https://arcade.mjodheim.be/forbidden-fruit/)**

---

# 🐦 BORNE #004

## **Pigeon Control**

> *Tour de contrôle, ici le pigeon.*

Trace à la souris ou au doigt la route de chaque pigeon jusqu'au monument de sa couleur. Deux pigeons qui se touchent, c'est fini. Au programme : pigeons obèses, pigeons ninja, mouettes qui n'obéissent à personne et un gamin qui jette du pain au pire moment.

➡️ **[Jouer à Pigeon Control](https://arcade.mjodheim.be/pigeon-control/)**

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
| `#002` | 🧱 **Stack Panic** | Puzzle de blocs chaotique | 🟢 JOUABLE |
| `#003` | 🍎 **Forbidden Fruit** | Snake inversé | 🟢 JOUABLE |
| `#004` | 🐦 **Pigeon Control** | Contrôle aérien de pigeons | 🟢 JOUABLE |
| `#004` | ❔ **???** | ??? | 🔒 VERROUILLÉ |

Les prochains jeux pourront partager la même identité d'arcade, les profils joueurs, les succès et un classement propre à chaque jeu, tout en proposant des expériences complètement différentes.

---

## 🏆 Ambitions de l'arcade

À mesure que la collection grandit, Vibe Arcade doit obtenir une couche commune autour des jeux :

- ✅ 👤 une seule identité joueur dans toute l'arcade
- ✅ 🏆 un classement pour chaque jeu
- 🥇 des défis quotidiens et permanents
- 🎖️ des succès inter-jeux
- 📊 des records personnels et statistiques d'arcade
- 🎲 des jeux très différents nés de nouvelles idées

La contrainte importante reste la même : **le joueur oriente le produit par ses idées, ses tests et ses retours en langage naturel plutôt qu'en implémentant lui-même le gameplay.**

---

## 🚀 Lancer l'arcade

Tout tourne dans **un seul process Node** (`server/`) : page d'accueil, bornes sous `/<jeu>/` et API comptes/classements. Aucune dépendance npm, Node 20+.

```bash
npm run dev    # http://localhost:8080 — rechargement auto, données dans ./data
npm test       # serveur, API, logique des jeux + smoke test Stack Panic
```

### Sur le VPS (Docker)

```bash
cp .env.example .env          # mettre un ARCADE_SECRET long et aléatoire
docker compose up -d --build  # écoute sur 127.0.0.1:8080
```

- Les comptes et scores vivent dans le volume `arcade_data` (`/app/data/arcade.json`).
- Mettre le reverse proxy existant (Nginx, Caddy…) devant `127.0.0.1:8080` pour le HTTPS. Garder `TRUST_PROXY=1` pour que la limitation des tentatives de connexion voie les vraies IP.
- Mise à jour : `git pull && docker compose up -d --build`.

---

## 🗂️ Derrière les bornes

```text
Vibe-Arcade/
├── 🎮 games/
│   ├── 🧱 stack-panic/     # Jeu #002
│   ├── 🍎 forbidden-fruit/ # Jeu #003
│   └── 🐦 pigeon-control/  # Jeu #004
├── 🖥️ server/               # Serveur Node : site, jeux, comptes & classements
├── 🐳 Dockerfile · docker-compose.yml
├── 🤝 shared/               # Client compte partagé par toutes les bornes
├── 🎨 assets/               # Visuels de l'arcade
├── 📚 docs/
│   └── PHILOSOPHY.md        # Ce que l'expérience cherche à explorer
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
