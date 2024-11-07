// ipfsConfig.js
import { createHelia, libp2pDefaults } from 'helia';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';

export const createIPFSNode = async () => {
  try {
    // Configuration de base de libp2p
    const libp2pOptions = libp2pDefaults()
    
    // Ajout du service gossipsub pour la communication P2P
    libp2pOptions.services.pubsub = gossipsub()
    
    // Création du nœud Helia
    const ipfs = await createHelia({ 
      libp2p: libp2pOptions,
    })
    
    return ipfs;
  } catch (error) {
    console.error('Erreur lors de la création du nœud IPFS:', error)
    throw error
  }
}