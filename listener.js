const NKNClient = require('nkn-client');

const client = new NKNClient({ identifier: 'lore-node' });

client.on('connect', () => {
  console.log('✅ LoreForge connected to NKN as:', client.addr);
});

client.on('message', (src, payload) => {
  console.log(`📩 Message from ${src}: ${payload}`);
});
