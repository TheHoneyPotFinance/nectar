module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("6. Deploy Dew")
    const {deploy, save} = deployments;
    const {deployer} = await getNamedAccounts()

    await deploy('ERC20', {
      from: deployer,
      args:[
          "Dew USD Stablecoin",
          "DEW",
          18
      ]
    });

    const ERC20 = await deployments.get('ERC20');

    await save("Dew", ERC20);
  };

module.exports.tags = ['Dew'];