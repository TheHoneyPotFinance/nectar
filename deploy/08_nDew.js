module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("8. Deploy nDew")
    const {deploy, save} = deployments;

    const Dew = await deployments.get('Dew');
    const Unitroller = await deployments.get('Unitroller');
    const Model = await deployments.get('DewInterestRateModel');
    const {deployer} = await getNamedAccounts();

    await deploy('CErc20Immutable', {
      from: deployer,
      args:[
        Dew.address,
        Unitroller.address,
        Model.address,
        "200000000000000000000000000",
        "Nectar Dew",
        "nDew",
        "8",
        deployer
      ]
    });

    const CERC20 = await deployments.get('CErc20Immutable');
    await save("nDew", CERC20);
  };

module.exports.dependencies = ['DewInterestRateModel','Dew', 'Unitroller'];
module.exports.tags = ['nDew'];