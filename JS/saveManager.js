/**
 * Module de gestion des sauvegardes (export/import)
 */

import { getProfiles, saveProfiles } from './gameUtils.js';

/**
 * Exporte la sauvegarde du profil actuel
 */
export function exportSave() {
    try {
        // Récupérer le profil actuel
        const currentProfilePseudo = localStorage.getItem('currentProfile');

        if (!currentProfilePseudo) {
            alert('Aucun profil sélectionné. Veuillez sélectionner un profil avant d\'exporter.');
            return;
        }

        // Récupérer tous les profils
        const profiles = getProfiles();
        
        // Trouver le profil correspondant
        const currentProfile = profiles.find(p => p.pseudo === currentProfilePseudo);
        
        if (!currentProfile) {
            alert('Profil introuvable. Impossible d\'exporter la sauvegarde.');
            return;
        }
        
        // Créer l'objet de sauvegarde
        const saveData = {
            version: "1.0",
            exportDate: new Date().toISOString(),
            profile: currentProfile
        };
        
        // Convertir en JSON avec indentation
        const jsonString = JSON.stringify(saveData, null, 2);
        
        // Créer un Blob
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // Générer une URL temporaire
        const url = URL.createObjectURL(blob);
        
        // Créer un lien de téléchargement
        const a = document.createElement('a');
        a.href = url;
        a.download = `GTG_Save_${currentProfilePseudo}_${Date.now()}.json`;
        
        // Déclencher le téléchargement
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Nettoyer l'URL
        URL.revokeObjectURL(url);
        
        // Message de confirmation
        alert('Sauvegarde exportée avec succès !');
        
    } catch (error) {
        console.error('Erreur lors de l\'export:', error);
        alert('Une erreur est survenue lors de l\'export de la sauvegarde.');
    }
}

/**
 * Importe une sauvegarde depuis un fichier JSON
 */
export function importSave() {
    try {
        // Créer un input file
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            
            if (!file) {
                return;
            }
            
            // Lire le fichier
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    // Parser le JSON
                    const saveData = JSON.parse(e.target.result);
                    
                    // Vérifier la structure
                    if (!saveData.version || !saveData.profile) {
                        alert('Format de sauvegarde invalide. Le fichier ne contient pas les données nécessaires.');
                        return;
                    }
                    
                    // Récupérer les profils existants
                    const profiles = getProfiles();

                    // Vérifier si le pseudo existe déjà
                    const existingIndex = profiles.findIndex(p => p.pseudo === saveData.profile.pseudo);

                    if (existingIndex !== -1) {
                        // Demander confirmation pour écraser
                        const confirmOverwrite = window.confirm(
                            `Un profil avec le pseudo "${saveData.profile.pseudo}" existe déjà. Voulez-vous l'écraser ?`
                        );

                        if (confirmOverwrite) {
                            // Remplacer le profil existant
                            profiles[existingIndex] = saveData.profile;
                        } else {
                            return;
                        }
                    } else {
                        // Vérifier la limite de 4 profils
                        if (profiles.length >= 4) {
                            alert('Limite de 4 profils atteinte. Supprimez un profil avant d\'importer.');
                            return;
                        }

                        // Ajouter le nouveau profil
                        profiles.push(saveData.profile);
                    }

                    // Sauvegarder dans localStorage
                    if (!saveProfiles(profiles)) {
                        // Echec persistance : on n'affiche pas le message de succes
                        return;
                    }

                    // Recharger la page
                    alert('Sauvegarde importée avec succès !');
                    window.location.reload();
                    
                } catch (parseError) {
                    console.error('Erreur de parsing:', parseError);
                    alert('Le fichier JSON est invalide ou corrompu. Impossible d\'importer la sauvegarde.');
                }
            };
            
            reader.onerror = () => {
                alert('Erreur lors de la lecture du fichier.');
            };
            
            reader.readAsText(file);
        };
        
        // Déclencher la sélection de fichier
        input.click();
        
    } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        alert('Une erreur est survenue lors de l\'import de la sauvegarde.');
    }
}
