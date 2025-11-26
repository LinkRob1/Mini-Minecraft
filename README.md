# Mini-Minecraft
Mini-Minecraft est un projet d'exemple qui montre un petit monde voxel en 3D avec mouvement joueur, placement/suppression de blocs et génération procédurale basée sur Perlin noise.

Fonctionnalités implémentées :
- Scène 3D construite avec Three.js
- Terrain procédural (grid + hauteur minimale)
- Mouvement joueur (WASD + saut) via Pointer Lock Controls
- Placement (click droite) et suppression (click gauche) de blocs
- Previsualisation de placement (ghost cube)

Comment lancer :
1. Cloner le dépôt et ouvrir un serveur HTTP local (les fichiers sont statiques) :

```bash
git clone https://github.com/LinkRob1/Mini-Minecraft.git
cd Mini-Minecraft
# Option 1: Python3
python3 -m http.server 8000
# Option 2: Node http-server si installé
npx http-server -c-1
```

2. Ouvrez le navigateur sur http://localhost:8000
3. Cliquez sur « Commencer » pour verrouiller la souris. Utilisez WASD pour bouger, espace pour sauter.
4. Choisissez un type de bloc depuis le sélecteur dans l'overlay pour placer différentes textures.

Fonctionnalités supplémentaires :
- Choix du type de bloc (Herbe, Terre, Pierre, Bois)
- Sauvegarde / chargement du monde dans `localStorage`
- Effacer le monde

Prochaines étapes recommandées :
- Optimisation (InstancedMesh pour les blocs)
- Génération de terrain plus avancée (Perlin noise)
- Ajout d'un inventaire, textures et biomes

Ressources :
- Three.js : https://threejs.org
- Exemple d'un voxel engine: https://github.com/aoeui/miner
