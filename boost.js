const bcore = require('biot-core');
const Wallet = require('ocore/wallet');
const composer = require('ocore/composer');
const network = require('ocore/network');
const libKeys = require('biot-core/lib/keys');
const eventBus = require('ocore/event_bus');


(async () => {
  await bcore.init('test');

  const device = require('ocore/device');
  const wallets = await bcore.getWallets();
  const balance = await bcore.getWalletBalance(wallets[0]);
  const addresses = await bcore.getAddressesInWallet(wallets[0]);
  const myDeviceAddress = device.getMyDeviceAddress();
  if (balance.base.stable + balance.base.pending === 0) {
    throw Error('Run faucet first');
  }

  let awaitStabilization = false;
  let interval;
  eventBus.on('my_transactions_became_stable', () => {
    if (awaitStabilization) {
      awaitStabilization = false;
      interval = setInterval(boost, 6000);
      boost();
    }
  });

  async function boost() {
    const unit = await new Promise((resolve, reject) => {
      let opts = {};
      opts.paying_addresses = [addresses[0]];
      opts.outputs = [
        {
          address: addresses[0],
          amount: 0
        }];
      opts.signer = Wallet.getSigner(opts,
        [myDeviceAddress],
        libKeys.signWithLocalPrivateKey,
        false);
      opts.spend_unconfirmed = 'all';
      opts.callbacks = {
        ifError: (err) => {
          if(err.includes('nonserials are not stable yet')){
            clearInterval(interval);
            awaitStabilization = true;
            return resolve('I\'m waiting for unit stabilization and will try again');
          }
          return reject(err);
        },
        ifNotEnoughFunds: (err) => {
          return reject(err);
        },
        ifOk: (objJoint) => {
          network.broadcastJoint(objJoint);
          return resolve(objJoint.unit.unit);
        }
      };
      opts.callbacks = composer.getSavingCallbacks(opts.callbacks);
      composer.composeJoint(opts);
    });
    console.error(unit);
  }

  interval = setInterval(boost, 6000);
  await boost();
})();