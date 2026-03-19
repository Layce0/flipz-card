

## Diagnostic

Le site déployé via Lovable n'a pas de fichier `_redirects` dans le dossier `public/`. Sans ce fichier, quand un utilisateur accède directement à une route comme `/collection` ou `/packs`, le serveur retourne une erreur 404 au lieu de servir `index.html` et laisser React Router gérer la route.

La preview fonctionne car le serveur de développement Vite gère automatiquement le fallback SPA.

## Plan

### 1. Créer `public/_redirects`

Ajouter un fichier `public/_redirects` avec la règle de redirection SPA standard :

```
/*    /index.html   200
```

Ce fichier sera copié dans le dossier `dist/` lors du build et indiquera au serveur de production de toujours servir `index.html` pour toutes les routes, permettant à React Router de prendre le relais côté client.

C'est un changement d'un seul fichier.

