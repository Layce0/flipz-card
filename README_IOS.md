# Daily Card Quest - iOS Build Automation

Ce dossier contient tout le nécessaire pour compiler l'application iOS automatiquement via GitHub Actions. Étant donné que vous êtes sur Windows, c'est la méthode la plus simple pour générer un fichier `.ipa` (l'application iOS).

## Étapes à suivre

### 1. Pousser le code sur GitHub
J'ai créé un script PowerShell pour vous aider. Ouvrez PowerShell, naviguez vers ce dossier (`cd c:\Users\layce\Desktop\daily-card-quest`) et exécutez le script avec votre token GitHub (Personal Access Token avec droits `repo` et `workflow`) :

```powershell
.\push_to_github.ps1 -GitHubToken "VOTRE_TOKEN_ICI" -RepoName "daily-card-quest-ios"
```

### 2. Configurer les secrets sur GitHub
Une fois le projet sur GitHub, allez dans **Settings > Secrets and variables > Actions** et ajoutez ces secrets :
- `APPLE_ID` : Votre adresse email Apple Developer
- `FASTLANE_USER` : Même chose que APPLE_ID
- `FASTLANE_PASSWORD` : Votre mot de passe (ou mot de passe d'application spécifique)
- `MATCH_PASSWORD` : Le mot de passe que vous choisirez pour protéger vos certificats avec Fastlane Match
- `MATCH_GIT_URL` : L'URL d'un dépôt Git privé où vous stockerez vos certificats (Fastlane Match)

### 3. Configurer les certificats (Signing)
Apple requiert que l'application soit signée avec vos certificats développeur. 
- Dans le fichier `ios/App/App/Fastfile`, il y a une lane `build_with_match`.
- Il faut soit configurer Fastlane Match pour générer les certificats et les mettre sur GitHub, soit uploader manuellement vos profils de provisioning et éditer le `Fastfile` pour pointer dessus.

### 4. Récupérer l'application (.ipa)
Chaque fois que vous faites un `git push`, le processus se lance dans l'onglet **Actions** de GitHub. Une fois terminé, il génère un artefact nommé `DailyCard-iOS-IPA` que vous pouvez télécharger !
