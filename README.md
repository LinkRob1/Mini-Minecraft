# Mini-Minecraft
Mini-Minecraft est un projet d'exemple qui montre un petit monde voxel en 3D avec mouvement joueur, placement/suppression de blocs et génération procédurale basée sur Perlin noise.

Fonctionnalités implémentées :
 Textures procédurales (Herbe, Terre, Pierre, Bois) appliquées aux blocs
 Plan de sol texturé et effet de brume (fog) pour horizon

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
3. Cliquez sur « Commencer » pour verrouiller la souris.
4. Utilisez WASD pour bouger, Space pour sauter.
5. Click gauche: supprimer bloc; Click droit: placer bloc
6. Touches 1-4 : sélection rapide du type de bloc (1=Herbe, 2=Terre, 3=Pierre, 4=Bois)

Fonctionnalités supplémentaires :
- Choix du type de bloc (Herbe, Terre, Pierre, Bois)
- Sauvegarde / chargement du monde dans `localStorage`
- Effacer le monde

 Prochaines étapes recommandées :
 - Optimisation (InstancedMesh pour les blocs)
 - Génération de terrain plus avancée (Perlin noise)
 - Ajout d'un inventaire, textures et biomes
Prochaines améliorations : instanced rendering (déjà implémenté pour le terrain), textures, inventaire, Perlin amélioré, collisions physiques améliorées (AABB) — implémenté.

Ressources :
- Three.js : https://threejs.org
- Exemple d'un voxel engine: https://github.com/aoeui/miner
