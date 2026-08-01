## Diagnostic (confirmé par lecture du code + de l'API du plugin)

Apple a vu deux erreurs : une sur la page Boutique, puis une seconde à l'achat. Les deux viennent de la **même cause** dans `src/hooks/useAppleBilling.ts`.

L'initialisation appelle des méthodes qui **n'existent pas** dans `cordova-plugin-purchase` v13 (vérifié dans `node_modules/cordova-plugin-purchase/www/store.d.ts`) :

- `store.when().cancelled(...)` — l'interface `When` expose `initiated / approved / pending / finished / verified / unverified / productUpdated / receiptUpdated / receiptsReady / receiptsVerified / storefrontUpdated`. Pas de `cancelled`.
- `store.when().ready(...)` — `ready(cb)` existe sur `store`, pas sur `when()`.
- `store.when().error(...)` — `error(cb)` existe sur `store`, pas sur `when()`.

Conséquence en chaîne : dès la 2e ligne (`.cancelled`), une `TypeError` est levée, attrapée par le `try/catch` global → `storeError` est défini → **la bannière orange d'erreur s'affiche systématiquement sur la Boutique iOS**. Et comme l'exception survient avant `store.initialize(...)` (ligne 251), le store n'est **jamais initialisé** : aucun produit n'est chargé, donc tout achat échoue avec « Ce produit n'est pas encore disponible » — la 2e erreur vue par Apple.

## Correctifs

### 1. `src/hooks/useAppleBilling.ts` — utiliser la vraie API du plugin
- Remplacer `store.when().ready(...)` par `store.ready(() => ...)`.
- Remplacer `store.when().error(...)` par `store.error((err) => ...)`.
- Supprimer `store.when().cancelled(...)` ; gérer l'annulation via :
  - le rejet de `offer.order()` qui renvoie un `IError` avec `code === CdvPurchase.ErrorCode.PAYMENT_CANCELLED`,
  - et `store.when().finished(tx => ...)` si l'état est `CANCELLED`.
- Remplacer le `.updated(...)` déprécié par `.productUpdated(...)` pour les prix localisés.
- Chaîner correctement les handlers en un seul `store.when()` et n'appeler `initialize()` qu'après, dans un `try/catch` distinct pour qu'une erreur de handler ne bloque plus l'init.
- Utiliser `store.isReady` comme fallback dans le timeout de sécurité (au lieu de forcer un état d'erreur alors que le store est peut‑être prêt).

### 2. Bannière d'erreur boutique — ne plus alarmer le reviewer
- Ne plus afficher la bannière orange quand le store est simplement lent : n'afficher un message qu'après échec réel d'un achat.
- Conserver le spinner discret « Connexion à l'App Store… » et le bouton Réessayer, mais sans encadré d'erreur au chargement (`src/pages/Shop.tsx`).

### 3. `supabase/functions/verify-apple-purchase/index.ts` — tolérance sandbox
- Le rapprochement exige `transaction_id === transactionId` ET `product_id === productId`. En sandbox StoreKit, l'identifiant renvoyé par le plugin peut différer (original vs transaction id). Fallback : si aucune correspondance exacte, accepter la dernière entrée `in_app` correspondant au `product_id`, sinon échouer.
- Redéployer la fonction.

## À vérifier de ton côté (hors code)
- **Paid Apps Agreement** actif dans App Store Connect → Business (sans lui, aucun produit ne se charge, même code parfait).
- Les 12 IAP en statut « Prêt à soumettre », avec prix, description et capture d'écran de revue.
- Le produit `Pack_lucky_5` a un **P majuscule** : vérifier que l'identifiant dans App Store Connect est exactement identique.

## Après implémentation
Un `git pull` + `npx cap sync ios` puis un nouveau build (numéro de build incrémenté) est nécessaire avant de resoumettre.
