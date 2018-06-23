var BDBToken = artifacts.require("BDBToken");

module.exports = function(deployer) {
  deployer.deploy(BDBToken);
};