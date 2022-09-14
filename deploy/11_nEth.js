module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("11. Deploy nETH")
    const {deploy, save} = deployments;
    const {deployer} = await getNamedAccounts()

    const Unitroller = await deployments.get('Unitroller');
    const Model = await deployments.get('EthInterestRateModel');

    await deploy('CEther', {
      from: deployer,
      args:[
        Unitroller.address,
        Model.address,
        "200000000000000000000000000",
        "Nectar Ether",
        "nETH",
        "8",
        deployer
      ]
    });

    const CERC20 = await deployments.get('CEther');
    await save("nETH", CERC20);
  };

module.exports.dependencies = ['EthInterestRateModel', 'Unitroller'];
module.exports.tags = ['nETH'];