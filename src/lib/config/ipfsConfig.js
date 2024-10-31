// ipfsConfig.js
import { create } from 'ipfs-core';
import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { webRTCStar } from '@libp2p/webrtc-star';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';
import { bootstrap } from '@libp2p/bootstrap';
import { kadDHT } from '@libp2p/kad-dht';

// Liste des nœuds bootstrap IPFS publics fiables
const bootstrapNodes = [
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
  // Nœuds IPFS publics
  '/dns4/node0.preload.ipfs.io/tcp/443/wss/p2p/QmZMxNdpMkewiVZLMRxaNxUeZpDUb34pWjZ1kZvsd16Zic',
  '/dns4/node1.preload.ipfs.io/tcp/443/wss/p2p/Qmbut9Ywz9YEDrz8ySBSgWyJk41Uvm2QJPhwDJzJyGFsD6',
];

export const createIPFSNode = async () => {
  // Configuration de libp2p
  const libp2pConfig = {
    transports: [
      webSockets(),
      webRTCStar()
    ],
    connectionEncryption: [noise()],
    streamMuxers: [mplex()],
    peerDiscovery: [
      bootstrap({
        list: bootstrapNodes
      })
    ],
    dht: kadDHT(),
    relay: {
      enabled: true,
      hop: {
        enabled: true,
        active: true
      }
    },
    nat: {
      enabled: true
    }
  };

  // Création du nœud IPFS avec la configuration libp2p
  const ipfs = await create({
    repo: 'ipfs-' + Math.random(),
    libp2p: (opts) => createLibp2p({
      ...opts,
      ...libp2pConfig
    }),
    config: {
      Addresses: {
        Swarm: [
          '/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star',
          '/dns4/wrtc-star2.sjc.dwebops.pub/tcp/443/wss/p2p-webrtc-star'
        ]
      },
      Bootstrap: bootstrapNodes
    }
  });

  return ipfs;
};
