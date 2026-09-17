# Vélo'v Métropole de Lyon — Statistiques avancées

Tableau de bord statique (GitHub Pages) affichant l'état en temps réel et
l'historique de **toutes les stations Vélo'v** de la Métropole de Lyon :
carte pour choisir une station, vélos mécaniques/électriques et places
disponibles, taux d'occupation, tendances par heure et par jour de la
semaine, min/max observés, part électrique, etc.

## Comment ça marche

- Un workflow GitHub Actions (`.github/workflows/collect-data.yml`)
  interroge l'[API JCDecaux](https://developer.jcdecaux.com/) (contrat
  `lyon`) toutes les 15 minutes et récupère l'état de **toutes** les
  stations du réseau en un seul appel.
- Ces relevés sont poussés sur une branche **`data`** dédiée (pas `main`) :
  `data/stations.json` (nom, position, capacité de chaque station,
  réécrit à chaque run) et un fichier par station
  `data/stations/<numéro>.jsonl` (un relevé JSON par ligne, ajouté à
  chaque run). Séparer les données de `main` évite qu'un rebuild GitHub
  Pages complet se déclenche à chaque collecte — Pages ne surveille que
  `main`, qui ne change que lorsque le code du site change réellement.
- La page `index.html` (servie par GitHub Pages depuis `main`) charge ces
  fichiers **directement depuis `raw.githubusercontent.com`** côté
  client (pas de backend) : une carte Leaflet (`assets/map.js`) affiche
  toutes les stations à partir de `stations.json`, et sélectionner une
  station charge son historique (`assets/app.js`) pour calculer les
  statistiques et graphiques (Chart.js).
- La station sélectionnée est reflétée dans l'URL (`?station=<numéro>`),
  donc un lien vers une station précise est partageable. Par défaut :
  Décines Centre (13001).
- Aucune clé API n'est exposée côté client : elle n'est utilisée que dans
  le workflow, côté serveur.
- **Déclenchement de la collecte** : le `schedule:` cron natif de GitHub
  Actions s'est révélé peu fiable pour ce dépôt (délais de plusieurs
  heures, voire aucun déclenchement — bug connu et documenté côté
  GitHub). La collecte fiable en production est donc pilotée par un
  **cron externe gratuit** ([cron-job.org](https://cron-job.org/)) qui
  appelle l'API GitHub (`POST .../actions/workflows/collect-data.yml/dispatches`)
  toutes les 15 minutes. Le `schedule:` reste présent dans le workflow en
  filet de sécurité (inoffensif s'il se déclenche en plus).

## Mise en route

1. **Obtenir une clé API JCDecaux** (gratuite) : créez un compte sur
   <https://developer.jcdecaux.com/> et demandez une clé "Open API".
2. **Ajouter le secret** dans le dépôt GitHub : *Settings → Secrets and
   variables → Actions → New repository secret*, nom `JCDECAUX_API_KEY`,
   valeur = votre clé.
3. **Activer GitHub Pages** : *Settings → Pages → Source: Deploy from a
   branch → Branch: `main` / `(root)`*.
4. **Créer la branche `data`** si elle n'existe pas encore (`git branch
   data main && git push -u origin data`) — c'est elle qui stocke les
   relevés.
5. **Lancer une première collecte** : onglet *Actions → Collect Velo'v
   network data → Run workflow* (ou attendez le prochain déclenchement).
6. **Mettre en place le cron externe** (recommandé, voir ci-dessus) :
   créez un token GitHub *fine-grained* limité à ce dépôt avec la
   permission **Actions: Read and write**, puis sur cron-job.org créez un
   job `POST` toutes les 15 min vers
   `https://api.github.com/repos/<owner>/<repo>/actions/workflows/collect-data.yml/dispatches`
   avec les en-têtes `Authorization: Bearer <token>`,
   `Accept: application/vnd.github+json`, `Content-Type: application/json`
   et le corps `{"ref":"main"}`.
7. Le site se remplit progressivement à chaque collecte. Tant qu'aucune
   donnée n'a été collectée pour la station affichée, la page affiche un
   message d'attente.

## Structure

```
index.html                          page du tableau de bord + carte
assets/style.css                    styles (clair/sombre)
assets/app.js                       chargement des données d'une station + graphiques
assets/map.js                       carte Leaflet, sélection de station
assets/vendor/                      Chart.js, moment.js, Leaflet (vendorisés, pas de clé/CDN requis)
scripts/fetch_stations.py           script de collecte (toutes les stations, appelé par le workflow)
.github/workflows/collect-data.yml  workflow GitHub Actions

# Sur la branche "data" uniquement (jamais sur main) :
data/stations.json                  métadonnées de toutes les stations (réécrit à chaque run)
data/stations/<numéro>.jsonl        historique d'une station (1 ligne JSON par relevé)
```

## Personnalisation

- Pour changer la station affichée par défaut, modifiez `DEFAULT_STATION`
  dans `assets/map.js`.
- La fréquence de collecte se change dans le job cron-job.org (et,
  accessoirement, dans le `cron` du workflow — voir la mise en garde
  ci-dessus sur sa fiabilité).
- `scripts/fetch_stations.py` peut être adapté pour suivre un autre
  contrat JCDecaux (variable `CONTRACT`, ville différente de Lyon).
