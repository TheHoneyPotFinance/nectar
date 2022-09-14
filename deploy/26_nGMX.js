GMX
module.exports = async ({
  deployments,
  getNamedAccounts
}) => {
  console.log("26. Deploy nGMX")
  const {deploy, save} = deployments;

  const Unitroller = await deployments.get('Unitroller');
  const Model = await deployments.get('DewInterestRateModel');
  const {deployer, gmx, delegateRegistry} = await getNamedAccounts();

  await deploy('CGMX', {
    from: deployer,
    args:[
      gmx,
      Unitroller.address,
      Model.address,
      "200000000000000000000000000",
      "Nectar GMX",
      "nGMX",
      "8",
      deployer,
      delegateRegistry
    ]
  });
  const CGMX = await deployments.get('CGMX');
  await save("nGMX", CGMX);
};

module.exports.dependencies = ['DewInterestRateModel', 'Unitroller'];
module.exports.tags = ['nGMX'];