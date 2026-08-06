# Codes cadeaux acceptés par Apple sur iPhone

Aujourd'hui la section « Code Promo » est **masquée sur iOS** (`RedeemCodeSection` s'arrête immédiatement sur iPhone). Objectif : la réafficher d'une façon conforme aux règles Apple.

## Ce qu'Apple autorise

Apple (règle 3.1.1) interdit un champ de code qui permet de **débloquer du contenu payé ailleurs** (site web, boutique tierce). En revanche, un code **cadeau 100 % gratuit**, distribué par toi (réseaux sociaux, événement, support joueur), est autorisé tant que :

- aucun prix, achat ou moyen de paiement externe n'est mentionné à côté du champ ;
- le code ne peut pas être acheté ;
- le code ne sert pas à contourner un achat intégré.

La solution est donc d'afficher les codes sur iPhone, mais de garantir côté serveur qu'un code encaissé sur iOS est bien un code cadeau gratuit.

## Ce qui va être fait

1. **Marquage « cadeau gratuit » des codes**
   - Nouvelle colonne `is_gift` (booléen, `true` par défaut) sur la table des codes.
   - Case à cocher dans le gestionnaire de codes de l'admin : « Code cadeau gratuit (autorisé sur iOS) ».

2. **Contrôle serveur**
   - La fonction `redeem-code` reçoit la plateforme du client. Sur iOS, un code non marqué comme cadeau gratuit est refusé avec un message clair.
   - Aucune modification du calcul des récompenses existantes.

3. **Retour de la section sur iPhone**
   - Suppression du blocage iOS dans `RedeemCodeSection`.
   - Sur iOS uniquement, le texte devient orienté cadeau : titre « Code cadeau », description du type « Entre un code cadeau reçu de l'équipe FLIPZ ou lors d'un événement ». Aucune mention de prix, d'achat ou de boutique externe.

4. **Traductions** FR / EN / ES pour les nouveaux textes.

## Détails techniques

- Migration : `ALTER TABLE public.reward_codes ADD COLUMN is_gift boolean NOT NULL DEFAULT true;` (les codes existants restent utilisables).
- `redeem-code` : lecture d'un champ `platform` dans le corps de la requête ; si `platform === 'ios'` et `is_gift = false` → réponse 403 « Ce code n'est pas disponible sur iPhone ».
- Le client envoie `platform: Capacitor.getPlatform()` lors de l'appel.
- `RedeemCodeSection.tsx` : suppression du `if (isNativeIOS) return null;` et libellés conditionnels.

## À prévoir de ton côté

Après le build : `git pull`, `npx cap sync ios`, incrémenter le numéro de build. Si Apple pose la question lors de la review, indiquer dans les notes que le champ sert uniquement à des codes cadeaux gratuits distribués par l'équipe, jamais vendus.
