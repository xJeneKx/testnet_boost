const bcore = require('biot-core');
const Wallet = require('ocore/wallet');
const composer = require('ocore/composer');
const network = require('ocore/network');
const libKeys = require('biot-core/lib/keys');

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

  async function boost() {
    const unit = await new Promise((resolve, reject) => {
      let opts = {};
      opts.paying_addresses = [addresses[0]];
      opts.outputs = [
        {
          address: addresses[0],
          amount: 0
        }];
      opts.signer = Wallet.getSigner(opts, [myDeviceAddress], libKeys.signWithLocalPrivateKey, false);
      opts.spend_unconfirmed = 'all';
      opts.callbacks = {
        ifError: (err) => {
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

  await boost();
  setInterval(boost, 6000);
})();