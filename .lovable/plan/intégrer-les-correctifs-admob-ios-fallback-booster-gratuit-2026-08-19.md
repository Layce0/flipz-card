# Intégrer les correctifs AdMob iOS (fallback booster gratuit)

## Constat

Vos trois correctifs ne sont pas présents dans le projet actuel :

- `ios/App/App/Info.plist` : aucune clé `SKAdNetworkItems`.
- `src/hooks/useAdMob.ts` : `prepareInterstitial` sans timeout, aucun écouteur `FailedToLoad`, seul `FailedToShow` est géré → blocage possible sur « Chargement de la publicité… ».
- `src/pages/Packs.tsx` ligne 74 : la condition teste encore `status === 429`, alors que `open-free-pack` renvoie HTTP 200 avec `code: 'FREE_PACK_RATE_LIMIT'`.

Ils seraient donc bien écrasés à la prochaine génération. Le plan ci-dessous les réintègre dans le dépôt pour qu'ils soient permanents.

## Ce qui sera fait

### 1. Info.plist iOS
Ajout du tableau `SKAdNetworkItems` avec la liste officielle des `SKAdNetworkIdentifier` publiée par Google pour AdMob, afin de restaurer le fill rate quand l'utilisateur refuse le tracking ATT.

### 2. Hook AdMob robuste (`src/hooks/useAdMob.ts`)
- Timeout de 10 s autour de `AdMob.prepareInterstitial()`.
- Timer de sécurité de 15 s sur l'affichage de l'interstitiel.
- Écoute de `InterstitialAdPluginEvents.FailedToLoad` en plus de `FailedToShow`.
- Repli « graceful » : en cas de timeout ou d'échec de chargement, la promesse résout `true` pour laisser le booster s'ouvrir malgré l'absence de pub.
- Nettoyage systématique des listeners et des timers pour éviter les fuites et les doubles résolutions.

### 3. Détection du rate limit (`src/pages/Packs.tsx`)
Remplacement de `status === 429` par un test sur `parsedError?.code === 'FREE_PACK_RATE_LIMIT'` (en conservant le repli sur le message texte), pour afficher le toast de temps d'attente au lieu d'une erreur générique.

## Détails techniques

- `showInterstitial` conserve sa signature `Promise<boolean>` : aucun changement côté appelants (`Packs.tsx`), seule la sémantique de l'échec de chargement change (échec pub ≠ échec ouverture).
- Le comportement web (fausse pub 5 s) reste inchangé.
- Le mode test AdMob reste conditionné à `isAdmin`.
- Aucun changement backend : `open-free-pack` renvoie déjà `code: 'FREE_PACK_RATE_LIMIT'` en 200.

## À faire de votre côté après validation

`git pull`, puis `npx cap sync ios`, incrémenter le numéro de build et resoumettre.
