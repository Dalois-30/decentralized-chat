import { create } from 'ipfs-core';

export const createIPFSNode = async () => {
  return await create({
    repo: 'ipfs-' + Math.random(),
    config: {
      Addresses: {
        Swarm: [
          '/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star',
          '/dns4/wrtc-star2.sjc.dwebops.pub/tcp/443/wss/p2p-webrtc-star'
        ]
      },
      Bootstrap: [
        '/dns4/node0.preload.ipfs.io/tcp/443/wss/p2p/QmZMxNdpMkewiVZLMRxaNxUeZpDUb34pWjZ1kZvsd16Zic',
        '/dns4/node1.preload.ipfs.io/tcp/443/wss/p2p/Qmbut9Ywz9YEDrz8ySBSgWyJk41Uvm2QJPhwDJzJyGFsD6'
      ]
    },
    EXPERIMENTAL: {
      pubsub: true
    },
    start: true,
    preload: {
      enabled: false
    },
    relay: {
      enabled: true,
      hop: {
        enabled: true
      }
    }
  });
};