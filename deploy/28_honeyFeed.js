module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("28. Deploy HONEY Feed")
    const {deploy} = deployments;
    const {deployer, ethFeed, invKeep3rFeed, inv, weth} = await getNamedAccounts();

    await deploy('HoneyFeed', {
      from: deployer,
      args:[
        invKeep3rFeed,
        ethFeed,
        inv,
        weth
      ]
    });
  };

  module.exports.tags = ['HoneyFeed'];