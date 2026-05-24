/**
 * Module de gestion des sauvegardes (export/import)
 */

import { getProfiles, saveProfiles } from './gameUtils.js';
import { showAlert, showConfirm } from './ui/dialog.js';

/**
 * Exporte la sauvegarde du profil actuel
 */
export function exportSave() {
    try {
        // Récupérer le profil actuel
        const currentProfilePseudo = localStorage.getItem('currentProfile');

        if (!currentProfilePseudo) {
            showAlert('Selectionne un profil avant d\'exporter.', { title: 'Aucun profil selectionne' });
            return;
        }

        // Récupérer tous les profils
        const profiles = getProfiles();

        // Trouver le profil correspondant
        const currentProfile = profiles.find(p => p.pseudo === currentProfilePseudo);

        if (!currentProfile) {
            showAlert('Profil introuvable. Impossible d\'exporter la sauvegarde.', { title: 'Erreur d\'export' });
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
        showAlert('Sauvegarde exportée avec succès !', { title: 'Export reussi' });

    } catch (error) {
        console.error('Erreur lors de l\'export:', error);
        showAlert('Une erreur est survenue lors de l\'export de la sauvegarde.', { title: 'Erreur d\'export' });
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
            
            reader.onload = async (e) => {
                try {
                    // Parser le JSON
                    const saveData = JSON.parse(e.target.result);

                    // Vérifier la structure
                    if (!saveData.version || !saveData.profile) {
                        showAlert('Le fichier ne contient pas les donnees necessaires.', { title: 'Format invalide' });
                        return;
                    }

                    // Récupérer les profils existants
                    const profiles = getProfiles();

                    // Vérifier si le pseudo existe déjà
                    const existingIndex = profiles.findIndex(p => p.pseudo === saveData.profile.pseudo);

                    if (existingIndex !== -1) {
                        // Demander confirmation pour écraser
                        const confirmOverwrite = await showConfirm(
                            `Un profil "${saveData.profile.pseudo}" existe deja.\nL'ecraser avec la sauvegarde importee ?`,
                            { title: 'Profil existant', okText: 'Ecraser', cancelText: 'Annuler' }
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
                            showAlert('Supprime un profil avant d\'importer.', { title: 'Limite de 4 profils atteinte' });
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

                    // Recharger la page une fois la modale fermee
                    await showAlert('Sauvegarde importée avec succès !', { title: 'Import reussi' });
                    window.location.reload();

                } catch (parseError) {
                    console.error('Erreur de parsing:', parseError);
                    showAlert('Le fichier JSON est invalide ou corrompu.', { title: 'Import impossible' });
                }
            };

            reader.onerror = () => {
                showAlert('Erreur lors de la lecture du fichier.', { title: 'Lecture impossible' });
            };
            
            reader.readAsText(file);
        };
        
        // Déclencher la sélection de fichier
        input.click();
        
    } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        showAlert('Une erreur est survenue lors de l\'import de la sauvegarde.', { title: 'Erreur d\'import' });
    }
}
