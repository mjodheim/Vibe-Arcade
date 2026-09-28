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
| `#003` | ❔ **???** | Arcade WTF | 🛠️ EN CONSTRUCTION |
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

## 🚀 Lancer l'arcade actuelle

Le site est statique, avec une petite API (`api/`) en **Vercel Functions** pour les comptes et les classements. Aucune dépendance npm.

```bash
npm run dev    # http://localhost:3000 — site + API avec stockage en mémoire
npm test       # tests de l'API + smoke test de Stack Panic
```

### En production (Vercel)

1. Ajouter une base **Upstash Redis** au projet (Vercel → Storage / Marketplace). Elle injecte `KV_REST_API_URL` et `KV_REST_API_TOKEN` (les noms `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` marchent aussi).
2. Définir `ARCADE_SECRET` : une longue chaîne aléatoire (≥ 16 caractères) qui signe les sessions et les parties.

Sans ces variables, l'API répond « serveur de scores indisponible » et les jeux restent jouables en mode non classé.

---

## 🗂️ Derrière les bornes

```text
Vibe-Arcade/
├── 🎮 games/
│   └── 🧱 stack-panic/     # Jeu #002
├── 🔐 api/                  # Comptes & classements (Vercel Functions)
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
