module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("22. Add Stabilizer as Minter")
    const {execute} = deployments;
    const {deployer} = await getNamedAccounts()

    await execute('Dew', {
        from: deployer
    },
        "addMinter",
        (await deployments.get('Stabilizer')).address
    )
    return true
  };
module.exports.id = 'addMinterStabilizer'
module.exports.tags = ['addMinterStabilizer'];
module.exports.dependencies = ['Dew', 'Stabilizer'];