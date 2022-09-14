module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("14. Add Dew Market")
    const {execute} = deployments;
    const {deployer} = await getNamedAccounts()

    await execute('Comptroller', {
        from: deployer
    },
        "_supportMarket",
        (await deployments.get('nDew')).address
    )
    return true
  };

module.exports.id = 'addDewMarket'
module.exports.tags = ['addDewMarket'];
module.exports.dependencies = ['Unitroller', 'nDew'];