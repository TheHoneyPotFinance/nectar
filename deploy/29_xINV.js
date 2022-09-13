module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("28. Deploy xHONEY")
    const { deploy, save } = deployments;
    const { deployer, inv, gov } = await getNamedAccounts();

    const comptroller = await deployments.get('Unitroller');
    const name = 'xHONEY';
    const symbol = 'XHONEY';
    const decimals = 18;

    await deploy('XHONEY', {
      from: deployer,
      args:[
          inv, // inverse as underlying
          comptroller.address,
          "6600000000000000", // reward per block
          gov,
          name,
          symbol,
          decimals,
          gov // governance as admin
      ]
    });

    const XHONEY = await deployments.get('XHONEY');

    await save("XHONEY", XHONEY);
  };

module.exports.tags = ['XHONEY'];