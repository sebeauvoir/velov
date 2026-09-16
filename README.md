# Vélo'v Décines Centre — Statistiques avancées

Tableau de bord statique (GitHub Pages) affichant l'état en temps réel et
l'historique de la station Vélo'v **Décines Centre** (Métropole de Lyon) :
vélos/places disponibles, taux d'occupation, tendances par heure et par jour
de la semaine, min/max observés, etc.

## Comment ça marche

- Un workflow GitHub Actions (`.github/workflows/collect-data.yml`) interroge
  l'[API JCDecaux](https://developer.jcdecaux.com/) toutes les 15 minutes,
  retrouve la station "Décines Centre" dans le contrat `lyon`, et ajoute une
  ligne JSON à `data/history.jsonl`.
- La page `index.html` (servie par GitHub Pages) charge ce fichier côté
  client et calcule les statistiques et graphiques (Chart.js), sans backend.
- Aucune clé API n'est exposée côté client : elle n'est utilisée que dans le
  workflow, côté serveur.

## Mise en route

1. **Obtenir une clé API JCDecaux** (gratuite) : créez un compte sur
   <https://developer.jcdecaux.com/> et demandez une clé "Open API".
2. **Ajouter le secret** dans le dépôt GitHub : *Settings → Secrets and
   variables → Actions → New repository secret*, nom `JCDECAUX_API_KEY`,
   valeur = votre clé.
3. **Activer GitHub Pages** : *Settings → Pages → Source: Deploy from a
   branch → Branch: `main` / `(root)`*.
4. **Lancer une première collecte** : onglet *Actions → Collect Velo'v
   station data → Run workflow* (ou attendez le prochain déclenchement cron).
5. Le site se remplit progressivement à chaque exécution du workflow
   (toutes les 15 min). Tant qu'aucune donnée n'a été collectée, la page
   affiche un message d'attente.

## Structure

```
index.html                     page du tableau de bord
assets/style.css                styles (clair/sombre)
assets/app.js                   chargement des données + graphiques
data/history.jsonl              historique (1 ligne JSON par relevé)
scripts/fetch_station.py        script de collecte (appelé par le workflow)
.github/workflows/collect-data.yml   cron GitHub Actions
```

## Personnalisation

- Pour suivre une autre station, modifiez `STATION_MATCH` dans
  `scripts/fetch_station.py` (mots-clés à retrouver dans le nom/adresse de
  la station renvoyée par l'API).
- La fréquence de collecte se change dans le `cron` du workflow (attention :
  GitHub Actions ne garantit pas une précision à la minute près sur les
  crons planifiés).
