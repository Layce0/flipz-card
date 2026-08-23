# Réparer le build iOS GitHub Actions (envoi vers Apple)

## Ce qui casse

Le workflow échoue à l'étape « Build and Archive iOS App », pas à l'envoi. Erreur exacte du log :

```text
LocalNotificationsPlugin.swift:103:14: error: value of type 'CAPPluginCall' has no member 'reject'
    call.reject(error.message, error.code, underlying)
```

Cause : la dépendance `@capacitor/local-notifications` est en `^8.3.1`. La version 8.3.1 (publiée le 19/08/2026, donc très récente) a introduit un nouveau système d'erreurs structurées qui utilise une API Swift absente du cœur Capacitor installé (`capacitor-swift-pm` 8.5.0, la dernière disponible). Le plugin est donc en avance sur le runtime : le code ne compile plus. Comme `^8.3.1` est une plage flottante, le build a commencé à échouer sans qu'aucun changement soit fait côté app.

Le fichier `patches/@capacitor+local-notifications+8.3.1.patch` présent dans le projet est une rustine partielle : il corrige plusieurs appels (`getArray`, `notificationRouter`, `getConfig`) mais pas la ligne 103, donc la compilation casse quand même.

## Correctif proposé

1. **Figer `@capacitor/local-notifications` en `8.2.1` (version exacte, sans `^`)** — dernière version dont le code iOS compile avec Capacitor 8.5.0 (elle n'utilise pas l'API d'erreurs structurées).
2. **Supprimer `patches/@capacitor+local-notifications+8.3.1.patch`** — il ne correspond plus à la version installée et ferait échouer `patch-package` au `postinstall`.
3. **Figer les autres paquets Capacitor en versions exactes** (`@capacitor/core`, `ios`, `android`, `cli`, `app`, `camera`, `preferences`, `@capacitor-community/admob`) pour éviter qu'une future publication upstream recasse le build sans prévenir.
4. Mettre à jour `package-lock.json` en conséquence (c'est lui que `npm ci` utilise sur le runner).

## Vérification

Après merge sur `main`, le workflow « Build iOS IPA » se relance : l'étape archive doit passer, puis l'export IPA et l'upload App Store Connect. Si l'échec se déplace vers la signature ou l'upload, on traitera cette erreur-là séparément (certificat/profil ou numéro de build déjà utilisé).

## Détails techniques

- `ios/App/CapApp-SPM/Package.swift` épingle `capacitor-swift-pm` en `exact: "8.5.0"` ; ce fichier est régénéré par `npx cap sync ios` à partir de la version de `@capacitor/ios`, donc figer npm suffit (pas de modification manuelle de ce fichier, qui contient par ailleurs des chemins Windows réécrits par `cap sync` sur le runner).
- Aucun code applicatif n'est touché : les notifications locales utilisent l'API JS stable, identique entre 8.2.1 et 8.3.1.
- Après le fix : `git pull` puis `npm install` et `npx cap sync ios` en local si tu builds aussi depuis ta machine.
