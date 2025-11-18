
const abi = require('../../artifacts/contracts/DAOContract.sol/DAOContract.json');
const contractAddress = require("../../../json-log/honk_verifier.json").HonkVerifier;

class HonkVerifier {
  address = contractAddress;
  abi = abi;
  signer = process.env.WALLET_PRIVATE_KEY;
}


module.exports = { HonkVerifier };